"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const {
  attachment, checkRecipient, deliveryStatus, fail, prepareMessage, recipient,
  sendAdminMessage, templates, windowExpiry
} = require("./adminMessaging");

const { getApplications } = require("./googleSheets");
const { provinceCityReport } = require("./provinceCityReport");
const { findCustomer } = require("./customerLookup");
const { territoryOf, filterRows } = require("./staffTerritory");
const { subscriptionOf } = require("./staffSubscription");

const COOKIE = "__Host-fcs_admin";
const SESSION_MS = 8 * 60 * 60 * 1000;
const LOGIN_INTERVAL = 5 * 60 * 1000;
const LOGIN_LIMIT = 10;
const MAX_REQUEST_BYTES = 32 * 1024;
const scrypt = promisify(crypto.scrypt);
const credential = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(process.env.ADMIN_PASSWORD_HASH || "");
// STAFF_ACCOUNTS_JSON: [{"id":"agent1","role":"communicator","passwordHash":"<salt>:<scrypt>"}]
// Never store plaintext staff passwords or expose account hashes to browsers.
function staffAccounts() {
  let entries;
  try { entries = JSON.parse(process.env.STAFF_ACCOUNTS_JSON || "[]"); } catch { return []; }
  if (!Array.isArray(entries) || entries.length > 100) return [];
  const ids = new Set();
  const allowed = new Set(["business_center", "franchise", "communicator"]);
  const accounts = [];
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || !/^[a-zA-Z0-9_-]{3,40}$/.test(entry.id) ||
        ids.has(entry.id) || !allowed.has(entry.role)) return [];
    const hash = /^([a-f0-9]{32}):([a-f0-9]{128})$/.exec(entry.passwordHash || "");
    if (!hash || !territoryOf(entry)) return [];
    ids.add(entry.id);
    accounts.push({ id: entry.id, role: entry.role, hash, territory: territoryOf(entry), subscription: subscriptionOf(entry), permissions: { calling: entry.permissions?.calling === true, recording: entry.permissions?.recording === true && entry.permissions?.calling === true } });
  }
  return accounts;
}
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
  if (session?.expires > Date.now()) {
    if (session.role === "super_admin") return session;
    const account = staffAccounts().find(item => item.id === session.staffId);
    if (account && account.role === session.role && account.subscription.status === "active" &&
        JSON.stringify(account.territory) === JSON.stringify(session.territory) &&
        account.hash[2] === session.passwordHash) return session;
  }
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
  if (!credential) fail(503, "Admin login is awaiting server configuration.");

  const now = Date.now();
  while (loginAttempts.length && loginAttempts[0].at <= now - LOGIN_INTERVAL) loginAttempts.shift();
  if (loginAttempts.length >= LOGIN_LIMIT) {
    return respond(res, 429, { error: "Too many sign-in attempts. Try again in five minutes." }, {
      "Retry-After": String(Math.ceil((loginAttempts[0].at + LOGIN_INTERVAL - now) / 1000))
    });
  }
  const { password } = await readJSON(req);
  if (typeof password !== "string" || !password || password.length > 256) {
    fail(400, "Enter your admin password.");
  }
  // Reserve an attempt before starting the asynchronous password check.
  const attemptTime = { at: Date.now() };
  if (loginAttempts.length >= LOGIN_LIMIT) fail(429, "Too many sign-in attempts. Try again in five minutes.");
  loginAttempts.push(attemptTime);
  const digest = await scrypt(password, Buffer.from(credential[1], "hex"), 64);
  if (!crypto.timingSafeEqual(digest, Buffer.from(credential[2], "hex"))) {
    fail(401, "Incorrect admin password.");
  }

  const attemptIndex = loginAttempts.indexOf(attemptTime);
  if (attemptIndex !== -1) loginAttempts.splice(attemptIndex, 1);
  for (const [id, session] of sessions) {
    if (session.expires <= Date.now()) sessions.delete(id);
  }
  sessions.delete(previousToken);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    csrf: crypto.randomBytes(32).toString("hex"), expires: Date.now() + SESSION_MS, role: "super_admin"
  });
  return respond(res, 200, { signedIn: true }, {
    "Set-Cookie": cookie(token, SESSION_MS / 1000)
  });
}

async function staffLogin(req, res, previousToken) {
  const now = Date.now();
  while (loginAttempts.length && loginAttempts[0].at <= now - LOGIN_INTERVAL) loginAttempts.shift();
  if (loginAttempts.length >= LOGIN_LIMIT) fail(429, "Too many sign-in attempts. Try again in five minutes.");
  const { id, password } = await readJSON(req);
  if (typeof id !== "string" || typeof password !== "string" ||
      id.length > 40 || !id || !password || password.length > 256) fail(400, "Enter staff ID and password.");
  loginAttempts.push({ at: now });
  const account = staffAccounts().find(item => item.id === id);
  // Use a dummy scrypt hash when the staff ID does not exist to reduce account enumeration.
  const hash = account?.hash || [null, Buffer.alloc(16).toString("hex"), Buffer.alloc(64).toString("hex")];
  const digest = await scrypt(password, Buffer.from(hash[1], "hex"), 64);
  if (!account || !crypto.timingSafeEqual(digest, Buffer.from(hash[2], "hex"))) {
    fail(401, "Incorrect staff ID or password.");
  }
  if (account.subscription.status !== "active") fail(403, "Staff account is disabled, not yet active or expired.");
  loginAttempts.pop();
  sessions.delete(previousToken);
  for (const [key, value] of sessions) if (value.expires <= Date.now()) sessions.delete(key);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, {
    csrf: crypto.randomBytes(32).toString("hex"),
    expires: Date.now() + SESSION_MS, role: account.role, staffId: account.id, territory: account.territory, passwordHash: account.hash[2]
  });
  return respond(res, 200, { signedIn: true }, { "Set-Cookie": cookie(token, SESSION_MS / 1000) });
}

