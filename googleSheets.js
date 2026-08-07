const { google } = require("googleapis");
const config = require("./config");

const serviceAccount = JSON.parse(
  process.env.GOOGLE_SERVICE_ACCOUNT
);

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

async function generateApplicationNumber() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const letter =
    letters[Math.floor(Math.random() * letters.length)];

  const digit =
    Math.floor(Math.random() * 10);

  const numbers =
    Math.floor(
      10000000 +
      Math.random() * 90000000
    );

  return letter + digit + "FCS" + numbers;
}

async function getRows(sheetName, range) {
  const response =
    await sheets.spreadsheets.values.get({
      spreadsheetId: config.GOOGLE_SHEET_ID,
      range: `${sheetName}!${range}`
    });

  return response.data.values || [];
}

// ========================================
// SAVE FRANCHISE
// ========================================

async function appendApplication(row) {
  const rows =
    await getRows(
      "Franchise_Applications",
      "A:T"
    );

  const nextRow = rows.length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `Franchise_Applications!A${nextRow}:T${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}

// ========================================
// SAVE SUPPLIER
// ========================================

async function appendSupplier(row) {
  const rows =
    await getRows(
      "General_Suppliers",
      "A:Q"
    );

  const nextRow = rows.length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `General_Suppliers!A${nextRow}:Q${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}

// ========================================
// SAVE TRANSPORT
// ========================================

async function appendTransport(row) {
  const rows =
    await getRows(
      "Transport_Partners",
      "A:T"
    );

  const nextRow = rows.length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `Transport_Partners!A${nextRow}:T${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}

// ========================================
// SAVE WAREHOUSE
// ========================================

async function appendWarehouse(row) {
  const rows =
    await getRows(
      "Warehouse_Truck_Adda",
      "A:V"
    );

  const nextRow = rows.length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `Warehouse_Truck_Adda!A${nextRow}:V${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row]
    }
  });
}

// ========================================
// DUPLICATE CHECK
// ========================================

function normalizeNumber(number) {
  return String(number || "")
    .replace(/\D/g, "");
}

async function checkNumber(
  sheetName,
  range,
  columnIndex,
  number
) {
  const rows =
    await getRows(sheetName, range);

  const target =
    normalizeNumber(number);

  if (!target) return false;

  for (let i = 1; i < rows.length; i++) {
    const saved =
      normalizeNumber(
        rows[i][columnIndex]
      );

    if (
      saved &&
      saved === target
    ) {
      return true;
    }
  }

  return false;
}

async function numberExists(number) {
  return checkNumber(
    "Franchise_Applications",
    "A:T",
    5,
    number
  );
}

async function supplierExists(number) {
  return checkNumber(
    "General_Suppliers",
    "A:Q",
    4,
    number
  );
}

async function transportExists(number) {
  return checkNumber(
    "Transport_Partners",
    "A:T",
    4,
    number
  );
}

async function warehouseExists(number) {
  return checkNumber(
    "Warehouse_Truck_Adda",
    "A:V",
    4,
    number
  );
}

// ========================================
// READ ALL APPLICATION TYPES
// ========================================

async function getApplications() {
  return getRows(
    "Franchise_Applications",
    "A:T"
  );
}

async function getSuppliers() {
  return getRows(
    "General_Suppliers",
    "A:Q"
  );
}

async function getTransports() {
  return getRows(
    "Transport_Partners",
    "A:T"
  );
}

async function getWarehouses() {
  return getRows(
    "Warehouse_Truck_Adda",
    "A:V"
  );
}

// ========================================
// UPDATE ENGAGEMENT
// ========================================

async function updateEngagement(
  rowNumber,
  stage,
  nextDate
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `Franchise_Applications!R${rowNumber}:T${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        stage,
        new Date().toLocaleString(),
        nextDate
      ]]
    }
  });
}

async function updateSupplierEngagement(
  rowNumber,
  stage,
  nextDate
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `General_Suppliers!N${rowNumber}:P${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        stage,
        new Date().toLocaleString(),
        nextDate
      ]]
    }
  });
}

async function updateTransportEngagement(
  rowNumber,
  stage,
  nextDate
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `Transport_Partners!Q${rowNumber}:S${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        stage,
        new Date().toLocaleString(),
        nextDate
      ]]
    }
  });
}

async function updateWarehouseEngagement(
  rowNumber,
  stage,
  nextDate
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range:
      `Warehouse_Truck_Adda!S${rowNumber}:U${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        stage,
        new Date().toLocaleString(),
        nextDate
      ]]
    }
  });
}

module.exports = {
  sheets,
  generateApplicationNumber,
  appendApplication,
  appendSupplier,
  appendTransport,
  appendWarehouse,
  getApplications,
  getSuppliers,
  getTransports,
  getWarehouses,
  numberExists,
  supplierExists,
  transportExists,
  warehouseExists,
  updateEngagement,
  updateSupplierEngagement,
  updateTransportEngagement,
  updateWarehouseEngagement
};
