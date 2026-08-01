const { google } = require("googleapis");
const config = require("./config");
const serviceAccount = require("./service-account.json");

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({
  version: "v4",
  auth
});

async function appendApplication(row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: "A:N",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}

async function numberExists(whatsapp) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: "A:N"
  });

  const rows = response.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][4] || "").trim() === whatsapp.trim()) {
      return true;
    }
  }

  return false;
}

module.exports = {
  sheets,
  appendApplication,
  numberExists
};
