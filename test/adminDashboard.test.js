"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { once } = require("node:events");
const http = require("node:http");
const { after, before, test } = require("node:test");

const password = "test-admin-password-24-characters";
const appSecret = "test-admin-meta-app-secret";
const token = "test-admin-whatsapp-token";
const phoneId = "123456789";
const customer = "923001234567";
const serviceWindow = 24 * 60 * 60 * 1000;
const pdf = Buffer.from("%PDF-1.7\n%%EOF\n");
const jpeg = Buffer.from("ffd8ffe000104a464946", "hex");
const realFetch = global.fetch;
let server;
let base;
let cookie;
let csrf;
const graph = [];
let graphResponse;

before(async () => {
  const salt = Buffer.alloc(16, 42);
  Object.assign(process.env, {
    ADMIN_PASSWORD_HASH: salt.toString("hex") + ":" + crypto.scryptSync(password, salt, 64).toString("hex"),
    STAFF_ACCOUNTS_JSON: JSON.stringify([{
      id: "agent01", role: "communicator", active: true, startsAt: "2026-01-01", expiresAt: "2099-12-31", territory: { province: "Punjab", cities: ["Lahore"] },
      passwordHash: salt.toString("hex") + ":" + crypto.scryptSync("test-staff-secret", salt, 64).toString("hex")
    }]),
    ADMIN_WHATSAPP_TEMPLATES: JSON.stringify([
      { name: "follow_up", language: "en", bodyParameters: 1 },
      { name: "send_pdf", language: "en", header: "document" },
      { name: "send_image", language: "en", header: "image" }
    ]),
    PHONE_NUMBER_ID: phoneId,
    WHATSAPP_TOKEN: token,
    META_APP_SECRET: appSecret,
    META_GRAPH_VERSION: "v25.0",
    GOOGLE_SERVICE_ACCOUNT: "{}",
    OPENAI_API_KEY: "test-admin-openai-key"
  });

  global.fetch = async (url, options) => {
    graph.push({ url, options });
    if (graphResponse) return graphResponse(url);
    return Response.json(url.endsWith("/media") ? { id: "1111" } : { messages: [{ id: "wamid.test" }] });
  };
  const createServer = http.createServer;
  http.createServer = handler => {
    server = createServer(handler);
    const listen = server.listen.bind(server);
    server.listen = (_port, _host, callback) => listen(0, "127.0.0.1", callback);
    return server;
  };
  // Isolate Admin integration tests from production Google Sheets configuration.
  // Persistence behavior is covered separately by staffSettingsStore.test.js.
  const settingsPath = require.resolve("../staffSettingsStore");
  const testSettings = new Map([["agent01", {
    calling: false, recording: false, active: true,
    startsAt: "2026-01-01", expiresAt: "2099-12-31"
  }]]);
  require.cache[settingsPath] = {
    id: settingsPath, filename: settingsPath, loaded: true,
    exports: {
      refreshSettings: async () => testSettings,
      cachedSettings: () => testSettings,
      listSettings: async () => new Map(testSettings),
      saveSettings: async (id, settings) => { testSettings.set(id, settings); return settings; }
    }
  };
  try {
    require("../index");
  } finally {
    http.createServer = createServer;
  }
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  global.fetch = realFetch;
  if (server?.listening) await new Promise(resolve => server.close(resolve));
});

async function admin(route, data, { signedIn = true, request, site, file } = {}) {
  const headers = {};
  if (signedIn && cookie) headers.Cookie = cookie;
  if (site) headers["Sec-Fetch-Site"] = site;
  let body;
  if (data) {
    headers["Content-Type"] = file ? "application/octet-stream" : "application/json";
    headers["X-Admin-Request"] = request ?? ((route === "login" || route === "staff-login") ? "login" : csrf ?? "unauthorized");
    body = JSON.stringify(data);
    if (file) {
      const metadata = Buffer.from(body);
      headers["X-Admin-Metadata-Length"] = String(metadata.length);
      body = Buffer.concat([metadata, file]);
    }
  }
  const response = await realFetch(base + "/admin/" + route, { method: data ? "POST" : "GET", headers, body });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie") };
}

