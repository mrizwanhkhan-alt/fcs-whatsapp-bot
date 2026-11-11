"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { EventEmitter, once } = require("node:events");
const http = require("node:http");
const https = require("node:https");
const { after, before, test } = require("node:test");

const secret = "test-staff-secret-at-least-24-characters";
const appSecret = "test-meta-app-secret";
const phoneId = "123456789";
const customer = "923001234567";
const owner = crypto.randomUUID();
const otherOwner = crypto.randomUUID();
const offer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=setup:actpass\r\n";
const answer = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=setup:active\r\n";

let server;
let base;
let permission = "no_permission";
let sent;
let graph;
let onConnect;
let onAction;
let restoreHttps;

before(async () => {
  Object.assign(process.env, {
    PHONE_NUMBER_ID: phoneId,
    WHATSAPP_TOKEN: "test-whatsapp-token",
    META_APP_SECRET: appSecret,
    META_GRAPH_VERSION: "v25.0",
    STAFF_CALLING_SECRET: secret,
    STAFF_CALLING_ICE_SERVERS: "[]",
    CALL_PERMISSION_TEMPLATE_NAME: "approved_call_permission",
    CALL_PERMISSION_TEMPLATE_LANGUAGE: "en",
    GOOGLE_SERVICE_ACCOUNT: "{}",
    OPENAI_API_KEY: "test-openai-key"
  });

  sent = [];
  graph = [];
  const realRequest = https.request;
  restoreHttps = () => { https.request = realRequest; };
  https.request = (options, callback) => {
    assert.equal(options.hostname, "graph.facebook.com");
    const req = new EventEmitter();
    let body = "";
    req.write = chunk => { body += chunk; };
    req.end = (chunk = "") => {
      body += chunk;
      queueMicrotask(async () => {
        const payload = body ? JSON.parse(body) : null;
        graph.push({ options, payload });
        let status = 200;
        let result = { success: true };
        if (options.path.includes("/call_permissions?")) {
          result = {
            permission: { status: permission },
            actions: [
              { action_name: "start_call", can_perform_action: permission === "permanent" },
              { action_name: "send_call_permission_request", can_perform_action: permission !== "permanent" }
            ]
          };
        } else if (options.path.endsWith("/calls")) {
          if (payload.action === "connect") {
            result = await onConnect(payload);
          } else if (onAction) {
            ({ status, result } = await onAction(payload));
          }
        } else if (options.path.endsWith("/messages")) {
          sent.push(payload);
          result = { messages: [{ id: "wamid.test" }] };
        }

        const response = new EventEmitter();
        response.statusCode = status;
        callback(response);
        response.emit("data", JSON.stringify(result));
        response.emit("end");
        req.emit("close");
      });
    };
    req.destroy = error => {
      req.emit("error", error);
      req.emit("close");
    };
    return req;
  };

  const realCreate = http.createServer;
  http.createServer = handler => {
    server = realCreate(handler);
    const listen = server.listen.bind(server);
    server.listen = (_port, _host, callback) => listen(0, "127.0.0.1", callback);
    return server;
  };
  try {
    require("../index");
  } finally {
    http.createServer = realCreate;
  }
  await once(server, "listening");
  base = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  restoreHttps?.();
  if (server?.listening) await new Promise(resolve => server.close(resolve));
});

async function api(route, payload = {}, session = owner, token = secret) {
  const response = await fetch(base + "/api/staff-calling/" + route, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ owner: session, ...payload })
  });
  return { status: response.status, body: await response.json() };
}

function callingChange(events, statuses = [], numberId = phoneId) {
  return { field: "calls", value: { metadata: { phone_number_id: numberId }, calls: events, statuses } };
}

async function webhook(changes, sign = true) {
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes }]
  });
  const signature = crypto.createHmac("sha256", appSecret).update(body).digest("hex");
  const response = await fetch(base + "/webhook", {
    method: "POST",
    headers: { "X-Hub-Signature-256": sign ? "sha256=" + signature : "sha256=invalid" },
    body
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "EVENT_RECEIVED");
}

function incoming(id) {
  return { id, event: "connect", direction: "USER_INITIATED", from: customer, session: { sdp_type: "offer", sdp: offer } };
}

test("staff routes require authorization and calling settings stay private", async () => {
  assert.equal((await api("session", {}, owner, "incorrect")).status, 401);
  const { status, body } = await api("session");
  assert.equal(status, 200);
  assert.deepEqual(body.iceServers, []);
  assert.equal(body.hasTemplate, true);
  assert.equal((await fetch(base + "/staff-calling")).status, 200);
});

