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

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const randomLetter =
    letters[Math.floor(Math.random() * letters.length)];

  const randomDigit =
    Math.floor(Math.random() * 10);

  const randomNumbers =
    Math.floor(10000000 + Math.random() * 90000000);

  return (
    randomLetter +
    randomDigit +
    "FCS" +
    randomNumbers
  );
}

  
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
