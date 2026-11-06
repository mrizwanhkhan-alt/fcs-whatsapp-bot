
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
  ["Applicant / Company Name", "درخواست گزار / کمپنی کا نام", "name"],
  ["City", "شہر", "city"],
  ["Mobile / WhatsApp", "موبائل / واٹس ایپ نمبر", "phone"],
  ["Email Address", "ای میل ایڈریس", "email"],
  ["Business / Experience Details", "کاروبار / تجربے کی تفصیلات", "details"]
];

const paymentFields = [
  ["Payment Reference / Transaction ID", "ادائیگی کا ریفرنس / ٹرانزیکشن آئی ڈی", "reference"],
  ["Payment Date (DD-MM-YYYY)", "ادائیگی کی تاریخ (DD-MM-YYYY)", "date"]
];

function tenderMenu(lang) {
  const heading = lang === "ur"
    ? "📋 FCS EXPRESS — 10 ٹینڈرز\n\nٹینڈر نمبر منتخب کریں:\n\n"
    : "📋 FCS EXPRESS — 10 TENDERS\n\nSelect Tender Number:\n\n";

  return heading + TENDERS.map((t, i) =>
    `${i + 1}. ${t[0]}\n${t[1]}`
  ).join("\n\n") + "\n\n0 = Main Menu";
}

function paymentInstructions(lang) {
  const details = `NayaPay

Account Title:
${NAYAPAY.title}

Account Number:
${NAYAPAY.account}

IBAN:
${NAYAPAY.iban}

NayaPay ID:
${NAYAPAY.id}`;

  return lang === "ur"
    ? `💳 ٹینڈر دستاویزات کی ادائیگی

Tender Document Fee: PKR 20,000
Non-Refundable

${details}

ادائیگی کے بعد Transaction ID اور تاریخ درج کریں۔
ادائیگی کی تصدیق کمپنی کرے گی۔`
    : `💳 TENDER DOCUMENT PAYMENT

Tender Document Fee: PKR 20,000
Non-Refundable

${details}

Enter your Transaction ID and payment date after payment.
Payment is subject to company verification.`;
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

function validate(field, value) {
  const type = field[2];

  if (!value || value.length > 500) return false;

  if (type === "name" || type === "city") {
    const letters = value.match(/[\p{L}]/gu) || [];
    return letters.length >= 2 &&
      !/^[\d\s\W_]+$/u.test(value) &&
      !/(.)\1{5,}/u.test(value);
  }

  if (type === "phone") {
    const cleaned = value.replace(/[\s()-]/g, "");
    return /^(?:\+92|0092|92|0)3\d{9}$/.test(cleaned);
  }

  if (type === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) &&
      value.length <= 254;
  }

  if (type === "details") {
    return value.length >= 10 &&
      /[\p{L}]/u.test(value);
  }

  if (type === "reference") {
    return /^[A-Za-z0-9][A-Za-z0-9/_-]{5,79}$/.test(value) &&
      /[0-9]/.test(value) &&
      !/^(.)\1+$/i.test(value);
  }

  if (type === "date") {
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    if (!match) return false;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) return false;

    const now = new Date();
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    const earliest = Date.UTC(2026, 0, 1);
    const entered = date.getTime();

    return entered >= earliest && entered <= today;
  }

  return true;
}

function validationError(session) {
  const field = fieldsFor(session)[session.step];
  const type = field[2];
  const ur = session.lang === "ur";

  const messages = {
    name: ur
      ? "درست نام درج کریں، صرف نمبر قبول نہیں۔"
      : "Enter a valid name, not numbers only.",
    city: ur
      ? "درست شہر کا نام درج کریں۔"
      : "Enter a valid city name.",
    phone: ur
      ? "درست پاکستانی موبائل نمبر درج کریں، مثلاً 03001234567۔"
      : "Enter a valid Pakistani mobile number, e.g. 03001234567.",
    email: ur
      ? "درست ای میل درج کریں، مثلاً name@example.com۔"
      : "Enter a valid email, e.g. name@example.com.",
    details: ur
      ? "کاروبار یا تجربے کی کم از کم 10 حروف میں تفصیل دیں۔"
      : "Provide at least 10 characters about your business or experience.",
    reference: ur
      ? "درست Transaction ID درج کریں، کم از کم 6 حروف یا ہندسے۔"
      : "Enter a valid Transaction ID of at least 6 characters.",
    date: ur
      ? "درست ادائیگی کی تاریخ درج کریں، مثلاً 06-11-2026۔"
      : "Enter a valid payment date, e.g. 06-11-2026."
  };

  return `${messages[type] || "Invalid information."}\n\n${promptField(session)}`;
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

  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: { properties: { title: tab } }
          }]
        }
      });
    } catch (error) {
      const check = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets.properties.title"
      });

      if (!(check.data.sheets || []).some(
        s => s.properties.title === tab
      )) throw error;
    }
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

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:O1`
  });

  if (!(current.data.values || []).length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1:O1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] }
    });
  }
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
    requestBody: { values: [row] }
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
    const field = fields[session.step];

    if (!validate(field, value)) {
      return {
        done: false,
        reply: validationError(session)
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

    if (session.lang === "ur") {
      return {
        done: true,
        reply: `محترم درخواست گزار،

آپ کی ${session.kind === "tender"
  ? "ٹینڈر"
  : "سٹی بزنس سینٹر"} درخواست کامیابی سے موصول ہو گئی ہے۔

Application No: ${applicationNo}
Application Status: Pending Review
${session.kind === "tender"
  ? "Payment Status: Pending Verification\n"
  : ""}
آپ کی درخواست کی جانچ کے بعد FCS Express آپ کو اگلے مرحلے سے آگاہ کرے گی۔

FCS Express Logistics & Transport

0 = Main Menu`
      };
    }

    return {
      done: true,
      reply: `Dear Applicant,

Your ${session.kind === "tender"
  ? "tender"
  : "City Business Center"} application has been received successfully.

Application No: ${applicationNo}
Application Status: Pending Review
${session.kind === "tender"
  ? "Payment Status: Pending Verification\n"
  : ""}
FCS Express will inform you about the next step after reviewing your application.

FCS Express Logistics & Transport

0 = Main Menu`
    };
  } catch (error) {
    console.error("Business / Tender Save Error:", error);

    return {
      done: false,
      reply: session.lang === "ur"
        ? "درخواست محفوظ نہیں ہو سکی۔ دوبارہ پیغام بھیج کر کوشش کریں۔"
        : "Application could not be submitted. Send another message to retry."
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

