
const { sheets, generateApplicationNumber } = require("./googleSheets");
const config = require("./config");

const TENDERS = [
  ["Logistics & Transport Services", "FCS-TND-2026-LT-A/583"],
  ["IT Hardware & Networking", "FCS-TND-2026-IT-K/247"],
  ["Packaging Materials", "FCS-TND-2026-PK-M/731"],
  ["Security & Safety Equipment", "FCS-TND-2026-SI-C/309"],
  ["Office Furniture & Fixtures", "FCS-TND-2026-OF-D/842"],
  ["Cleaning & Hygiene Supplies", "FCS-TND-2026-CL-E/602"],
  ["Office Stationery & Printing Materials", "FCS-TND-2026-OS-F/519"],
  ["Uniforms, Rider Gear & Branded Accessories", "FCS-TND-2026-UG-B/418"],
  ["Signboards, LED Logos & Branding Solutions", "FCS-TND-2026-SG-S/419"],
  ["Gifts, Flowers & General Merchandise", "FCS-TND-2026-GM-G/420"]
];

const sessions = new Map();

const fields = [
  "Applicant / Company Name",
  "City",
  "Mobile / WhatsApp",
  "Email",
  "Business / Experience Details"
];

const tabs = {
  business: "City_Business_Center_Applications",
  tender: "Tender_Applications"
};

function tenderMenu(lang) {
  const heading = lang === "ur"
    ? "📋 FCS کے 10 ٹینڈرز — نمبر منتخب کریں:"
    : "📋 FCS Tenders — select a number:";

  return heading + "\n\n" +
    TENDERS.map((t, i) =>
      `${i + 1}. ${t[0]} (${t[1]})`
    ).join("\n") +
    "\n\n0 = Main Menu";
}

function promptField(s) {
  const field = fields[s.step];

  return `${s.lang === "ur" ? "درج کریں" : "Please enter"}: ${field}
0 = Cancel`;
}

function startBusiness(number, lang) {
  sessions.set(number, {
    kind: "business",
    lang,
    step: 0,
    values: []
  });

  return `${lang === "ur"
    ? "🏢 سٹی بزنس سینٹر درخواست\nسیکیورٹی ڈپازٹ کمپنی پالیسی کے مطابق ہوگا۔"
    : "🏢 City Business Center Application\nSecurity deposit applies according to company policy."}

${promptField(sessions.get(number))}`;
}

function startTender(number, lang, choice) {
  const index = Number(choice) - 1;

  if (!Number.isInteger(index) ||
      index < 0 ||
      index >= TENDERS.length) {
    return tenderMenu(lang);
  }

  sessions.set(number, {
    kind: "tender",
    lang,
    step: 0,
    values: [],
    tender: TENDERS[index]
  });

  return `${lang === "ur" ? "ٹینڈر درخواست" : "Tender Application"}: ${TENDERS[index][0]}

${lang === "ur"
  ? "درخواست جمع کروانے سے ٹینڈر خریداری کی تصدیق نہیں ہوتی۔"
  : "Submitting this form does not confirm tender purchase."}

${promptField(sessions.get(number))}`;
}

async function ensureTab(tab) {
  const spreadsheetId = config.GOOGLE_SHEET_ID;

  const info = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });

  if ((info.data.sheets || []).some(
    x => x.properties.title === tab
  )) return;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: tab }
          }
        }]
      }
    });
  } catch (err) {
    const latest = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title"
    });

    if (!(latest.data.sheets || []).some(
      x => x.properties.title === tab
    )) throw err;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A1:L1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "Submitted At",
        "Application No",
        "Application Type",
        "Tender No",
        "WhatsApp",
        "Applicant / Company Name",
        "City",
        "Mobile / WhatsApp",
        "Email",
        "Business / Experience Details",
        "Review Status",
        "Tender Purchase Verification"
      ]]
    }
  });
}

async function save(s, number) {
  const tab = tabs[s.kind];

  await ensureTab(tab);

  const id = await generateApplicationNumber();

  const row = [
    new Date().toISOString(),
    id,
    s.kind === "business"
      ? "City Business Center"
      : s.tender[0],
    s.kind === "tender" ? s.tender[1] : "",
    number,
    ...s.values,
    "Pending Review",
    s.kind === "tender"
      ? "Not Verified"
      : "Not Applicable"
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: `'${tab}'!A:L`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });

  return id;
}

async function handle(number, text) {
  const s = sessions.get(number);

  if (!s) return null;

  if (text.trim() === "0") {
    sessions.delete(number);

    return {
      done: true,
      reply: s.lang === "ur"
        ? "درخواست منسوخ۔"
        : "Application cancelled."
    };
  }

  const value = text.trim();

  if (!value || value.length > 500) {
    return {
      done: false,
      reply: `Please enter a valid response.\n${promptField(s)}`
    };
  }

  if (s.step < fields.length) {
    s.values.push(value);
    s.step++;
  }

  if (s.step < fields.length) {
    return {
      done: false,
      reply: promptField(s)
    };
  }

  try {
    const id = await save(s, number);

    sessions.delete(number);

    return {
      done: true,
      reply: `${s.lang === "ur"
        ? "درخواست موصول اور محفوظ ہو گئی۔"
        : "Application received and saved."}

Application No: ${id}
Status: Pending Review
${s.kind === "tender"
  ? "Tender Purchase: Not Verified"
  : ""}
0 = Main Menu`
    };
  } catch (err) {
    console.error("Business/Tender save failed:", err);

    s.step = fields.length;

    return {
      done: false,
      reply: s.lang === "ur"
        ? "ریکارڈ محفوظ نہیں ہوا۔ دوبارہ پیغام بھیج کر کوشش کریں۔"
        : "Could not save the record. Send any message to retry."
    };
  }
}

module.exports = {
  TENDERS,
  tenderMenu,
  startBusiness,
  startTender,
  handle,
  isActive: number => sessions.has(number)
};
