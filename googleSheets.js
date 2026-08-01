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


// Generate Application Number
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


// Save Application
async function appendApplication(row) {

  await sheets.spreadsheets.values.append({

    spreadsheetId: config.GOOGLE_SHEET_ID,

    range: "A:T",

    valueInputOption: "USER_ENTERED",

    requestBody: {
      values: [row]
    }

  });

}


// Read Applications
async function getApplications() {

  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId: config.GOOGLE_SHEET_ID,

      range: "A:T"

    });


  return response.data.values || [];

}


// Check Duplicate WhatsApp
async function numberExists(whatsapp) {

  const rows = await getApplications();


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
  generateApplicationNumber,
  getApplications

};