test("permission is checked before dialing and requests use the intended message type", async () => {
  const denied = await api("connect", { number: customer, sdp: offer });
  assert.equal(denied.status, 409);
  assert.equal(graph.at(-1).options.path, `/v25.0/${phoneId}/call_permissions?user_wa_id=${customer}`);
  assert.equal(graph.at(-1).options.method, "GET");

  assert.equal((await api("permission", { number: "+" + customer })).body.submitted, true);
  assert.deepEqual(sent.at(-1), {
    messaging_product: "whatsapp", recipient_type: "individual", to: customer,
    type: "interactive", interactive: { type: "call_permission_request", action: { name: "call_permission_request" } }
  });
  assert.equal((await api("permission", { number: customer, useTemplate: true })).body.submitted, true);
  assert.deepEqual(sent.at(-1).template, { name: "approved_call_permission", language: { code: "en" } });

  permission = "permanent";
  assert.equal((await api("permission-status", { number: customer })).body.canCall, true);
  const count = sent.length;
  assert.equal((await api("permission", { number: customer })).body.submitted, false);
  assert.equal(sent.length, count);
});

test("outbound calling consumes webhook SDP and status even before Meta's HTTP reply", async () => {
  const id = "wacid.outbound";
  onConnect = async payload => {
    assert.deepEqual(payload.session, { sdp_type: "offer", sdp: offer });
    await webhook([callingChange([], [{ id, type: "call", status: "RINGING" }])]);
    await webhook([callingChange([{
      id, event: "connect", direction: "BUSINESS_INITIATED", session: { sdp_type: "answer", sdp: answer },
      biz_opaque_callback_data: payload.biz_opaque_callback_data
    }])]);
    return { calls: [{ id }] };
  };
  const { body } = await api("connect", { number: customer, sdp: offer });
  assert.equal(body.id, id);
  assert.equal(body.state, "ringing");
  assert.equal(body.sdp, answer);

  assert.equal((await api("poll", { callId: id }, otherOwner)).body.call.sdp, undefined);
  assert.equal((await api("terminate", { callId: id }, otherOwner)).status, 409);

  await webhook([callingChange([], [{ id, type: "call", status: "ACCEPTED" }])]);
  await webhook([callingChange([], [{ id, type: "call", status: "RINGING" }])]);
  assert.equal((await api("poll", { callId: id })).body.call.state, "accepted");

  await webhook([callingChange([{ id, event: "terminate", status: "COMPLETED" }])]);
  assert.deepEqual((await api("poll", { callId: id })).body.call, { id, number: customer, state: "ended" });
});

test("valid incoming calls can be answered, locked to the answering session and ended after a retry", async () => {
  const id = "wacid.incoming+abc/123=";
  await webhook([callingChange([incoming(id)])], false);
  await webhook([callingChange([incoming(id)], [], "other-phone")]);
  assert.deepEqual((await api("poll")).body.incoming, []);

  await webhook([callingChange([incoming(id), incoming(id)])]);
  assert.deepEqual((await api("poll")).body.incoming, [{ id, number: customer }]);
  assert.equal((await api("offer", { callId: id })).body.sdp, offer);
  assert.equal((await api("accept", { callId: id, sdp: answer })).body.state, "accepted");
  assert.deepEqual(graph.at(-1).payload.session, { sdp_type: "answer", sdp: answer });
  assert.equal((await api("accept", { callId: id, sdp: answer }, otherOwner)).status, 409);

  onAction = async () => ({ status: 503, result: { error: { code: 2, message: "Temporary error" } } });
  assert.equal((await api("terminate", { callId: id })).status, 503);
  assert.equal((await api("poll", { callId: id })).body.call.state, "accepted");
  onAction = undefined;
  assert.equal((await api("terminate", { callId: id })).body.state, "ended");
  assert.equal(graph.at(-1).payload.action, "terminate");
  await webhook([callingChange([incoming(id)])]);
  assert.deepEqual((await api("poll")).body.incoming, []);
});

test("decline and out-of-order termination keep incoming calls off the panel", async () => {
  const declined = "wacid.decline";
  const earlyEnd = "wacid.ended-before-offer";
  await webhook([callingChange([{ id: earlyEnd, event: "terminate" }])]);
  await webhook([callingChange([incoming(declined), incoming(earlyEnd)])]);
  assert.deepEqual((await api("poll")).body.incoming, [{ id: declined, number: customer }]);
  assert.equal((await api("reject", { callId: declined })).body.state, "rejected");
  assert.equal(graph.at(-1).payload.action, "reject");
  assert.deepEqual((await api("poll")).body.incoming, []);
});

