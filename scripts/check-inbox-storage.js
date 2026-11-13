"use strict";

const { randomInt, randomUUID } = require("node:crypto");
const { GOOGLE_SHEET_ID: spreadsheetId } = require("../config");

async function check() {
  if (!spreadsheetId) throw new Error("Google Sheet is not configured.");
  const api = require("../googleSheets").sheets.spreadsheets;
  const sheetId = randomInt(1, 2147483647);
  const token = randomUUID();
  const title = "FCS_Inbox_Check_" + token;
  const batch = requests => api.batchUpdate({ spreadsheetId, requestBody: { requests } }, { retry: false });

  await batch([
    { addSheet: { properties: { title, sheetId, gridProperties: { rowCount: 1, columnCount: 1 } } } },
    { updateCells: {
      start: { sheetId, rowIndex: 0, columnIndex: 0 },
      rows: [{ values: [{ userEnteredValue: { stringValue: token } }] }],
      fields: "userEnteredValue"
    } }
  ]);
  try {
    const result = await api.values.get({ spreadsheetId, range: "'" + title + "'!A1" });
    if (result.data.values?.[0]?.[0] !== token) throw new Error("Readback did not match.");
  } finally {
    try {
      await batch([{ deleteSheet: { sheetId } }]);
    } catch {
      console.error("Could not remove the test tab:", title);
      throw new Error("Test cleanup failed.");
    }
  }
}

check().then(() => {
  console.log("Inbox storage check passed: write, readback and cleanup.");
}).catch(error => {
  console.error("Inbox storage check failed:", error.response?.status || error.code || error.message);
  process.exitCode = 1;
});
