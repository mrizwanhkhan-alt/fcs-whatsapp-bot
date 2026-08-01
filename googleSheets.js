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

module.exports = {
  sheets
};