test("shared webhook still processes existing messaging alongside call events", async () => {
  const id = "wacid.mixed";
  const oldMessageCount = sent.length;
  await webhook([
    { field: "messages", value: { messages: [
      { from: customer, type: "interactive", interactive: { type: "call_permission_reply" } },
      { from: customer, type: "text", text: { body: "السلام علیکم" } },
      { from: customer, type: "text", text: { body: "2" } },
      { from: customer, type: "text", text: { body: "8" } },
      ...["2", "3", "4", "1", "0"].map(body => ({ from: customer, type: "text", text: { body } }))
    ] } },
    callingChange([incoming(id)])
  ]);
  assert.deepEqual((await api("poll")).body.incoming, [{ id, number: customer }]);
  assert.equal(sent.length, oldMessageCount + 8);
  const [languageMenu, mainMenu, faqMenu, oldTwo, oldThree, oldFour, franchise, returnedMenu] =
    sent.slice(oldMessageCount).map(message => message.text.body);
  assert.match(languageMenu, /Please select your preferred language/);
  assert.match(mainMenu, /ٹینڈرز اور وینڈر مواقع/);
  assert.match(mainMenu, /فری فرنچائز/);
  assert.match(mainMenu, /^🔟 ایف سی ایس کے مجاز نمائندے سے بات کریں$/m);
  assert.match(faqMenu, /اکثر پوچھے جانے والے سوالات/);
  assert.match(faqMenu, /1\. فرنچائز/);
  assert.doesNotMatch(faqMenu, /ٹرانسپورٹ|ویئر ہاؤس|سپلائر|وینڈر/);
  assert.equal(oldTwo, faqMenu);
  assert.equal(oldThree, faqMenu);
  assert.equal(oldFour, faqMenu);
  assert.match(franchise, /فرنچائز/);
  assert.equal(returnedMenu, mainMenu);
});


test("both contact menus highlight the application bot number", async () => {
  const contacts = [
    { from: "923000000001", language: "1" },
    { from: "923000000002", language: "2" }
  ];
  for (const { from, language } of contacts) {
    const count = sent.length;
    await webhook([{ field: "messages", value: { messages: [language, "9"].map(
      body => ({ from, type: "text", text: { body } })
    ) } }]);
    assert.equal(sent.length, count + 2);
    const reply = sent.at(-1).text.body;
    assert.ok(reply.includes("*+92 316 0034207*"));
    assert.ok(reply.includes("info@fcsexpress.com.pk"));
    assert.ok(!reply.includes("042 3246 2221"));
  }
});

test("option 11 acknowledges a verified request and accepts a customer-initiated call", async () => {
  const from = "923000000011";
  const message = { from, type: "text", text: { body: "11" },
    id: "wamid.rep-request", timestamp: String(Math.floor(Date.now() / 1000)) };
  const change = { field: "messages", value: {
    metadata: { phone_number_id: phoneId }, messages: [message]
  } };
  const count = sent.length;
  await webhook([change], false);
  assert.equal(sent.length, count);
  assert.deepEqual((await api("poll")).body.requests, []);
  await webhook([change]);
  await webhook([change]);
  assert.equal(sent.length, count + 1);
  const button = sent.at(-1);
  assert.equal(button.to, from);
  assert.equal(button.interactive.type, "voice_call");
  assert.equal(button.interactive.action.name, "voice_call");
  assert.match(button.interactive.body.text, /received your request/);
  const request = (await api("poll")).body.requests[0];
  assert.equal(request.number, from);
  assert.equal(request.status, "accepted");
  assert.equal((await api("poll", {}, owner, "incorrect")).status, 401);
  await webhook([callingChange([{ ...incoming("wacid.rep-request"), from }])]);
  const panel = (await api("poll")).body;
  assert.ok(panel.incoming.some(call => call.id === "wacid.rep-request" && call.number === from));
});