function callingAccess(req) {
  const session = activeSession(tokenFrom(req));
  if (!session) return null;
  if (session.role === "super_admin") return { role: "super_admin", calling: true, recording: false };
  const account = staffAccounts().find(item => item.id === session.staffId);
  if (!account || account.role !== session.role || account.subscription.status !== "active") return null;
  return { role: account.role, calling: account.permissions.calling, recording: account.permissions.recording, staffId: account.id };
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
    if (req.method === "GET" && route === "/admin/calling-panel") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (!callingAccess(req)?.calling) fail(403, "Calling permission is disabled for this account.");
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
      if (!session) fail(401, "Your session expired. Sign in again.");
      const phone = url.searchParams.get("phone") || "";
      if (!/^\+?[0-9 ()-]{8,24}$/.test(phone)) fail(400, "Enter a valid customer phone number.");
      const rows = await getApplications();
      const customer = findCustomer(session.role === "super_admin" ? rows : filterRows(rows, session.territory), phone);
      if (customer && session.role !== "super_admin") {
        // Filtered row positions are not original sheet row numbers; avoid exposing misleading indices.
        delete customer.rowNumber;
      }
      return respond(res, 200, { found: Boolean(customer), customer });
    }
    if (req.method === "GET" && route === "/admin/application-records") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      const rows = await getApplications();
      const records = rows.slice(1).map((row, index) => ({
        rowNumber: index + 2,
        province: String(row?.[8] ?? "").trim(),
        city: String(row?.[9] ?? "").trim(),
        stage: String(row?.[17] ?? "").trim() || "Not contacted"
      })).filter(row => (row.province || row.city || row.stage !== "Not contacted") &&
        (session.role === "super_admin" || (session.territory &&
          filterRows([[], rows[row.rowNumber - 1]], session.territory).length > 1)));
      return respond(res, 200, { total: records.length, records: records.slice(-100).reverse() });
    }
    if (req.method === "GET" && route === "/admin/province-city-report") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      const rows = await getApplications();
      return respond(res, 200, { provinces: provinceCityReport(session.role === "super_admin" ? rows : filterRows(rows, session.territory)), updatedAt: new Date().toISOString() });
    }
    if (req.method === "GET" && route === "/admin/delivery") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (session.role !== "super_admin") fail(403, "This tool requires Super Admin access.");
      const id = url.searchParams.get("id") || "";
      if (!/^wamid\.[A-Za-z0-9_=.%-]{8,512}$/.test(id)) fail(400, "Invalid message ID.");
      const status = deliveryStatus(id);
      if (!status) fail(404, "Message status unavailable or expired.");
      return respond(res, 200, { status: status.status, updatedAt: status.updatedAt, errorCode: status.errorCode });
    }
    if (req.method === "GET" && route === "/admin/subscriptions") {
      if (!session) fail(401, "Your session expired. Sign in again.");
      if (session.role !== "super_admin") fail(403, "Super Admin access required.");
      return respond(res, 200, { accounts: staffAccounts().map(account => ({
        id: account.id, role: account.role, territory: account.territory, permissions: account.permissions, ...account.subscription
      })) });
    }
    if (req.method === "GET" && route === "/admin/session") {
      if (!session) return respond(res, 200, { signedIn: false });
      return respond(res, 200, { signedIn: true, csrf: session.csrf, role: session.role || "super_admin", staffId: session.staffId || null, territory: session.role === "super_admin" ? null : session.territory, subscription: session.role === "super_admin" ? null : staffAccounts().find(item => item.id === session.staffId)?.subscription, callingPermissions: callingAccess(req), templates: session.role === "super_admin" ? templates : [] });
    }

    if (req.method !== "POST" ||
        !["/admin/login", "/admin/staff-login", "/admin/logout", "/admin/window", "/admin/send"].includes(route)) {
      fail(404, "Page not found.");
    }

    const site = req.headers["sec-fetch-site"];
    if ((site && site !== "same-origin" && site !== "none") || !req.headers["x-admin-request"]) {
      fail(403, "Cross-origin request denied.");
    }
    if (route === "/admin/staff-login") {
      if (req.headers["x-admin-request"] !== "login") fail(403, "Invalid sign-in request.");
      return await staffLogin(req, res, token);
    }
    if (route === "/admin/login") {
      if (req.headers["x-admin-request"] !== "login") fail(403, "Invalid sign-in request.");
      return await login(req, res, token);
    }

    if (!session) fail(401, "Your session expired. Sign in again.");
    if (req.headers["x-admin-request"] !== session.csrf) fail(403, "Invalid session request.");
    if (route === "/admin/logout") {
      sessions.delete(token);
      return respond(res, 200, { signedIn: false }, { "Set-Cookie": cookie("", 0) });
    }
    if (session.role !== "super_admin") fail(403, "This tool requires Super Admin access.");
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

module.exports = { adminDashboard, callingAccess };
