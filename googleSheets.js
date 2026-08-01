const { google } = require("googleapis");
const config = require("./config");

const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

const auth = new google.auth.GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"]
});

const sheets = google.sheets({
  version: "v4",
  auth
});


async function generateApplicationNumber() {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: "B:B"
  });

  const rows = response.data.values || [];

  let lastNumber = 0;

  for (let i = 1; i < rows.length; i++) {

    const value = rows[i][0];

    if (value && value.includes("FCS-FR-")) {

      const num = parseInt(
        value.replace("FCS-FR-", "")
      );

      if (num > lastNumber) {
        lastNumber = num;
      }
    }
  }

  const nextNumber = lastNumber + 1;

  return "FCS-FR-" + String(nextNumber).padStart(5, "0");
}


async function appendApplication(row) {

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: "A:O",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}


async function numberExists(whatsapp) {

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: "A:O"
  });

  const rows = response.data.values || [];

  for (let i = 1; i < rows.length; i++) {

    if ((rows[i][5] || "").trim() === whatsapp.trim()) {
      return true;
    }

  }

  return false;
}


module.exports = {
  sheets,
  appendApplication,
  numberExists,
  generateApplicationNumber
};
