"use strict";

// Durable staff overrides live in a dedicated tab of the configured Google Sheet.
// Never store passwords or access tokens here.
const { sheets } = require("./googleSheets");
const { GOOGLE_SHEET_ID } = require("./config");
const TAB = "FCS_Staff_Settings";
let queue = Promise.resolve();
const validId = id => typeof id === "string" && /^[A-Za-z0-9_-]{3,40}$/.test(id);
function error(message) { return Object.assign(new Error(message), { status: 503 }); }

async function ensureTab() {
  if (!GOOGLE_SHEET_ID) throw error("Google Sheet is not configured for persistent settings.");
  const meta = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID, fields: "sheets(properties(title))" });
  if ((meta.data.sheets || []).some(s => s.properties?.title === TAB)) return;
  try {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: GOOGLE_SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } });
  } catch (e) {
    const refreshed = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID, fields: "sheets(properties(title))" });
    if (!(refreshed.data.sheets || []).some(s => s.properties?.title === TAB)) throw e;
  }
}

async function listSettings() {
  await ensureTab();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: GOOGLE_SHEET_ID, range: "'FCS_Staff_Settings'!A2:F" });
  const result = new Map();
  for (const row of response.data.values || []) {
    if (!validId(row[0])) continue;
    const calling = row[1] === "TRUE";
    result.set(row[0], {
      calling, recording: calling && row[2] === "TRUE",
      active: row[3] === "TRUE", startsAt: row[4] || "", expiresAt: row[5] || ""
    });
  }
  return result;
}

async function saveSettings(id, settings) {
  if (!validId(id) || typeof settings.calling !== "boolean" || typeof settings.recording !== "boolean" ||
      typeof settings.active !== "boolean" || (settings.recording && !settings.calling) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(settings.startsAt) || !/^\d{4}-\d{2}-\d{2}$/.test(settings.expiresAt)) {
    throw Object.assign(new Error("Invalid staff settings."), { status: 400 });
  }
  const job = async () => {
    const existing = await listSettings();
    existing.set(id, settings);
    const values = [["Staff ID", "Calling", "Recording", "Active", "Starts At UTC", "Expires At UTC"],
      ...Array.from(existing, ([key, value]) => [key, value.calling ? "TRUE" : "FALSE",
        value.recording ? "TRUE" : "FALSE", value.active ? "TRUE" : "FALSE",
        value.startsAt, value.expiresAt])];
    await sheets.spreadsheets.values.update({ spreadsheetId: GOOGLE_SHEET_ID,
      range: "'FCS_Staff_Settings'!A1:F", valueInputOption: "RAW", requestBody: { values } });
    return settings;
  };
  const next = queue.then(job);
  queue = next.catch(() => {});
  return next;
}

module.exports = { listSettings, saveSettings };