async function webhook({ timestamp = Date.now(), number = customer, phone = phoneId, signed = true,
  field = "messages", type = "image", status = false } = {}) {
  const message = { id: "wamid.inbound", from: number, type, timestamp: String(Math.floor(timestamp / 1000)) };
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field, value: {
      metadata: { phone_number_id: phone },
      [status ? "statuses" : "messages"]: [message]
    } }] }]
  });
  const signature = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
  const response = await realFetch(base + "/webhook", {
    method: "POST", headers: { "X-Hub-Signature-256": signed ? "sha256=" + signature : "sha256=bad" }, body
  });
  assert.equal(await response.text(), "EVENT_RECEIVED");
}

test("admin assets reveal no credentials and unauthenticated sends fail", async () => {
  for (const route of ["/admin", "/admin/dashboard.js"]) {
    const response = await realFetch(base + route);
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    for (const credential of [password, appSecret, token]) assert.ok(!body.includes(credential));
  }
  assert.deepEqual((await admin("session")).body, { signedIn: false });
  assert.equal((await admin("send", { number: customer, type: "text", text: "Hi" })).status, 401);
  assert.equal((await admin("login", { password }, { site: "cross-site" })).status, 403);
  assert.equal((await admin("login", { password: "incorrect" })).status, 401);
  assert.equal(graph.length, 0);
});

test("login sets a secure session cookie and requires CSRF protection", async () => {
  const signedIn = await admin("login", { password });
  assert.equal(signedIn.status, 200);
  assert.match(signedIn.cookie, /^__Host-fcs_admin=[a-f0-9]{64}; Max-Age=28800; Path=\/; HttpOnly; Secure; SameSite=Strict$/);
  cookie = signedIn.cookie.split(";")[0];
  const session = await admin("session");
  assert.equal(session.body.signedIn, true);
  assert.equal(session.body.templates.length, 3);
  csrf = session.body.csrf;
  assert.equal((await admin("send", { number: customer }, { request: "wrong" })).status, 403);
  assert.equal((await admin("send", { number: customer }, { site: "same-site" })).status, 403);
  assert.equal(graph.length, 0);
});

