"use strict";

const https = require("https");
const { PHONE_NUMBER_ID, WHATSAPP_TOKEN } = require("./config");

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v25.0";

function graphRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
      reject(Object.assign(new Error("Missing WhatsApp API credentials"), { status: 503 }));
      return;
    }

    const payload = data === undefined ? null : JSON.stringify(data);
    const headers = { Authorization: `Bearer ${WHATSAPP_TOKEN}` };
    if (payload) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = https.request({
      hostname: "graph.facebook.com",
      path: `/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/${endpoint}`,
      method: payload ? "POST" : "GET",
      headers
    }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("error", reject);
      res.on("end", () => {
        let result;
        try {
          result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          reject(new Error(`Invalid Meta response: HTTP ${res.statusCode}`));
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300 && result && !result.error) {
          resolve(result);
          return;
        }

        const { message, code } = result?.error || {};
        reject(Object.assign(
          new Error(`Meta API HTTP ${res.statusCode}${code ? ` (${code})` : ""}: ${message || "Unknown error"}`),
          { status: res.statusCode >= 400 ? res.statusCode : 502, code }
        ));
      });
    });

    const timeout = setTimeout(() => {
      req.destroy(Object.assign(new Error("Meta API request timed out"), { status: 504 }));
    }, 15000);
    req.on("close", () => clearTimeout(timeout));
    req.on("error", reject);
    req.end(payload || undefined);
  });
}

function normalizeNumber(number) {
  const value = typeof number === "string" ? number.trim().replace(/^\+/, "") : "";
  if (!/^[1-9]\d{7,14}$/.test(value)) {
    throw Object.assign(new Error("Enter a valid international WhatsApp number."), { status: 400 });
  }
  return value;
}

async function getCallPermission(number) {
  const result = await graphRequest(`call_permissions?user_wa_id=${normalizeNumber(number)}`);
  const permission = result.permission?.status;
  const actions = result.actions || [];
  const action = name => actions.find(item => item.action_name === name)?.can_perform_action;
  const granted = ["temporary", "permanent", "granted"].includes(permission);
  return {
    permission,
    canCall: action("start_call") ?? granted,
    canRequest: action("send_call_permission_request") ?? !granted,
    expiresAt: result.permission?.expiration_time || null
  };
}

function requestCallPermission(number, template) {
  const message = template ? {
    type: "template",
    template: { name: template, language: { code: process.env.CALL_PERMISSION_TEMPLATE_LANGUAGE || "en" } }
  } : {
    type: "interactive",
    interactive: {
      type: "call_permission_request",
      action: { name: "call_permission_request" }
    }
  };
  return graphRequest("messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeNumber(number),
    ...message
  });
}

const REPRESENTATIVE_REQUEST_MINUTES = 60;

function sendRepresentativeCallButton(number, language) {
  const urdu = language === "ur";
  return graphRequest("messages", {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeNumber(number),
    type: "interactive",
    interactive: {
      type: "voice_call",
      body: {
        text: urdu
          ? "آپ کی درخواست ایف سی ایس کو موصول ہو گئی ہے۔ ہمارے نمائندے سے بات کرنے کے لیے نیچے کال کا بٹن دبائیں۔"
          : "FCS has received your request. Tap below to call an FCS representative on WhatsApp."
      },
      action: {
        name: "voice_call",
        parameters: {
          display_text: urdu ? "ایف سی ایس کو کال" : "Call FCS",
          ttl_minutes: REPRESENTATIVE_REQUEST_MINUTES
        }
      }
    }
  });
}

function connectWhatsAppCall(number, sdp, reference) {
  return graphRequest("calls", {
    messaging_product: "whatsapp",
    to: normalizeNumber(number),
    action: "connect",
    session: { sdp_type: "offer", sdp },
    biz_opaque_callback_data: reference
  });
}

function updateWhatsAppCall(callId, action, sdp) {
  return graphRequest("calls", {
    messaging_product: "whatsapp",
    call_id: callId,
    action,
    ...(sdp && { session: { sdp_type: "answer", sdp } })
  });
}

module.exports = {
  normalizeNumber, getCallPermission, requestCallPermission, connectWhatsAppCall, updateWhatsAppCall,
  sendRepresentativeCallButton, REPRESENTATIVE_REQUEST_MINUTES
};
