"use strict";

// Append-only call event journal. No audio, tokens or SDP are stored.
const { sheets } = require("./googleSheets");
const { GOOGLE_SHEET_ID } = require("./config");
const TAB = "FCS_Call_History";
let setup;
let queue = Promise.resolve();
function unavailable(message) { return Object.assign(new Error(message), { status: 503 }); }
async function ensureTab() {
  if (!GOOGLE_SHEET_ID) throw unavailable("Call history requires GOOGLE_SHEET_ID.");
  if (!setup) setup = (async () => {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID, fields: "sheets(properties(title))" });
    if (!(meta.data.sheets || []).some(x => x.properties?.title === TAB)) {
      try {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: GOOGLE_SHEET_ID,
          requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } });
      } catch (error) {
        const check = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID, fields: "sheets(properties(title))" });
        if (!(check.data.sheets || []).some(x => x.properties?.title === TAB)) throw error;
      }
      await sheets.spreadsheets.values.update({ spreadsheetId: GOOGLE_SHEET_ID,
        range: "'FCS_Call_History'!A1:J1", valueInputOption: "RAW",
        requestBody: { values: [["Event UTC","Call ID","Staff ID","Session ID","Number","Direction","State","Started UTC","Answered UTC","Ended UTC"]] } });
    }
  })().catch(error => { setup = null; throw error; });
  await setup;
}
async function appendEvent(entry) {
  const job = async () => {
    await ensureTab();
    // Re-read persisted events so retries after a process restart do not duplicate an event.
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID,
      range: "'FCS_Call_History'!A2:J" });
    const eventKey = [entry.id, entry.staffId || "", entry.owner || "", entry.state,
      entry.startedAt || "", entry.answeredAt || "", entry.endedAt || ""].join("|");
    if ((existing.data.values || []).some(row =>
      [row[1],row[2] || "",row[3] || "",row[6],row[7] || "",row[8] || "",row[9] || ""].join("|") === eventKey)) return;
    await sheets.spreadsheets.values.append({ spreadsheetId: GOOGLE_SHEET_ID,
      range: "'FCS_Call_History'!A:J", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[new Date().toISOString(),entry.id,entry.staffId || "",entry.owner || "",
        entry.number,entry.direction,entry.state,entry.startedAt || "",entry.answeredAt || "",entry.endedAt || ""]] } });
  };
  const next = queue.then(job);
  queue = next.catch(() => {});
  return next;
}
async function listHistory({ staffId, owner, superAdmin = false, limit = 100 } = {}) {
  await queue;
  await ensureTab();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID,
    range: "'FCS_Call_History'!A2:J" });
  const latest = new Map();
  for (const row of response.data.values || []) {
    const [eventAt,id,rowStaff,rowOwner,number,direction,state,startedAt,answeredAt,endedAt] = row;
    if (!id || !number) continue;
    if (!superAdmin && (!staffId || rowStaff !== staffId)) continue;
    if (owner && rowOwner !== owner) continue;
    latest.set(id, { id, staffId: rowStaff || null, owner: rowOwner || null, number,
      direction, state, startedAt, answeredAt: answeredAt || null, endedAt: endedAt || null,
      updatedAt: eventAt, durationSeconds: answeredAt && endedAt ? Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(answeredAt)) / 1000)) : null });
  }
  return Array.from(latest.values()).reverse().slice(0, Math.min(Math.max(Number(limit)||100,1),100));
}
module.exports = { appendEvent, listHistory };
