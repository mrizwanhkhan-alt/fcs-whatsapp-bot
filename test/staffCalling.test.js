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
