
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

// Exact 45-column City Business Center layout
const BUSINESS_HEADERS = [
  "Date",
  "Application No",
  "Full Name",
  "Father Name",
  "CNIC",
  "Mobile",
  "WhatsApp",
  "Email",
  "Province",
  "City",
  "Area / Tehsil",
  "Office / Shop Address",
  "Education",
  "Business Experience",
  "Shop / Office Available",
  "Comments",
  "Status",
  "Engagement Stage",
  "Last Message Sent",
  "Next Follow Up Date",
  "Verification Status",
  "Verification Date",
  "Document Status",
  "CNIC Verification",
  "Education Verification",
  "Bank Verification",
  "References Verification",
  "Affidavit Verification",
  "Site Inspection Status",
  "Site Inspection Date",
  "Screening Decision",
  "Approval Status",
  "Agreement Status",
  "Business Center Code",
  "Activation Date",
  "Applicant Type",
  "Company / Business Name",
  "NTN / Business Registration",
  "Existing FCS Business Linkage",
  "Proposed Business Center Location",
  "Available Office / Shop Size",
  "Existing Logistics / Transport Experience",
  "Operational Resources Available",
  "Security Deposit Status",
  "Business Center Category"
];

const TENDER_HEADERS = [
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

// Only 15 questions for Business Center
const businessFields = [
  ["Full Name", "مکمل نام", "name", "fullName"],
  ["Father Name", "والد کا نام", "name", "fatherName"],
  ["CNIC (13 digits)", "شناختی کارڈ نمبر (13 ہندسے)", "cnic", "cnic"],
  ["Mobile Number", "موبائل نمبر", "phone", "mobile"],
  ["Email Address", "ای میل ایڈریس", "email", "email"],
  ["Province", "صوبہ", "name", "province"],
  ["City", "شہر", "city", "city"],
  ["Area / Tehsil", "علاقہ / تحصیل", "name", "area"],
  ["Office / Shop Address", "دفتر / دکان کا مکمل پتہ", "details", "address"],
  ["Education", "تعلیمی قابلیت", "name", "education"],
  ["Business Experience", "کاروباری تجربے کی تفصیل", "details", "experience"],
  ["Shop / Office Available (Yes/No)", "کیا دفتر یا دکان موجود ہے؟ Yes / No", "yesno", "shop"],
  ["Existing FCS Business Linkage", "FCS کے ساتھ موجودہ کاروباری تعلق کی تفصیل", "details", "linkage"],
  ["Office / Shop Size", "دفتر یا دکان کا سائز، مثلاً 12x12 ft", "short", "size"],
  ["Operational Resources Available", "دستیاب کاروباری وسائل کی تفصیل", "details", "resources"]
];

// Tender questions remain unchanged
const tenderFields = [
  ["Applicant / Company Name", "درخواست گزار / کمپنی کا نام", "name", "name"],
  ["City", "شہر", "city", "city"],
  ["Mobile / WhatsApp", "موبائل / واٹس ایپ نمبر", "phone", "phone"],
  ["Email Address", "ای میل ایڈریس", "email", "email"],
  ["Business / Experience Details", "کاروبار / تجربے کی تفصیلات", "details", "details"],
  ["Payment Reference / Transaction ID", "ادائیگی کا ریفرنس / ٹرانزیکشن آئی ڈی", "reference", "reference"],
  ["Payment Date (DD-MM-YYYY)", "ادائیگی کی تاریخ (DD-MM-YYYY)", "date", "date"]
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
    ? tenderFields
    : businessFields;
}

function promptField(session) {
  const fields = fieldsFor(session);
  const field = fields[session.step];

  if (!field) return "";

  const count = `${session.step + 1}/${fields.length}`;

  return session.lang === "ur"
    ? `سوال ${count}\n${field[1]}\n\n0 = Cancel`
    : `Question ${count}\n${field[0]}\n\n0 = Cancel`;
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

  if (type === "cnic") {
    return /^\d{5}-?\d{7}-?\d$/.test(value);
  }

  if (type === "phone") {
    const cleaned = value.replace(/[\s()-]/g, "");
    return /^(?:\+92|0092|92|0)3\d{9}$/.test(cleaned);
  }

  if (type === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) &&
      value.length <= 254;
  }

  if (type === "yesno") {
    return ["yes", "no", "ہاں", "نہیں", "1", "2"]
      .includes(value.toLowerCase());
  }

  if (type === "details") {
    return value.length >= 10 &&
      /[\p{L}]/u.test(value);
  }

  if (type === "short") {
    return value.length >= 2;
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
  const ur = session.lang === "ur";

  const messages = {
    name: ur ? "درست نام یا معلومات درج کریں۔" : "Enter valid information.",
    city: ur ? "درست شہر درج کریں۔" : "Enter a valid city.",
    cnic: ur ? "درست 13 ہندسوں کا CNIC درج کریں۔" : "Enter a valid 13-digit CNIC.",
    phone: ur ? "درست پاکستانی موبائل نمبر درج کریں، مثلاً 03001234567۔" : "Enter a Pakistani mobile number, e.g. 03001234567.",
    email: ur ? "درست ای میل درج کریں۔" : "Enter a valid email.",
    yesno: ur ? "Yes یا No درج کریں۔" : "Enter Yes or No.",
    details: ur ? "کم از کم 10 حروف میں تفصیل درج کریں۔" : "Enter at least 10 characters.",
    short: ur ? "درست معلومات درج کریں۔" : "Enter valid information.",
    reference: ur ? "درست Transaction ID درج کریں۔" : "Enter a valid Transaction ID.",
    date: ur ? "درست تاریخ درج کریں، مثلاً 06-11-2026۔" : "Enter a valid date, e.g. 06-11-2026."
  };

  return `${messages[field[2]] || "Invalid information."}\n\n${promptField(session)}`;
}

function startBusiness(number, lang) {
  const session = {
    kind: "business",
    lang: lang === "ur" ? "ur" : "en",
    step: 0,
    values: {}
  };

  sessions.set(number, session);

  const heading = session.lang === "ur"
    ? "🏢 FCS CITY BUSINESS CENTER\n\nسٹی بزنس سینٹر درخواست\n\nسیکیورٹی ڈپازٹ کمپنی پالیسی کے مطابق ہوگا۔"
    : "🏢 FCS CITY BUSINESS CENTER\n\nBusiness Center Application\n\nSecurity deposit applies according to company policy.";

  return `${heading}\n\n${promptField(session)}`;
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
    lang: lang === "ur" ? "ur" : "en",
    step: 0,
    values: {},
    tender: TENDERS[index]
  };

  sessions.set(number, session);

  return `${session.lang === "ur"
    ? "📋 FCS ٹینڈر درخواست"
    : "📋 FCS TENDER APPLICATION"}

${TENDERS[index][0]}
Tender No: ${TENDERS[index][1]}

${paymentInstructions(session.lang)}

${promptField(session)}`;
}

