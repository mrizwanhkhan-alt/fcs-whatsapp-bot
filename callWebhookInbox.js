"use strict";
// Durable intake journal for verified Meta calling webhook events.
// A failed Sheets write rejects intake so Meta can retry instead of losing the event.
const crypto = require("node:crypto");
const { sheets } = require("./googleSheets");
const { GOOGLE_SHEET_ID } = require("./config");
const TAB = "FCS_Call_Webhook_Inbox";
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
let setup;
let queue = Promise.resolve();
async function ensureTab() {
  if (!GOOGLE_SHEET_ID) throw new Error("GOOGLE_SHEET_ID required for durable webhook intake");
  if (!setup) setup = (async () => {
    const meta = await sheets.spreadsheets.get({spreadsheetId: GOOGLE_SHEET_ID, fields:"sheets(properties(title))"});
    if (!(meta.data.sheets || []).some(x => x.properties?.title === TAB)) {
      try {
        await sheets.spreadsheets.batchUpdate({spreadsheetId: GOOGLE_SHEET_ID,
          requestBody:{requests:[{addSheet:{properties:{title:TAB}}}]}});
      } catch (error) {
        const check = await sheets.spreadsheets.get({spreadsheetId: GOOGLE_SHEET_ID,fields:"sheets(properties(title))"});
        if (!(check.data.sheets || []).some(x => x.properties?.title === TAB)) throw error;
      }
      await sheets.spreadsheets.values.update({spreadsheetId: GOOGLE_SHEET_ID,
        range:"'FCS_Call_Webhook_Inbox'!A1:D1",valueInputOption:"RAW",
        requestBody:{values:[["Event Key","Received UTC","Call ID","Payload JSON"]]}});
    }
  })().catch(error => {setup = null;throw error;});
  await setup;
}
async function saveVerifiedEvents(events) {
  if (!events.length) return;
  const job = async () => {
    await ensureTab();
    const result = await sheets.spreadsheets.values.get({spreadsheetId: GOOGLE_SHEET_ID,
      range:"'FCS_Call_Webhook_Inbox'!A2:D"});
    const keys = new Set((result.data.values || []).map(row => row[0]));
    const rows = [];
    for (const event of events) {
      const payload = JSON.stringify(canonical(event));
      const key = crypto.createHash("sha256").update(payload).digest("hex");
      if (keys.has(key)) continue;
      keys.add(key);
      rows.push([key,new Date().toISOString(),String(event.id),payload]);
    }
    if (rows.length) await sheets.spreadsheets.values.append({spreadsheetId: GOOGLE_SHEET_ID,
      range:"'FCS_Call_Webhook_Inbox'!A:D",valueInputOption:"RAW",insertDataOption:"INSERT_ROWS",
      requestBody:{values:rows}});
  };
  const next = queue.then(job);
  queue = next.catch(() => {});
  return next;
}
async function getSavedEvents() {
  await queue;
  await ensureTab();
  const result = await sheets.spreadsheets.values.get({spreadsheetId: GOOGLE_SHEET_ID,
    range:"'FCS_Call_Webhook_Inbox'!A2:D"});
  return (result.data.values || []).flatMap(row => {
    try {return [JSON.parse(row[3])];} catch {return [];}
  });
}
module.exports = {saveVerifiedEvents,getSavedEvents};
