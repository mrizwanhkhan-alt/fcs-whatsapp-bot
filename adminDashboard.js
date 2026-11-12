"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const {
  attachment, checkRecipient, deliveryStatus, recentDeliveryStatuses, fail, prepareMessage, recipient,
  sendAdminMessage, templates, usageSummary, windowExpiry
} = require("./adminMessaging");

const { getApplications } = require("./googleSheets");
const { provinceCityReport } = require("./provinceCityReport");
const { findCustomer } = require("./customerLookup");
const { customerStatusReport } = require("./customerStatusReport");
const { updateEngagement } = require("./googleSheets");
const { recordAudit, recentAudit } = require("./securityAudit");
const { recentCallLogs } = require("./callingRoutes");
const { safeStaffList, authenticateStaff } = require("./staffAccounts");
const { branchSummary, branches } = require("./branchDirectory");
const centralDb = require("./centralDatabase");

const COOKIE = "__Host-fcs_admin";
const SESSION_MS = 8 * 60 * 60 * 1000;
const LOGIN_INTERVAL = 5 * 60 * 1000;
const LOGIN_LIMIT = 10;
const MAX_REQUEST_BYTES = 32 * 1024;
const scrypt = promisify(crypto.scrypt);
const credential = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(process.env.ADMIN_PASSWORD_HASH || "");
const sessions = new Map();
const loginAttempts = [];
let sendsInProgress = 0;

const assets = {
  "/admin": ["admin.html", "text/html; charset=utf-8"],
  "/admin/dashboard.js": ["adminClient.js", "application/javascript; charset=utf-8"]
};
const securityHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};

function respond(res, status, data, headers = {}) {
  res.writeHead(status, {
    ...securityHeaders, "Content-Type": "application/json; charset=utf-8", ...headers
  });
  res.end(JSON.stringify(data));
}