test("verified first greeting shows the branded image and native language choices", async () => {
  const previousOrigin = process.env.RENDER_EXTERNAL_URL;
  process.env.RENDER_EXTERNAL_URL = "https://fcs-example.onrender.com";
  try {
    for (const [language, from, title] of [
      ["en", "923000000031", "English"],
      ["ur", "923000000032", "اردو"]
    ]) {
      const change = message => ({ field: "messages", value: {
        metadata: { phone_number_id: phoneId }, messages: [{ from, ...message }]
      } });
      await webhook([change({ type: "text", text: { body: "Hi" } })]);
      const welcome = sent.at(-1);
      assert.equal(welcome.type, "interactive");
      assert.equal(welcome.interactive.type, "button");
      assert.equal(welcome.interactive.header.image.link, "https://fcs-example.onrender.com/assets/fcs-welcome-v5.jpg");
      assert.equal(welcome.interactive.body.text, "*Welcome to FCS Express Pakistan*\n*خوش آمدید*\n\n*براہِ کرم اپنی پسند کی زبان منتخب کریں۔*");
      assert.deepEqual(welcome.interactive.action.buttons.map(item => item.reply.title), ["English", "اردو"]);
      const selected = welcome.interactive.action.buttons.find(item => item.reply.title === title);
      assert.ok(selected);
      const image = await fetch(base + new URL(welcome.interactive.header.image.link).pathname);
      assert.equal(image.status, 200);
      assert.equal(image.headers.get("content-type"), "image/jpeg");
      assert.equal(Buffer.from(await image.arrayBuffer()).subarray(0, 3).toString("hex"), "ffd8ff");

      const reply = change({ type: "interactive", interactive: {
        type: "button_reply", button_reply: { id: selected.reply.id }
      } });
      const count = sent.length;
      await webhook([reply], false);
      assert.equal(sent.length, count);
      await webhook([reply]);
      assert.equal(sent.length, count + 1);
      const delivery = { field: "messages", value: {
        metadata: { phone_number_id: phoneId },
        statuses: [{ id: "wamid.test", status: "delivered" }]
      } };
      await webhook([delivery], false);
      assert.equal(sent.length, count + 1);
      await webhook([delivery]);
      assert.equal(sent.length, count + 2);
      const artwork = sent.at(-2);
      assert.equal(artwork.type, "image");
      assert.equal(artwork.image.link, "https://fcs-example.onrender.com/assets/fcs-service-menu.jpg?v=5");
      const banner = await fetch(base + new URL(artwork.image.link).pathname);
      assert.equal(banner.status, 200);
      assert.equal(banner.headers.get("content-type"), "image/jpeg");
      assert.equal(Buffer.from(await banner.arrayBuffer()).subarray(0, 3).toString("hex"), "ffd8ff");
      const menu = sent.at(-1).interactive;
      assert.equal(menu.type, "list");
      assert.equal(menu.header.text, "🔴🔴 FCS Express Pakistan 🔴🔴");
      assert.equal(menu.action.button, language === "en" ? "📋 View services" : "📋 سروسز دیکھیں");
      const rows = menu.action.sections.flatMap(section => section.rows);
      assert.equal(rows.length, 10);
      assert.equal(rows[0].title, language === "en" ? "ℹ️ About FCS Express" : "ℹ️ کمپنی کا تعارف");
      assert.equal(rows[9].title, language === "en" ? "☎️ Talk to our team" : "☎️ نمائندے سے بات کریں");
      assert.ok(rows.every(row => row.title.length <= 24));
      const service = change({ type: "interactive", interactive: {
        type: "list_reply", list_reply: { id: rows[1].id }
      } });
      await webhook([service], false);
      assert.equal(sent.length, count + 2);
      await webhook([service]);
      assert.match(sent.at(-1).text.body, language === "en" ? /FCS SERVICES/ : /خدمات/);
      await webhook([change({ type: "text", text: { body: "Hi" } })]);
      assert.deepEqual(sent.at(-1).interactive, welcome.interactive);
    }
  } finally {
    if (previousOrigin === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = previousOrigin;
  }
});

test("the graphical menu routes the reordered services and rejects duplicate Flow replies", async () => {
  const envName = "FCS_SERVICE_FLOW_EN_ID";
  const previous = process.env[envName];
  process.env[envName] = "12345";
  const from = "923000000059";
  const change = message => ({ field: "messages", value: {
    metadata: { phone_number_id: phoneId }, messages: [{ from, ...message }]
  } });
  try {
    await webhook([change({ type: "text", text: { body: "1" } })]);
    const menu = sent.at(-1);
    assert.equal(menu.interactive.type, "flow");
    const token = menu.interactive.action.parameters.flow_token;
    const choice = change({ type: "interactive", interactive: { type: "nfm_reply",
      nfm_reply: { response_json: JSON.stringify({ flow_token: token, service: "2" }) }
    } });
    const count = sent.length;
    await webhook([choice], false);
    assert.equal(sent.length, count);
    await webhook([choice]);
    assert.match(sent.at(-1).text.body, /FCS SERVICES/);
    await webhook([choice]);
    assert.equal(sent.length, count + 1);

    await webhook([change({ type: "text", text: { body: "0" } })]);
    const nextToken = sent.at(-1).interactive.action.parameters.flow_token;
    await webhook([change({
      id: "wamid.test-flow-call",
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: "interactive",
      interactive: { type: "nfm_reply", nfm_reply: {
        response_json: JSON.stringify({ flow_token: nextToken, service: "10" })
      } }
    })]);
    assert.equal(sent.at(-1).interactive.type, "voice_call");
  } finally {
    if (previous === undefined) delete process.env[envName];
    else process.env[envName] = previous;
  }
});
