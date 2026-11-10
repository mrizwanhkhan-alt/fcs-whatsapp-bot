"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
const originals = new Map();
const config = { PHONE_NUMBER_ID: "123456789", WHATSAPP_TOKEN: "test-token" };
const statuses = [];
const signature = "sha256=test";
const fakeFetch = async (url, options) => {
  if (url.endsWith("/messages")) return { ok: true, json: async () => ({ messages: [{ id: "wamid.test123456789" }] }) };
  throw new Error("Unexpected Meta API call");
};
test("admin send tracks accepted, verified webhook delivery and failures without touching calling", async () => {
  const oldFetch = global.fetch;
  const oldEnv = process.env.META_GRAPH_VERSION;
  try {
    global.fetch = fakeFetch;
    process.env.META_GRAPH_VERSION = "v25.0";
    Module._load = function (request, parent, isMain) {
      if (parent?.filename?.endsWith("/adminMessaging.js")) {
        if (request === "./config") return config;
        if (request === "./callingRoutes") return { isVerifiedMetaWebhook: (_, sig) => sig === signature };
        if (request === "./staffCalling") return { normalizeNumber: n => n };
        if (request === "./blockedUsers") return { isBlocked: () => false };
      }
      return originalLoad.apply(this, arguments);
    };
    const admin = require("../adminMessaging");
    const message = admin.prepareMessage({ number: "923001234567", type: "text", text: "Test" });
    // Simulate a customer-initiated conversation before sending freeform text.
    const incoming = { object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: config.PHONE_NUMBER_ID },
      messages: [{ id: "wamid.incoming", from: "923001234567", timestamp: String(Math.floor(Date.now() / 1000)), type: "text" }]
    } }] }] };
    admin.recordAdminWindows(incoming, Buffer.from("{}"), signature);
    const result = await admin.sendAdminMessage(message, null, null, () => true);
    assert.equal(result.messageId, "wamid.test123456789");
    assert.equal(admin.deliveryStatus(result.messageId).status, "accepted");
    const webhook = status => ({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: {
      metadata: { phone_number_id: config.PHONE_NUMBER_ID },
      statuses: [{ id: result.messageId, status, errors: status === "failed" ? [{ code: 131026 }] : [] }]
    } }] }] });
    admin.recordAdminWindows(webhook("delivered"), Buffer.from("{}"), "bad-signature");
    assert.equal(admin.deliveryStatus(result.messageId).status, "accepted");
    admin.recordAdminWindows(webhook("delivered"), Buffer.from("{}"), signature);
    assert.equal(admin.deliveryStatus(result.messageId).status, "delivered");
    admin.recordAdminWindows(webhook("failed"), Buffer.from("{}"), signature);
    assert.equal(admin.deliveryStatus(result.messageId).status, "failed");
    assert.equal(admin.deliveryStatus(result.messageId).errorCode, 131026);
  } finally {
    Module._load = originalLoad;
    global.fetch = oldFetch;
    if (oldEnv === undefined) delete process.env.META_GRAPH_VERSION;
    else process.env.META_GRAPH_VERSION = oldEnv;
  }
});