function cookie(token, maxAge) {
  return `${COOKIE}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function tokenFrom(req) {
  const name = `${COOKIE}=`;
  return (req.headers.cookie || "").split(";").map(part => part.trim())
    .find(part => part.startsWith(name))?.slice(name.length);
}

function activeSession(token) {
  const session = sessions.get(token);
  if (session?.expires > Date.now()) return session;
  sessions.delete(token);
  return null;
}

async function readBytes(req, limit) {
  if (Number(req.headers["content-length"]) > limit) {
    req.resume();
    fail(413, "Request exceeds the file or message size limit.");
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    length += chunk.length;
    if (length > limit) {
      req.resume();
      fail(413, "Request exceeds the file or message size limit.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

function jsonObject(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(400, "Invalid request.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(400, "Invalid request.");
  return parsed;
}

async function readJSON(req) {
  if (req.headers["content-type"] !== "application/json") fail(415, "Expected a JSON request.");
  return jsonObject(await readBytes(req, MAX_REQUEST_BYTES));
}

async function login(req, res, previousToken) {

  const now = Date.now();
  while (loginAttempts.length && loginAttempts[0].at <= now - LOGIN_INTERVAL) loginAttempts.shift();
  if (loginAttempts.length >= LOGIN_LIMIT) {
    return respond(res, 429, { error: "Too many sign-in attempts. Try again in five minutes." }, {
      "Retry-After": String(Math.ceil((loginAttempts[0].at + LOGIN_INTERVAL - now) / 1000))
    });
  }
  const { password, staffId } = await readJSON(req);
  if (!credential && !staffId) fail(503, "Admin login is awaiting server configuration.");
  if (typeof password !== "string" || !password || password.length > 256) {
    fail(400, "Enter your admin password.");
  }
  // Reserve an attempt before starting the asynchronous password check.
  const attemptTime = { at: Date.now() };
  if (loginAttempts.length >= LOGIN_LIMIT) fail(429, "Too many sign-in attempts. Try again in five minutes.");
  loginAttempts.push(attemptTime);
  let identity;
  if (staffId) {
    identity = await authenticateStaff(staffId, password);
  } else {
    const digest = await scrypt(password, Buffer.from(credential[1], "hex"), 64);
    if (crypto.timingSafeEqual(digest, Buffer.from(credential[2], "hex"))) identity = { id: "admin", role: "admin" };
  }
  if (!identity) { recordAudit("login", "failed", String(staffId || "admin").slice(0,32)); fail(401, "Incorrect credentials."); }
  recordAudit("login", "success", identity.id);

  const attemptIndex = loginAttempts.indexOf(attemptTime);
  if (attemptIndex !== -1) loginAttempts.splice(attemptIndex, 1);
  for (const [id, session] of sessions) {
    if (session.expires <= Date.now()) sessions.delete(id);
  }
  sessions.delete(previousToken);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    csrf: crypto.randomBytes(32).toString("hex"), expires: Date.now() + SESSION_MS, identity
  });
  return respond(res, 200, { signedIn: true, identity }, {
    "Set-Cookie": cookie(token, SESSION_MS / 1000)
  });
}

function prepare(input, binary) {
  const message = prepareMessage(input);
  const expected = message.type === "media" ? "attachment" : message.template?.header;
  if (Boolean(expected) !== binary) {
    fail(400, expected ? "Select a file to attach." : "This message does not take a file.");
  }
  const file = binary ? attachment(input.filename) : null;
  if (expected === "image" && file.kind !== "image") fail(415, "This template requires a JPG or PNG.");
  if (expected === "document" && file.mime !== "application/pdf") fail(415, "This template requires a PDF.");
  return { message, file };
}

async function readAttachment(req) {
  // The request begins with length-prefixed UTF-8 JSON, followed by the file bytes.
  const metadataLength = Number(req.headers["x-admin-metadata-length"]);
  if (!Number.isInteger(metadataLength) || metadataLength < 2 || metadataLength > MAX_REQUEST_BYTES) {
    fail(400, "Invalid attachment metadata.");
  }
  const metadata = Buffer.alloc(metadataLength);
  let offset = 0;
  let upload;
  const chunks = [];
  let length = 0;
  for await (let chunk of req.iterator({ destroyOnReturn: false })) {
    if (!upload) {
      const used = chunk.copy(metadata, offset);
      offset += used;
      if (offset < metadataLength) continue;
      upload = prepare(jsonObject(metadata), true);
      if (Number(req.headers["content-length"]) - metadataLength > upload.file.limit) {
        fail(413, "File exceeds the size limit.");
      }
      chunk = chunk.subarray(used);
    }
    length += chunk.length;
    if (length > upload.file.limit) fail(413, "File exceeds the size limit.");
    if (chunk.length) chunks.push(chunk);
  }
  if (!upload) fail(400, "Invalid attachment request.");
  return { ...upload, bytes: Buffer.concat(chunks, length) };
}

async function send(req, res, session, token) {
  if (session.sending || sendsInProgress >= 2) fail(429, "A send is in progress. Try again shortly.");
  session.sending = true;
  sendsInProgress++;
  try {
    const { message, file, bytes } = req.headers["content-type"] === "application/octet-stream"
      ? await readAttachment(req)
      : prepare(await readJSON(req), false);

    const result = await sendAdminMessage(message, file, bytes, () => activeSession(token) === session);
    return respond(res, 200, { accepted: true, messageId: result.messageId, status: "accepted" });
  } finally {
    session.sending = false;
    sendsInProgress--;
  }
}

async function adminDashboard(req, res, url) {
  try {
    const route = url.pathname;
    const asset = assets[route];
    if (req.method === "GET" && route === "/admin/") {
      res.writeHead(308, { ...securityHeaders, Location: "/admin" });
      return res.end();
    }
    if (req.method === "GET" && asset) {
      const [name, type] = asset;
      const body = await fs.promises.readFile(path.join(__dirname, name));
      res.writeHead(200, { ...securityHeaders, "Content-Type": type });
      return res.end(body);
    }

    const token = tokenFrom(req);
    const session = activeSession(token);
    const role = session?.identity?.role;
    const adminOnly = new Set(["/admin/security-audit","/admin/staff-ids","/admin/backup-export"]);
    const operatorOnly = new Set(["/admin/customer-engagement","/admin/send","/admin/window"]);
    const branchUnsafe = new Set(["/admin/customer-engagement","/admin/send","/admin/window"]);
    if (session && role !== "admin" && branchUnsafe.has(route)) fail(403, "Branch-specific permissions require customer-to-branch assignment.");
    if (session && role !== "admin" && (adminOnly.has(route) || (role !== "operator" && operatorOnly.has(route)))) fail(403, "Your staff role does not permit this action.");
    if (req.method === "GET" && route === "/admin/calling-panel") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Calling requires branch-scoped authorization.");
      if (role === "viewer") fail(403, "Viewer accounts cannot access calling.");
      const html = await fs.promises.readFile(path.join(__dirname, "staffCalling.html"), "utf8");
      const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
      const scriptHash = crypto.createHash("sha256").update(script).digest("base64");
      res.writeHead(200, {
        ...securityHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'unsafe-inline'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'`
      });
      return res.end(html);
    }
    if (req.method === "GET" && route === "/admin/customer-lookup") {
      if (role !== "admin") fail(403, "Customer data is restricted until branch ownership is configured.");
      if (!session) fail(401, "Your session expired. Sign in again.");
      const phone = url.searchParams.get("phone") || "";
      if (!/^[+()\d\s-]{7,24}$/.test(phone)) fail(400, "Enter a valid phone number.");
      const customer = findCustomer(await getApplications(), phone);
      return respond(res, 200, { customer });
    }
    if (req.method === "GET" && route === "/admin/security-audit") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      return respond(res, 200, { events: recentAudit(), persistent: false });
    }
    if (req.method === "GET" && route === "/admin/customer-status-report") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Cross-branch data is restricted until branch ownership is configured.");
      return respond(res, 200, { ...customerStatusReport(await getApplications()), updatedAt: new Date().toISOString() });
    }
    if (req.method === "GET" && route === "/admin/province-city-report") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Cross-branch data is restricted until branch ownership is configured.");
      const rows = await getApplications();
      return respond(res, 200, { provinces: provinceCityReport(rows), updatedAt: new Date().toISOString() });
    }
    if (req.method === "POST" && ["/admin/branch-create","/admin/branch-edit","/admin/franchise-transfer"].includes(route)) {
      if (!session || role !== "admin") fail(403, "Head office access required.");
      if (!process.env.DATABASE_URL) fail(503, "Central database is not configured.");
      if (req.headers["x-admin-request"] !== session.csrf) fail(403, "Invalid request token.");
      const payload = await readJSON(req);
      await centralDb.initializeDatabase();
      if (route === "/admin/branch-create") {
        await centralDb.createBranch(payload);
      } else if (route === "/admin/branch-edit") {
        await centralDb.editBranch(payload);
      } else {
        await centralDb.transferFranchise(payload.franchiseId, payload.parentBusinessCenterId || null);
      }
      return respond(res, 200, { ok: true });
    }
    if (req.method === "POST" && route === "/admin/subscription-set") {
      if (!session || role !== "admin") fail(403, "Head office access required.");
      if (req.headers["x-admin-request"] !== session.csrf) fail(403, "Invalid request token.");
      if (!process.env.DATABASE_URL) fail(503, "Central database is not configured.");
      const { branchId, status } = await readJSON(req);
      await centralDb.initializeDatabase();
      const updated = await centralDb.setSubscription(branchId, status);
      recordAudit("subscription.update", "success", updated.id + ":" + updated.subscription_status);
      return respond(res, 200, { updated });
    }
    if (req.method === "GET" && route === "/admin/network-explorer") {
      if (!session) fail(401, "Sign in required.");
      let directory;
      let staff;
      if (process.env.DATABASE_URL) {
        await centralDb.initializeDatabase();
        directory = (await centralDb.branchList()).map(b => ({id:b.id,city:b.city,location:b.location,province:b.province||"",branchType:b.branch_type,parentBusinessCenterId:b.parent_business_center_id,subscriptionStatus:b.subscription_status}));
        staff = await centralDb.staffList();
      } else {
        directory = branches();
        staff = safeStaffList();
      }
      // Never trust a client-provided center ID: derive the scope from the authenticated staff identity.
      if (role !== "admin") {
        const centerId = session.identity?.branchId;
        const center = directory.find(b => b.id === centerId && b.branchType === "business_center");
        if (!center) fail(403, "Business Center access required.");
        const permitted = new Set([center.id, ...directory.filter(b => b.branchType === "franchise" && b.parentBusinessCenterId === center.id).map(b => b.id)]);
        directory = directory.filter(b => permitted.has(b.id));
        staff = staff.filter(s => permitted.has(s.branchId || s.branch_id));
      }
      return respond(res, 200, {branches:directory,staff:staff.map(s=>({id:s.id,role:s.role,branchId:s.branchId||s.branch_id})),provinceCoverage:directory.every(b=>Boolean(b.province))});
    }
    if (req.method === "GET" && route === "/admin/head-office-summary") {
      if (!session || role !== "admin") fail(403, "Head office access required.");
      const directory = branchSummary(safeStaffList());
      return respond(res, 200, {
        totalBranches: directory.length,
        totalStaff: directory.reduce((sum, branch) => sum + branch.staffCount, 0),
        availableStaffSlots: directory.reduce((sum, branch) => sum + branch.staffLimit - branch.staffCount, 0),
        cities: [...new Set(directory.map(branch => branch.city))].length,
        branches: directory
      });
    }
    if (req.method === "GET" && route === "/admin/branches") {
      if (!session || role !== "admin") fail(403, "Head office access required.");
      if (process.env.DATABASE_URL) {
        await centralDb.initializeDatabase();
        const records = await centralDb.branchList();
        return respond(res, 200, { branches: records.map(b => ({ id:b.id,city:b.city,location:b.location,branchType:b.branch_type,parentBusinessCenterId:b.parent_business_center_id,staffCount:b.staff_count,staffLimit:4,subscriptionStatus:b.subscription_status })) });
      }
      return respond(res, 200, { branches: branchSummary(safeStaffList()) });
    }
    if (req.method === "GET" && route === "/admin/staff-ids") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Head office access required.");
      return respond(res, 200, { staff: safeStaffList(), source: "ADMIN_STAFF_ACCOUNTS" });
    }
    if (req.method === "GET" && route === "/admin/calling-logs") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Cross-branch data is restricted until branch ownership is configured.");
      return respond(res, 200, { calls: recentCallLogs(), persistent: false });
    }
    if (req.method === "GET" && route === "/admin/backup-export") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      const rows = await getApplications();
      recordAudit("applications.backup", "success", `${rows.length} rows`);
      return respond(res, 200, { format: "FCS-Applications-Backup-v1", exportedAt: new Date().toISOString(), source: "Franchise_Applications", rows }, { "Content-Disposition": 'attachment; filename="fcs-applications-backup.json"' });
    }
    if (req.method === "GET" && route === "/admin/cost-monitoring") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Cross-branch data is restricted until branch ownership is configured.");
      return respond(res, 200, usageSummary());
    }
    if (req.method === "GET" && route === "/admin/message-activity") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Cross-branch data is restricted until branch ownership is configured.");
      return respond(res, 200, { messages: recentDeliveryStatuses(), note: "Recent in-memory activity only; not a permanent archive." });
    }
    if (req.method === "GET" && route === "/admin/delivery") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (role !== "admin") fail(403, "Cross-branch data is restricted until branch ownership is configured.");
      const id = url.searchParams.get("id") || "";
      if (!/^wamid\.[A-Za-z0-9_=.%-]{8,512}$/.test(id)) fail(400, "Invalid message ID.");
      const status = deliveryStatus(id);
      if (!status) fail(404, "Message status unavailable or expired.");
      return respond(res, 200, { status: status.status, updatedAt: status.updatedAt, errorCode: status.errorCode });
    }
    if (req.method === "GET" && route === "/admin/session") {
      if (!session) return respond(res, 200, { signedIn: false });
      return respond(res, 200, { signedIn: true, csrf: session.csrf, templates, identity: session.identity });
    }

    if (req.method !== "POST" ||
        !["/admin/login", "/admin/logout", "/admin/window", "/admin/send", "/admin/customer-engagement", "/admin/staff-login", "/admin/branch-create", "/admin/branch-edit", "/admin/franchise-transfer"].includes(route)) {
      fail(404, "Page not found.");
    }

    const site = req.headers["sec-fetch-site"];
    if ((site && site !== "same-origin" && site !== "none") || !req.headers["x-admin-request"]) {
      fail(403, "Cross-origin request denied.");
    }
    if (route === "/admin/staff-login") {
      if (req.headers["x-admin-request"] !== "login") fail(403, "Invalid sign-in request.");
      const { id, password } = await readJSON(req);
      const staff = await authenticateStaff(id,password);
      recordAudit("staff.login", staff ? "success" : "failed", typeof id === "string" ? id.slice(0,32) : "invalid");
      if (!staff) fail(401, "Invalid staff credentials.");
      return respond(res, 200, { authenticated: true, staff, note: "Credential check only; staff dashboard sessions are not enabled." });
    }
    if (route === "/admin/login") {
      if (req.headers["x-admin-request"] !== "login") fail(403, "Invalid sign-in request.");
      return await login(req, res, token);
    }

    if (!session) fail(401, "Your session expired. Sign in again.");
    if (req.headers["x-admin-request"] !== session.csrf) fail(403, "Invalid session request.");
    if (route === "/admin/logout") {
      recordAudit("admin.logout", "success");
      sessions.delete(token);
      return respond(res, 200, { signedIn: false }, { "Set-Cookie": cookie("", 0) });
    }
    if (route === "/admin/customer-engagement") {
      const data = await readJSON(req);
      const rowNumber = data.rowNumber;
      const stage = data.stage;
      const nextDate = data.nextDate || "";
      if (!Number.isSafeInteger(rowNumber) || rowNumber < 2 || rowNumber > 1000000 ||
          typeof stage !== "string" || !/^[\\p{L}\\p{N} ._()/-]{1,80}$/u.test(stage) ||
          typeof nextDate !== "string" || (nextDate && !/^\\d{4}-\\d{2}-\\d{2}$/.test(nextDate))) fail(400, "Invalid engagement details.");
      const rows = await getApplications();
      if (rowNumber > rows.length || !Array.isArray(rows[rowNumber - 1]) || !rows[rowNumber - 1].some(v => String(v ?? "").trim())) fail(404, "Application row not found.");
      await updateEngagement(rowNumber, stage.trim(), nextDate);
      recordAudit("customer.engagement", "success", "row " + rowNumber);
      return respond(res, 200, { saved: true, rowNumber });
    }
    if (route === "/admin/window") {
      const number = recipient((await readJSON(req)).number);
      checkRecipient(number, "template");
      return respond(res, 200, { expires: windowExpiry(number) });
    }

    return await send(req, res, session, token);
  } catch (error) {
    req.resume();
    if (!res.destroyed && !res.headersSent) {
      respond(res, error.status || 500, {
        error: error.status ? error.message : "Admin request failed. Try again."
      });
    }
  }
}

module.exports = { adminDashboard };
