"use strict";

const { PHONE_NUMBER_ID, WHATSAPP_TOKEN } = require("./config");
const { isVerifiedMetaWebhook } = require("./callingRoutes");
const { normalizeNumber } = require("./staffCalling");
const { isBlocked } = require("./blockedUsers");

const WINDOW_MS = 24 * 60 * 60 * 1000;
const IMAGE_LIMIT = 5 * 1024 * 1024;
const DOCUMENT_LIMIT = 20 * 1024 * 1024;
const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
};
const INBOUND_TYPES = new Set([
  "audio", "button", "contacts", "document", "image", "interactive",
  "location", "sticker", "text", "video"
]);
const graphVersion = process.env.META_GRAPH_VERSION || "v25.0";
const graphConfigured = /^\d+$/.test(PHONE_NUMBER_ID) &&
  Boolean(WHATSAPP_TOKEN) && /^v\d+\.\d+$/.test(graphVersion);
const windows = new Map();
const deliveryStatuses = new Map();
const MAX_DELIVERY_STATUSES = 5000;

function recentDeliveryStatuses(limit = 50) {
  return [...deliveryStatuses.entries()].slice(-Math.min(100, Math.max(1, limit))).reverse().map(([messageId, entry]) => ({ messageId, number: entry.number || "", status: entry.status, updatedAt: entry.updatedAt, errorCode: entry.errorCode }));
}

function deliveryStatus(id) {
  return deliveryStatuses.get(id) || null;
}

function saveDeliveryStatus(id, value) {
  if (!id || typeof id !== "string") return;
  const previous = deliveryStatuses.get(id) || {};
  deliveryStatuses.delete(id);
  deliveryStatuses.set(id, { ...previous, ...value });
  while (deliveryStatuses.size > MAX_DELIVERY_STATUSES) {
    deliveryStatuses.delete(deliveryStatuses.keys().next().value);
  }
}

let nextPrune = 0;

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function recordAdminWindows(data, rawBody, signature) {
  if (data?.object !== "whatsapp_business_account" ||
      !PHONE_NUMBER_ID || !isVerifiedMetaWebhook(rawBody, signature)) return;

  const now = Date.now();
  if (now >= nextPrune) {
    for (const [number, expiry] of windows) {
      if (expiry <= now) windows.delete(number);
    }
    nextPrune = now + 60_000;
  }
  for (const entry of data.entry || []) {
    for (const { field, value } of entry.changes || []) {
      if (field !== "messages" || value?.metadata?.phone_number_id !== PHONE_NUMBER_ID) continue;
      for (const status of value.statuses || []) {
        if (typeof status.id !== "string" || !deliveryStatuses.has(status.id)) continue;
        if (!["sent", "delivered", "read", "failed"].includes(status.status)) continue;
        const errors = Array.isArray(status.errors) ? status.errors : [];
        const code = Number.isInteger(errors[0]?.code) ? errors[0].code : null;
        saveDeliveryStatus(status.id, {
          status: status.status,
          updatedAt: new Date().toISOString(),
          errorCode: code
        });
      }
      for (const message of value.messages || []) {
        if (!INBOUND_TYPES.has(message.type) || typeof message.id !== "string" ||
            typeof message.from !== "string" || !/^[1-9]\d{7,14}$/.test(message.from) ||
            !/^\d{10}$/.test(String(message.timestamp))) continue;

        const sentAt = Number(message.timestamp) * 1000;
        const expiry = sentAt + WINDOW_MS;
        if (sentAt > now || expiry <= now || expiry <= (windows.get(message.from) || 0)) continue;
        windows.delete(message.from);
        windows.set(message.from, expiry);
        if (windows.size > 50_000) windows.delete(windows.keys().next().value);
      }
    }
  }
}

function approvedTemplates() {
  if (!process.env.ADMIN_WHATSAPP_TEMPLATES) return [];
  try {
    const configured = JSON.parse(process.env.ADMIN_WHATSAPP_TEMPLATES);
    if (!Array.isArray(configured) || configured.length > 50) throw new Error();
    const seen = new Set();
    return configured.map(({ name, language, header = "", bodyParameters = 0 }) => {
      const key = `${name}:${language}`;
      if (typeof name !== "string" || !/^[a-z0-9_]{1,128}$/.test(name) ||
          typeof language !== "string" || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language) ||
          !["", "image", "document"].includes(header) ||
          !Number.isInteger(bodyParameters) || bodyParameters < 0 || bodyParameters > 20 ||
          seen.has(key)) throw new Error();
      seen.add(key);
      return { key, name, language, header, bodyParameters };
    });
  } catch {
    console.error("Invalid ADMIN_WHATSAPP_TEMPLATES configuration; templates are disabled.");
    return [];
  }
}

const templates = approvedTemplates();

function recipient(number) {
  return normalizeNumber(typeof number === "string" ? number.replace(/[ ()-]/g, "") : number);
}

function windowExpiry(number) {
  const expiry = windows.get(number);
  return expiry > Date.now() ? expiry : null;
}

function checkRecipient(number, type) {
  if (isBlocked(number)) fail(403, "This WhatsApp number is blocked.");
  if (type !== "template" && !windowExpiry(number)) {
    fail(409, "No verified 24-hour window. Use an approved template or wait for the customer to reply.");
  }
}

function field(value, max, message, required = false) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    fail(400, message);
  }
  return value.trim();
}

