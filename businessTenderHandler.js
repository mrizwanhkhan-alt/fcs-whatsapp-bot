
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

const NAYAPAY = {
  title: "FCS Express Logistics & Transport (SMC Pvt.) Ltd.",
  account: "7857160208925714",
  iban: "PK53NAYA7857160208925714",
  id: "fcsexpresspakistan@nayapay"
};

const sessions = new Map();

const tabs = {
  business: "City_Business_Center_Applications",
  tender: "Tender_Applications"
};

const basicFields = [
  ["Applicant / Company Name", "درخواست گزار / کمپنی کا نام"],
  ["City", "شہر"],
  ["Mobile / WhatsApp", "موبائل / واٹس ایپ نمبر"],
  ["Email Address", "ای میل ایڈریس"],
  ["Business / Experience Details", "کاروبار / تجربے کی تفصیلات"]
];

const paymentFields = [
  ["Payment Reference / Transaction ID", "ادائیگی کا ریفرنس / ٹرانزیکشن آئی ڈی"],
  ["Payment Date", "ادائیگی کی تاریخ"]
];

function tenderMenu(lang) {
  const heading = lang === "ur"
    ? "📋 FCS EXPRESS — 10 ٹینڈرز\n\nٹینڈر نمبر منتخب کریں:\n\n"
    : "📋 FCS EXPRESS — 10 TENDERS\n\nSelect Tender Number:\n\n";

  return heading +
    TENDERS.map((t, i) =>
      `${i + 1}. ${t[0]}\n${t[1]}`
    ).join("\n\n") +
    "\n\n0 = Main Menu";
}

function paymentInstructions(lang) {
  if (lang === "ur") {
    return `💳 ٹینڈر دستاویزات کی ادائیگی

Tender Document Fee: PKR 20,000
Non-Refundable

NayaPay

Account Title:
${NAYAPAY.title}

Account Number:
${NAYAPAY.account}

IBAN:
${NAYAPAY.iban}

NayaPay ID:
${NAYAPAY.id}

ادائیگی کے بعد Transaction ID اور تاریخ فراہم کریں۔

نوٹ: ادائیگی کی تصدیق کمپنی کرے گی۔`;
  }

  return `💳 TENDER DOCUMENT PAYMENT

Tender Document Fee: PKR 20,000
Non-Refundable

NayaPay

Account Title:
${NAYAPAY.title}

Account Number:
${NAYAPAY.account}

IBAN:
${NAYAPAY.iban}

NayaPay ID:
${NAYAPAY.id}

After payment, provide your Transaction ID and Payment Date.

Note: Payment is subject to company verification.`;
}

function fieldsFor(session) {
  return session.kind === "tender"
    ? [...basicFields, ...paymentFields]
    : basicFields;
}

function promptField(session) {
  const field = fieldsFor(session)[session.step];

  if (!field) return "";

  return session.lang === "ur"
    ? `براہِ کرم درج کریں:\n${field[1]}\n\n0 = Cancel`
    : `Please enter:\n${field[0]}\n\n0 = Cancel`;
}

function startBusiness(number, lang) {
  const session = {
    kind: "business",
    lang,
    step: 0,
    values: []
  };

  sessions.set(number, session);

  return `${lang === "ur"
    ? "🏢 FCS سٹی بزنس سینٹر درخواست\n\nسیکیورٹی ڈپازٹ کمپنی پالیسی کے مطابق ہوگا۔"
    : "🏢 FCS CITY BUSINESS CENTER APPLICATION\n\nSecurity deposit applies according to company policy."}

${promptField(session)}`;
}

function startTender(number, lang, choice) {
  const index = Number(choice) - 1;

  if (!Number.isInteger(index) ||
      index < 0 ||
      index >= TENDERS.length) {
    return tenderMenu(lang);
  }

  const session = {
    kind: "tender",
    lang,
    step: 0,
    values: [],
    tender: TENDERS[index]
  };

  sessions.set(number, session);

  return `${lang === "ur"
    ? "📋 FCS ٹینڈر درخواست"
    : "📋 FCS TENDER APPLICATION"}

${TENDERS[index][0]}
Tender No: ${TENDERS[index][1]}

${paymentInstructions(lang)}

${promptField(session)}`;
}

async function ensureTab(tab) {
  const spreadsheetId = config.GOOGLE_SHEET_ID;

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });

  const exists = (response.data.sheets || []).some(
    s => s.properties.title === tab
  );

  if (exists) return;

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
  } catch (error) {
    const check = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title"
    });

    const created = (check.data.sheets || []).some(
      s => s.properties.title === tab
    );

    if (!created) throw error;
  }

  const headers = [
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
    "Tender Purchase Verification",
    "Payment Method",
    "Payment Reference",
    "Payment Date"
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A1:O1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [headers]
    }
  });
}

async function save(session, number) {
  const tab = tabs[session.kind];

  await ensureTab(tab);

  const applicationNo = await generateApplicationNumber();
  const isTender = session.kind === "tender";
  const values = session.values;

  const row = [
    new Date().toISOString(),
    applicationNo,
    isTender ? session.tender[0] : "City Business Center",
    isTender ? session.tender[1] : "",
    number,
    values[0] || "",
    values[1] || "",
    values[2] || "",
    values[3] || "",
    values[4] || "",
    "Pending Review",
    isTender ? "Not Verified" : "Not Applicable",
    isTender ? "NayaPay - Claimed" : "",
    isTender ? (values[5] || "") : "",
    isTender ? (values[6] || "") : ""
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: `'${tab}'!A:O`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });

  return applicationNo;
}

async function handle(number, text) {
  const session = sessions.get(number);

  if (!session) return null;

  const value = String(text || "").trim();

  if (value === "0") {
    sessions.delete(number);

    return {
      done: true,
      reply: session.lang === "ur"
        ? "درخواست منسوخ کر دی گئی۔\n0 = Main Menu"
        : "Application cancelled.\n0 = Main Menu"
    };
  }

  const fields = fieldsFor(session);

  if (session.step < fields.length) {
    if (!value || value.length > 500) {
      return {
        done: false,
        reply: promptField(session)
      };
    }

    session.values.push(value);
    session.step++;
  }

  if (session.step < fields.length) {
    return {
      done: false,
      reply: promptField(session)
    };
  }

  try {
    const applicationNo = await save(session, number);

    sessions.delete(number);

    const tenderStatus = session.kind === "tender"
      ? "\nPayment Status: Not Verified"
      : "";

    return {
      done: true,
      reply: `${session.lang === "ur"
        ? "آپ کی درخواست موصول ہو گئی ہے اور Google Sheets میں محفوظ کر دی گئی ہے۔"
        : "Your application has been received and saved."}

Application No: ${applicationNo}
Status: Pending Review${tenderStatus}

${session.lang === "ur"
  ? "مین مینو کے لیے 0 بھیجیں۔"
  : "Reply 0 for Main Menu."}`
    };
  } catch (error) {
    console.error("Business / Tender Save Error:", error);

    return {
      done: false,
      reply: session.lang === "ur"
        ? "ریکارڈ محفوظ نہیں ہوا۔ دوبارہ کوئی پیغام بھیج کر کوشش کریں۔"
        : "Record could not be saved. Send another message to retry."
    };
  }
}

module.exports = {
  TENDERS,
  NAYAPAY,
  tenderMenu,
  startBusiness,
  startTender,
  handle,
  isActive: number => sessions.has(number)
};

