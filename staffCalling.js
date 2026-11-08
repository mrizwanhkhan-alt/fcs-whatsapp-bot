
"use strict";

const https = require("https");
const config = require("./config");

const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";

function graphPost(endpoint, data) {
  return new Promise((resolve, reject) => {
    if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      return reject(new Error("Missing PHONE_NUMBER_ID or WHATSAPP_TOKEN"));
    }

    const payload = JSON.stringify(data);
    const req = https.request({
      hostname: "graph.facebook.com",
      path: `/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/${endpoint}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: 15000
    }, res => {
      let body = "";
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => {
        let result;
        try {
          result = JSON.parse(body);
        } catch {
          return reject(new Error(
            `Meta returned invalid JSON (HTTP ${res.statusCode})`
          ));
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve(result);
        }

        const message =
          result?.error?.message || "Unknown Meta API error";

        reject(new Error(
          `Meta API HTTP ${res.statusCode}: ${message}`
        ));
      });
    });

    req.on("timeout", () =>
      req.destroy(new Error("Meta API request timed out"))
    );
    req.on("error", reject);
    req.end(payload);
  });
}

function normalizeNumber(number) {
  const value = String(number || "")
    .replace(/^\+/, "")
    .trim();

  if (!/^\d{8,15}$/.test(value)) {
    throw new Error(
      "Use an international WhatsApp number, digits only"
    );
  }

  return value;
}

function requestCallPermission(customerNumber) {
  return graphPost("messages", {
    messaging_product: "whatsapp",
    to: normalizeNumber(customerNumber),
    type: "interactive",
    interactive: {
      type: "call_permission_request",
      action: {
        name: "call_permission_request"
      }
    }
  });
}

function connectWhatsAppCall(customerNumber, sdpOffer) {
  if (
    typeof sdpOffer !== "string" ||
    !sdpOffer.includes("v=0")
  ) {
    return Promise.reject(
      new Error("A valid WebRTC SDP offer is required")
    );
  }

  return graphPost("calls", {
    messaging_product: "whatsapp",
    to: normalizeNumber(customerNumber),
    action: "connect",
    session: {
      sdp_type: "offer",
      sdp: sdpOffer
    }
  });
}

module.exports = {
  requestCallPermission,
  connectWhatsAppCall
};