function prepareMessage(input) {
  if (!graphConfigured) fail(503, "WhatsApp messaging is unavailable on this server.");
  const number = recipient(input.number);
  const { type } = input;
  if (!["text", "media", "template"].includes(type)) fail(400, "Choose a message type.");
  checkRecipient(number, type);

  if (type === "text") {
    const body = field(input.text, 4096, "Enter a message of up to 4,096 characters.", true);
    return { number, type, payload: { type, text: { body, preview_url: false } } };
  }
  if (type === "media") {
    const caption = field(input.caption, 1024, "Use a caption of up to 1,024 characters.");
    return { number, type, caption };
  }

  const template = templates.find(item => item.key === input.template);
  if (!template) fail(400, "Select a configured, Meta-approved template.");
  if (input.optIn !== true) fail(400, "Confirm the customer opted in to WhatsApp messages.");
  const parameters = input.parameters;
  if (!Array.isArray(parameters) || parameters.length !== template.bodyParameters) {
    fail(400, "Fill in all of the template fields.");
  }
  const body = parameters.map(value => ({
    type: "text",
    text: field(value, 1024, "Enter a value of up to 1,024 characters for each template field.", true)
  }));
  return { number, type, template, body };
}

function attachment(name) {
  const filename = field(name, 150, "Use a filename of up to 150 characters.", true);
  if (/[\u0000-\u001f\u007f/\\]/.test(filename)) fail(400, "Invalid filename.");
  const extension = filename.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase();
  const mime = extension && MIME_TYPES[extension];
  if (!mime) fail(415, "Choose a JPG, PNG, PDF, TXT, Word, Excel or PowerPoint file.");
  const kind = mime.startsWith("image/") ? "image" : "document";
  return { filename, mime, kind, limit: kind === "image" ? IMAGE_LIMIT : DOCUMENT_LIMIT };
}

function checkFile(file, bytes) {
  const signatures = {
    "image/jpeg": "ffd8ff",
    "image/png": "89504e470d0a1a0a",
    "application/pdf": "255044462d"
  };
  const signature = signatures[file.mime];
  const start = bytes.subarray(0, 8).toString("hex");
  if (!bytes.length || (signature && !start.startsWith(signature)) ||
      (file.mime.includes("officedocument") && !start.startsWith("504b0304")) ||
      (["application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint"].includes(file.mime) &&
        start !== "d0cf11e0a1b11ae1") ||
      (file.mime === "text/plain" && !bufferIsText(bytes))) {
    fail(415, "The file contents do not match the selected format.");
  }
}

function bufferIsText(bytes) {
  try {
    return !new TextDecoder("utf-8", { fatal: true }).decode(bytes).includes("\0");
  } catch {
    return false;
  }
}

async function graph(endpoint, body) {
  let response;
  let result;
  try {
    const headers = { Authorization: `Bearer ${WHATSAPP_TOKEN}` };
    if (typeof body === "string") headers["Content-Type"] = "application/json";
    response = await fetch(`https://graph.facebook.com/${graphVersion}/${PHONE_NUMBER_ID}/${endpoint}`, {
      method: "POST", headers, body, redirect: "error", signal: AbortSignal.timeout(25_000)
    });
    result = await response.json();
  } catch {
    fail(502, endpoint === "messages"
      ? "Could not confirm Meta accepted the message. Check before retrying."
      : "Could not upload the file to WhatsApp. Try again.");
  }
  if (!response.ok || result?.error) {
    const code = result?.error?.code;
    if (code === 131047) {
      fail(409, "Meta reports the 24-hour window is closed. Use an approved template.");
    }
    const reference = Number.isInteger(code) ? ` (code ${code})` : "";
    fail(502, `WhatsApp rejected the ${endpoint === "media" ? "upload" : "message"}${reference}.`);
  }
  return result;
}

async function sendAdminMessage(message, file, bytes, authorized) {
  const { number, type, template, body, caption } = message;
  let payload = message.payload;
  let media;
  if (file) {
    if (!authorized()) fail(401, "Your session expired. Sign in again.");
    checkFile(file, bytes);
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("type", file.mime);
    form.set("file", new Blob([bytes], { type: file.mime }), file.filename);
    checkRecipient(number, type);
    const uploaded = await graph("media", form);
    if (typeof uploaded?.id !== "string" || !/^\d+$/.test(uploaded.id)) {
      fail(502, "WhatsApp did not confirm the file upload.");
    }
    media = { id: uploaded.id };
    if (file.kind === "document") media.filename = file.filename;
  }

  if (type === "media") {
    if (caption) media.caption = caption;
    payload = { type: file.kind, [file.kind]: media };
  }
  if (template) {
    const components = [];
    if (media) components.push({
      type: "header", parameters: [{ type: template.header, [template.header]: media }]
    });
    if (body.length) components.push({ type: "body", parameters: body });
    payload = {
      type,
      template: { name: template.name, language: { code: template.language }, components }
    };
  }

  if (!authorized()) fail(401, "Your session expired. Sign in again.");
  checkRecipient(number, type);
  const result = await graph("messages", JSON.stringify({
    messaging_product: "whatsapp", recipient_type: "individual", to: number, ...payload
  }));
  if (typeof result?.messages?.[0]?.id !== "string") {
    fail(502, "Could not confirm Meta accepted the message. Check before retrying.");
  }
  const messageId = result.messages[0].id;
  saveDeliveryStatus(messageId, { number, status: "accepted", updatedAt: new Date().toISOString(), errorCode: null });
  return { messageId };
}

module.exports = {
  attachment, checkRecipient, deliveryStatus, recentDeliveryStatuses, fail, prepareMessage, recipient, recordAdminWindows,
  sendAdminMessage, templates, windowExpiry
};