async function ensureTab(tab, headers) {
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

  const lastColumn = headers.length === 45 ? "AS" : "O";

  const current = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A1:${lastColumn}1`
  });

  const existing = (current.data.values || [])[0] || [];

  if (existing.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A1:${lastColumn}1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] }
    });
    return;
  }

  // Never overwrite an existing sheet with a different layout.
  const matches = headers.every(
    (heading, index) =>
      String(existing[index] || "").trim() === heading
  );

  if (!matches || existing.length !== headers.length) {
    throw new Error(
      `HEADER_MISMATCH: ${tab}. Existing headings differ from the required layout. No data was written.`
    );
  }
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.startsWith("0092")) return digits.slice(2);
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return "92" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("3")) {
    return "92" + digits;
  }

  return digits;
}

function normalizeAnswer(field, value) {
  if (field[2] === "yesno") {
    const lower = value.toLowerCase();
    return ["yes", "ہاں", "1"].includes(lower) ? "Yes" : "No";
  }

  if (field[2] === "phone") {
    return normalizePhone(value);
  }

  if (field[2] === "cnic") {
    return value.replace(/\D/g, "");
  }

  return value;
}

function makeBusinessRow(session, number, applicationNo) {
  const v = session.values;
  const now = new Date();
  const nextFollowUp = new Date(now);

  nextFollowUp.setDate(nextFollowUp.getDate() + 15);

  const data = {
    "Date": now.toISOString(),
    "Application No": applicationNo,
    "Full Name": v.fullName || "",
    "Father Name": v.fatherName || "",
    "CNIC": v.cnic || "",
    "Mobile": v.mobile || "",
    "WhatsApp": normalizePhone(number),
    "Email": v.email || "",
    "Province": v.province || "",
    "City": v.city || "",
    "Area / Tehsil": v.area || "",
    "Office / Shop Address": v.address || "",
    "Education": v.education || "",
    "Business Experience": v.experience || "",
    "Shop / Office Available": v.shop || "",
    "Comments": "",
    "Status": "Received",
    "Engagement Stage": "Application Submitted",
    "Last Message Sent": now.toISOString(),
    "Next Follow Up Date": nextFollowUp.toISOString().slice(0, 10),
    "Verification Status": "Pending",
    "Verification Date": "",
    "Document Status": "Pending",
    "CNIC Verification": "Pending",
    "Education Verification": "Pending",
    "Bank Verification": "Pending",
    "References Verification": "Pending",
    "Affidavit Verification": "Pending",
    "Site Inspection Status": "Pending",
    "Site Inspection Date": "",
    "Screening Decision": "Pending",
    "Approval Status": "Pending",
    "Agreement Status": "Pending",
    "Business Center Code": "",
    "Activation Date": "",
    "Applicant Type": "Individual",
    "Company / Business Name": "",
    "NTN / Business Registration": "",
    "Existing FCS Business Linkage": v.linkage || "",
    "Proposed Business Center Location": v.address || "",
    "Available Office / Shop Size": v.size || "",
    "Existing Logistics / Transport Experience": v.experience || "",
    "Operational Resources Available": v.resources || "",
    "Security Deposit Status": "Pending",
    "Business Center Category": ""
  };

  return BUSINESS_HEADERS.map(header => data[header] ?? "");
}

function makeTenderRow(session, number, applicationNo) {
  const v = session.values;

  return [
    new Date().toISOString(),
    applicationNo,
    session.tender[0],
    session.tender[1],
    number,
    v.name || "",
    v.city || "",
    v.phone || "",
    v.email || "",
    v.details || "",
    "Pending Review",
    "Not Verified",
    "NayaPay - Claimed",
    v.reference || "",
    v.date || ""
  ];
}

async function save(session, number) {
  const isTender = session.kind === "tender";
  const tab = tabs[session.kind];

  await ensureTab(
    tab,
    isTender ? TENDER_HEADERS : BUSINESS_HEADERS
  );

  const applicationNo = await generateApplicationNumber();

  const row = isTender
    ? makeTenderRow(session, number, applicationNo)
    : makeBusinessRow(session, number, applicationNo);

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: `'${tab}'!A:${isTender ? "O" : "AS"}`,
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
    const field = fields[session.step];

    if (!validate(field, value)) {
      return {
        done: false,
        reply: validationError(session)
      };
    }

    session.values[field[3]] = normalizeAnswer(field, value);
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
