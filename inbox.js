"use strict";

const { createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const directory = process.env.FCS_INBOX_DIR;
const { GOOGLE_SHEET_ID } = require("./config");
const useSheets = process.env.FCS_INBOX_STORAGE === "sheets";
const configured = useSheets ? Boolean(GOOGLE_SHEET_ID) : Boolean(directory && path.isAbsolute(directory));
const tab = "FCS_WhatsApp_Inbox";

function spreadsheet() {
  return require("./googleSheets").sheets.spreadsheets;
}

async function sheetEvents() {
  const api = spreadsheet();
  const meta = await api.get({ spreadsheetId: GOOGLE_SHEET_ID, fields: "sheets(properties(title))" });
  if (!(meta.data.sheets || []).some(sheet => sheet.properties.title === tab)) {
    await api.batchUpdate({ spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
  }
  const response = await api.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: tab + "!A:A" });
  return (response.data.values || []).map(row => JSON.parse(row[0]));
}
const threads = new Map();
const ids = new Set();
const inboundTypes = new Set([
  "audio", "button", "contacts", "document", "image", "interactive",
  "location", "sticker", "text", "video"
]);
let ready;
let queue = Promise.resolve();

function apply(event) {
  if (event.callRequestFor) {
    ids.add(event.id);
    return;
  }
  const thread = threads.get(event.number) || { name: "", readThrough: 0, messages: [] };
  threads.set(event.number, thread);
  if (event.readThrough !== undefined) {
    thread.readThrough = Math.max(thread.readThrough, event.readThrough);
    return;
  }
  if (ids.has(event.id)) return;
  ids.add(event.id);
  if (event.name) thread.name = event.name;
  thread.messages.push(event);
}

function load() {
  if (!configured) throw Object.assign(new Error("Inbox storage is unavailable."), { status: 503 });
  ready ||= (async () => {
    if (useSheets) {
      const events = await sheetEvents();
      events.forEach(apply);
      return;
    }
    const contents = await fs.readFile(path.join(directory, "inbox.ndjson"), "utf8").catch(error => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const end = contents.lastIndexOf("\n") + 1;
    if (end < contents.length) {
      await fs.truncate(path.join(directory, "inbox.ndjson"), Buffer.byteLength(contents.slice(0, end)));
    }
    for (const line of contents.slice(0, end).split("\n")) {
        if (line) apply(JSON.parse(line));
    }
  })().catch(error => {
    ready = undefined;
    throw error;
  });
  return ready;
}

function write(events) {
  const job = queue.then(async () => {
    await load();
    const batchIds = new Set();
    const pending = events.filter(event => {
      if (event.id === undefined) return true;
      if (ids.has(event.id) || batchIds.has(event.id)) return false;
      batchIds.add(event.id);
      return true;
    });
    if (!pending.length) return;
    if (useSheets) {
      try {
        await spreadsheet().values.append({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: tab + "!A:H",
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: pending.map(event => {
            const journal = JSON.stringify(event);
            if (event.callRequestFor) return [journal, "", "", "", "", "", event.callRequestFor, event.ticket];
            if (event.direction !== "customer") return [journal];
            return [journal, new Date(event.time).toISOString(), event.name, "+" + event.number, event.text, event.id];
          }) }
        }, { retry: false });
      } catch (error) {
        // An interrupted response can hide a successful append. Reload before retrying.
        ready = undefined;
        throw error;
      }
      pending.forEach(apply);
      return;
    }
    const file = await fs.open(path.join(directory, "inbox.ndjson"), "a", 0o600);
    const { size } = await file.stat();
    try {
      await file.writeFile(pending.map(event => JSON.stringify(event) + "\n").join(""));
      await file.sync();
    } catch (error) {
      await file.truncate(size);
      throw error;
    } finally {
      await file.close();
    }
    pending.forEach(apply);
  });
  queue = job.catch(() => {});
  return job;
}

function incoming(data, phoneId) {
  const events = [];
  for (const entry of data.entry || []) {
    for (const { field, value } of entry.changes || []) {
      if (field !== "messages" || value?.metadata?.phone_number_id !== phoneId) continue;
      for (const message of value.messages || []) {
        if (!inboundTypes.has(message.type) || !/^[1-9]\d{7,14}$/.test(message.from) || typeof message.id !== "string" ||
            !/^\d{10}$/.test(String(message.timestamp))) continue;
        const name = value.contacts?.find(contact => contact.wa_id === message.from)?.profile?.name;
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title || message[message.type]?.caption || `[${message.type || "message"}]`;
        events.push({ id: message.id, number: message.from, name: String(name || "").slice(0, 200),
          direction: "customer", text: String(text).slice(0, 4096), time: Number(message.timestamp) * 1000 });
      }
    }
  }
  return events.length ? write(events) : Promise.resolve();
}

async function list() {
  await load();
  return [...threads].map(([number, thread]) => {
    const latest = thread.messages.reduce((last, event) => !last || event.time >= last.time ? event : last, null);
    return { number, name: thread.name, latest: latest.text.slice(0, 180), time: latest.time,
      unread: thread.messages.filter(event => event.direction === "customer" && event.time > thread.readThrough).length };
  }).sort((a, b) => b.time - a.time).slice(0, 100);
}

async function history(number) {
  await load();
  const thread = threads.get(number);
  return (thread?.messages || []).slice().sort((a, b) => a.time - b.time).slice(-100);
}

async function markRead(number, through) {
  if (!Number.isSafeInteger(through) || through <= 0) return;
  const messages = await history(number);
  if (messages.some(event => event.direction === "customer" && event.time === through) &&
      through > (threads.get(number)?.readThrough || 0)) await write([{ number, readThrough: through }]);
}

function outgoing(number, id, text, direction) {
  if (!configured || !id) return;
  return write([{ number, id, direction, text, time: Date.now() }]).catch(() => {
    console.error("Could not save outgoing WhatsApp message to Inbox.");
  });
}

function payloadText(payload) {
  return payload.text?.body || payload.interactive?.body?.text ||
    payload[payload.type]?.caption || (payload.template ? `[Template: ${payload.template.name}]` : `[${payload.type}]`);
}

function windowExpiry(number) {
  const thread = threads.get(number);
  return thread?.messages.reduce((latest, event) => {
    return event.direction === "customer" && event.time <= Date.now() ? Math.max(latest, event.time + 86400000) : latest;
  }, 0) || 0;
}

async function recordCallRequest(message) {
  if (!configured || !useSheets || !message.id) return;
  const ticket = "FCS-CALL-" + createHash("sha256").update(message.id).digest("hex").slice(0, 16).toUpperCase();
  await write([{ id: "call-request:" + message.id, callRequestFor: message.id, ticket }]);
  return ticket;
}

module.exports = { recordCallRequest, configured, load, incoming, outgoing, payloadText, list, history, markRead, windowExpiry };