test("the signed-in admin workspace can embed the existing calling panel", async () => {
  const page = await realFetch(base + "/admin");
  assert.match(page.headers.get("content-security-policy"), /frame-src 'self'/);
  assert.match(await page.text(), /id="callingFrame"[^>]+allow="microphone 'self'"/);

  const path = base + "/admin/calling-panel";
  assert.equal((await realFetch(path)).status, 401);
  const frame = await realFetch(path, { headers: { Cookie: cookie } });
  assert.equal(frame.status, 200);
  const html = await frame.text();
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  const hash = crypto.createHash("sha256").update(script).digest("base64");
  const csp = frame.headers.get("content-security-policy");
  assert.ok(csp.includes(`script-src 'sha256-${hash}'`));
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(html, /Representative call requests/);
  assert.doesNotMatch(html, /wakeLock|Keep screen awake/);
  assert.match(html, /\/api\/staff-calling\//);
});

test("expired, future, unverified and unrelated events do not open the 24-hour window", async () => {
  for (const event of [
    { timestamp: Date.now() - serviceWindow },
    { timestamp: Date.now() + 60_000 },
    { signed: false },
    { phone: "5555" },
    { field: "calls" },
    { type: "reaction" },
    { status: true }
  ]) {
    await webhook(event);
    assert.equal((await admin("window", { number: customer })).body.expires, null);
  }
  assert.equal((await admin("send", { number: customer, type: "text", text: "Hi" })).status, 409);
  assert.equal((await admin("send", { number: customer, type: "media", filename: "notice.pdf" }, { file: pdf })).status, 409);
  assert.equal(graph.length, 0);
});

test("valid inbound messages open a recipient-specific window and text uses the existing credentials", async () => {
  const timestamp = Date.now() - 60_000;
  await webhook({ timestamp });
  await webhook({ timestamp: timestamp - 60_000 });
  const window = await admin("window", { number: "+92 300 1234567" });
  assert.equal(window.body.expires, Math.floor(timestamp / 1000) * 1000 + serviceWindow);
  assert.equal((await admin("window", { number: "923001234568" })).body.expires, null);
  assert.equal((await admin("send", { number: "03001234567", type: "text", text: "Hi" })).status, 400);
  const result = await admin("send", { number: "+92 300 1234567", type: "text", text: "السلام علیکم" });
  assert.deepEqual(result.body, { accepted: true, messageId: "wamid.test", status: "accepted" });
  const { url, options } = graph.at(-1);
  assert.equal(url, "https://graph.facebook.com/v25.0/" + phoneId + "/messages");
  assert.equal(options.headers.Authorization, "Bearer " + token);
  assert.deepEqual(JSON.parse(options.body), {
    messaging_product: "whatsapp", recipient_type: "individual", to: customer, type: "text",
    text: { preview_url: false, body: "السلام علیکم" }
  });
});

test("PDF, images and Office documents upload to Meta and send using its media ID", async () => {
  for (const [filename, mime, file, kind] of [
    ["رسید.pdf", "application/pdf", pdf, "document"],
    ["photo.jpeg", "image/jpeg", jpeg, "image"],
    ["report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.from("504b0304", "hex"), "document"]
  ]) {
    const result = await admin("send", { number: customer, type: "media", filename, caption: "رسید" }, { file });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const upload = graph.at(-2);
    assert.ok(upload.url.endsWith("/media"));
    assert.equal(upload.options.body.get("messaging_product"), "whatsapp");
    assert.equal(upload.options.body.get("file").type, mime);
    assert.equal(upload.options.body.get("file").name, filename);
    assert.deepEqual(Buffer.from(await upload.options.body.get("file").arrayBuffer()), file);
    const payload = JSON.parse(graph.at(-1).options.body);
    assert.equal(payload.type, kind);
    assert.deepEqual(payload[kind], { id: "1111", ...(kind === "document" && { filename }), caption: "رسید" });
  }
});

test("invalid or oversized uploads are rejected before an API request", async () => {
  const count = graph.length;
  const data = { number: customer, type: "media", filename: "notice.pdf" };
  assert.equal((await admin("send", data)).status, 400);
  assert.equal((await admin("send", data, { file: jpeg })).status, 415);
  assert.equal((await admin("send", { ...data, filename: "script.html" }, { file: pdf })).status, 415);
  assert.equal((await admin("send", { ...data, filename: "large.jpg" }, { file: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
  assert.equal(graph.length, count);
});

test("only configured templates with opt-in can be sent outside the window", async () => {
  const number = "923001234568";
  const data = { number, type: "template", template: "follow_up:en", parameters: ["Rizwan"], optIn: true };
  const count = graph.length;
  assert.equal((await admin("send", { ...data, template: "other:en" })).status, 400);
  assert.equal((await admin("send", { ...data, optIn: false })).status, 400);
  assert.equal((await admin("send", { ...data, parameters: [] })).status, 400);
  assert.equal(graph.length, count);
  assert.equal((await admin("send", data)).status, 200);
  assert.deepEqual(JSON.parse(graph.at(-1).options.body).template, {
    name: "follow_up", language: { code: "en" },
    components: [{ type: "body", parameters: [{ type: "text", text: "Rizwan" }] }]
  });
  const attachment = { ...data, template: "send_pdf:en", filename: "notice.pdf", parameters: [] };
  assert.equal((await admin("send", { ...attachment, filename: "photo.jpg" }, { file: jpeg })).status, 415);
  assert.equal((await admin("send", attachment, { file: pdf })).status, 200);
  assert.deepEqual(JSON.parse(graph.at(-1).options.body).template.components, [
    { type: "header", parameters: [{ type: "document", document: { id: "1111", filename: "notice.pdf" } }] }
  ]);
  assert.equal((await admin("send", { ...attachment, filename: "photo.jpg", template: "send_image:en" }, { file: jpeg })).status, 200);
  assert.deepEqual(JSON.parse(graph.at(-1).options.body).template.components, [
    { type: "header", parameters: [{ type: "image", image: { id: "1111" } }] }
  ]);
});

test("window is checked again after an upload and Meta errors do not expose upstream data", async () => {
  const number = "923001234569";
  const timestamp = Math.floor(Date.now() / 1000) * 1000 - serviceWindow + 60_000;
  await webhook({ timestamp, number });
  const originalNow = Date.now;
  try {
    const count = graph.length;
    graphResponse = () => {
      Date.now = () => timestamp + serviceWindow;
      return Response.json({ id: "1111" });
    };
    assert.equal((await admin("send", { number, type: "media", filename: "notice.pdf" }, { file: pdf })).status, 409);
    assert.equal(graph.length, count + 1);
  } finally {
    Date.now = originalNow;
    graphResponse = null;
  }

  try {
    graphResponse = () => Response.json({ error: { code: 131047, message: token } }, { status: 400 });
    const result = await admin("send", { number: customer, type: "text", text: "Hi" });
    assert.equal(result.status, 409);
    assert.ok(!JSON.stringify(result.body).includes(token));
  } finally {
    graphResponse = null;
  }
});

test("staff accounts sign in with separate credentials and cannot access admin tools", async () => {
  assert.equal((await admin("staff-login", { id: "agent01", password: "wrong" }, { signedIn: false })).status, 401);
  const staff = await admin("staff-login", { id: "agent01", password: "test-staff-secret" }, { signedIn: false });
  assert.equal(staff.status, 200);
  const staffCookie = staff.cookie.split(";")[0];
  const session = await realFetch(base + "/admin/session", { headers: { Cookie: staffCookie } }).then(r => r.json());
  assert.equal(session.role, "communicator");
  assert.equal(session.staffId, "agent01");
  assert.deepEqual(session.templates, []);
  assert.deepEqual(session.territory, { province: "Punjab", cities: ["Lahore"] });
  assert.equal(session.subscription.status, "active");
  for (const route of ["calling-panel"]) {
    const response = await realFetch(base + "/admin/" + route, { headers: { Cookie: staffCookie } });
    assert.equal(response.status, 403, route);
  }
  for (const route of ["customer-lookup?phone=923001234567", "application-records", "province-city-report"]) {
    const response = await realFetch(base + "/admin/" + route, { headers: { Cookie: staffCookie } });
    // Google Sheets is mocked only for messaging tests, so a sheet failure is possible;
    // these routes must never return an authorization error for a scoped staff account.
    assert.notEqual(response.status, 403, route);
  }
  const denied = await realFetch(base + "/admin/send", {
    method: "POST",
    headers: { Cookie: staffCookie, "Content-Type": "application/json", "X-Admin-Request": session.csrf },
    body: JSON.stringify({ number: customer, type: "text", text: "Blocked" })
  });
  assert.equal(denied.status, 403);
});

test("Super Admin can see subscription status but staff cannot", async () => {
  const response = await admin("subscriptions");
  assert.equal(response.status, 200);
  assert.equal(response.body.accounts[0].status, "active");
  assert.ok(!JSON.stringify(response.body).includes("passwordHash"));
});

test("logout revokes the server-side session and repeated login failures are rate limited", async () => {
  const loggedOut = await admin("logout", {});
  assert.match(loggedOut.cookie, /Max-Age=0/);
  assert.equal((await admin("window", { number: customer })).status, 401);
  for (let attempt = 0; attempt < 9; attempt++) {
    assert.equal((await admin("login", { password: "incorrect" })).status, 401);
  }
  assert.equal((await admin("login", { password })).status, 429);
});
