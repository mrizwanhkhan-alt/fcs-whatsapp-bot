const { google } = require("googleapis");
const config = require("./config");


const serviceAccount =
  JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);



const auth = new google.auth.GoogleAuth({

  credentials: serviceAccount,

  scopes: [
    "https://www.googleapis.com/auth/spreadsheets"
  ]

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
    Math.floor(
      10000000 +
      Math.random() * 90000000
    );



  return (
    randomLetter +
    randomDigit +
    "FCS" +
    randomNumbers
  );

}






// Save Franchise Application

async function appendApplication(row) {


  await sheets.spreadsheets.values.append({

    spreadsheetId:
      config.GOOGLE_SHEET_ID,

    range:
     range: "Franchise_Applications!A1:T",
    valueInputOption:
      "USER_ENTERED",

    requestBody: {

      values: [
        row
      ]

    }

  });

}







// Save General Supplier

async function appendSupplier(row) {


  await sheets.spreadsheets.values.append({

    spreadsheetId:
      config.GOOGLE_SHEET_ID,

    range:
      "General_Suppliers!A:Q",

    valueInputOption:
      "USER_ENTERED",

    requestBody: {

      values: [
        row
      ]

    }

  });

}







// Save Warehouse & Truck Adda

async function appendWarehouse(row) {


  await sheets.spreadsheets.values.append({

    spreadsheetId:
      config.GOOGLE_SHEET_ID,

    range:
      "Warehouse_Truck_Adda!A:V",

    valueInputOption:
      "USER_ENTERED",

    requestBody: {

      values: [
        row
      ]

    }

  });

}







// Save Transport Partner

async function appendTransport(row) {


  await sheets.spreadsheets.values.append({

    spreadsheetId:
      config.GOOGLE_SHEET_ID,

    range:
      "Transport_Partners!A:T",

    valueInputOption:
      "USER_ENTERED",

    requestBody: {

      values: [
        row
      ]

    }

  });

}








// Read Franchise Applications

async function getApplications() {


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        config.GOOGLE_SHEET_ID,


      range:
        "Franchise_Applications!A:T"

    });



  return response.data.values || [];

}








// Update Follow Up

async function updateEngagement(
  rowNumber,
  stage,
  nextDate
) {


  await sheets.spreadsheets.values.update({

    spreadsheetId:
      config.GOOGLE_SHEET_ID,


    range:
      `Franchise_Applications!R${rowNumber}:T${rowNumber}`,


    valueInputOption:
      "USER_ENTERED",


    requestBody: {

      values: [

        [
          stage,
          new Date().toLocaleString(),
          nextDate
        ]

      ]

    }

  });

}








// Check Duplicate WhatsApp

async function numberExists(whatsapp) {


  const rows =
    await getApplications();



  for (
    let i = 1;
    i < rows.length;
    i++
  ) {


    if (
      (rows[i][5] || "").trim()
      === whatsapp.trim()
    ) {


      return true;

    }

  }



  return false;

}








module.exports = {


  sheets,

  appendApplication,

  appendSupplier,

  appendWarehouse,

  appendTransport,

  numberExists,

  generateApplicationNumber,

  getApplications,

  updateEngagement

};
