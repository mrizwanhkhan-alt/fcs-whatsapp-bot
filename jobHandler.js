
const https = require("https");
const { google } = require("googleapis");
const config = require("./config");

const credentials = JSON.parse(
  process.env.GOOGLE_SERVICE_ACCOUNT
);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ]
});

const sheets = google.sheets({
  version: "v4",
  auth
});

const drive = google.drive({
  version: "v3",
  auth
});

const SHEET = "Job_Applications";
const sessions = new Map();
const TIMEOUT = 30 * 60 * 1000;

const HEADERS = [
  "Date",
  "Career Application ID",
  "Applicant Name",
  "Father Name",
  "Mobile / WhatsApp",
  "Email",
  "CNIC",
  "City",
  "Province",
  "Position Applied For",
  "Education",
  "Work Experience",
  "CV / Resume Link",
  "Additional Information",
  "Status",
  "Recruitment Stage",
  "Last Message Sent",
  "Next Follow Up Date",
  "Remarks"
];

const FIELDS = [
  ["Applicant Name", "درخواست گزار کا مکمل نام", "name", "name"],
  ["Father Name", "والد کا نام", "name", "father"],
  ["Mobile / WhatsApp", "موبائل / واٹس ایپ نمبر", "phone", "mobile"],
  ["Email", "ای میل ایڈریس", "email", "email"],
  ["CNIC", "شناختی کارڈ نمبر", "cnic", "cnic"],
  ["City", "شہر", "name", "city"],
  ["Province", "صوبہ", "name", "province"],
  ["Position Applied For", "مطلوبہ ملازمت / پوزیشن", "name", "position"],
  ["Education", "تعلیمی قابلیت", "name", "education"],
  ["Work Experience", "کام کا تجربہ", "text", "experience"],
  ["Additional Information", "اضافی معلومات (نہیں ہیں تو None لکھیں)", "text", "additional"]
];

function isUr(session) {
  return session.lang === "ur";
}

function question(session) {
  if (session.step === FIELDS.length) {
    return isUr(session)
      ? "📎 اپنی CV / Resume بطور PDF یا Word Document بھیجیں۔\n\n0 = Cancel"
      : "📎 Send your CV / Resume as a PDF or Word Document.\n\n0 = Cancel";
  }

  const field = FIELDS[session.step];

  return isUr(session)
    ? `سوال ${session.step + 1}/${FIELDS.length}\n${field[1]}\n\n0 = Cancel`
    : `Question ${session.step + 1}/${FIELDS.length}\n${field[0]}\n\n0 = Cancel`;
}

function startJob(number, lang = "en") {
  const session = {
    lang: lang === "ur" ? "ur" : "en",
    step: 0,
    data: {},
    updated: Date.now(),
    saving: false
  };

  sessions.set(String(number), session);

  return (isUr(session)
    ? "💼 FCS EXPRESS\n\nملازمت کے لیے درخواست\n\n"
    : "💼 FCS EXPRESS\n\nJOB APPLICATION\n\n"
  ) + question(session);
}

function isJobActive(number) {
  const key = String(number);
  const session = sessions.get(key);

  if (!session) return false;

  if (Date.now() - session.updated > TIMEOUT) {
    sessions.delete(key);
    return false;
  }

  return true;
}

function valid(field, value) {
  if (!value || value.length > 500) return false;

  switch (field[2]) {
    case "name":
      return /[\p{L}]{2,}/u.test(value);

    case "phone":
      return /^(?:\+92|0092|92|0)3\d{9}$/.test(
        value.replace(/[\s()-]/g, "")
      );

    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

    case "cnic":
      return /^\d{5}-?\d{7}-?\d$/.test(value);

    case "text":
      return value.length >= 2;

    default:
      return true;
  }
}

function normalizePhone(value) {
  const digits = String(value).replace(/\D/g, "");

  if (digits.startsWith("0092")) {
    return digits.slice(2);
  }

  if (digits.startsWith("92")) return digits;

  if (digits.startsWith("0")) {
    return "92" + digits.slice(1);
  }

  if (digits.length === 10 && digits.startsWith("3")) {
    return "92" + digits;
  }

  return digits;
}

function reply(done, message) {
  return { done, reply: message };
}

async function handleJob(number, text) {
  const key = String(number);
  const session = sessions.get(key);

  if (!session) return null;

  const value = String(text || "").trim();

  if (value === "0") {
    sessions.delete(key);

    return reply(
      true,
      isUr(session)
        ? "درخواست منسوخ کر دی گئی۔\n0 = Main Menu"
        : "Application cancelled.\n0 = Main Menu"
    );
  }

  if (session.saving) {
    return reply(
      false,
      isUr(session)
        ? "درخواست محفوظ ہو رہی ہے، براہ کرم انتظار کریں۔"
        : "Application is being saved. Please wait."
    );
  }

  if (session.step >= FIELDS.length) {
    return reply(false, question(session));
  }

  const field = FIELDS[session.step];

  if (!valid(field, value)) {
    return reply(
      false,
      (isUr(session)
        ? "درست معلومات درج کریں۔\n\n"
        : "Please enter valid information.\n\n"
      ) + question(session)
    );
  }

  session.data[field[3]] =
    field[2] === "phone"
      ? normalizePhone(value)
      : field[2] === "cnic"
        ? value.replace(/\D/g, "")
        : value;

  session.step++;
  session.updated = Date.now();

  return reply(false, question(session));
}

function requestBuffer(url, token, maxBytes) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      },
      response => {
        if (response.statusCode !== 200) {
          response.resume();
          return reject(
            new Error(`Media HTTP ${response.statusCode}`)
          );
        }

        const chunks = [];
        let size = 0;

        response.on("data", chunk => {
          size += chunk.length;

          if (size > maxBytes) {
            response.destroy(
              new Error("CV exceeds 10 MB")
            );
            return;
          }

          chunks.push(chunk);
        });

        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });

        response.on("error", reject);
      }
    );

    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("Media timeout"));
    });
  });
}

async function downloadCV(mediaId) {
  const token = config.WHATSAPP_TOKEN;

  if (!token) {
    throw new Error("WhatsApp token missing");
  }

  const metadata = await requestBuffer(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(mediaId)}`,
    token,
    1024 * 1024
  );

  const info = JSON.parse(metadata.toString());

  if (!info.url) {
    throw new Error("Media URL missing");
  }

  return requestBuffer(
    info.url,
    token,
    10 * 1024 * 1024
  );
}

async function verifySheet() {
  const spreadsheetId = config.GOOGLE_SHEET_ID;

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });

  const exists = (response.data.sheets || []).some(
    item => item.properties.title === SHEET
  );

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: SHEET }
          }
        }]
      }
    });
  }

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SHEET}'!A1:S1`
  });

  const current = (result.data.values || [])[0] || [];

  if (current.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SHEET}'!A1:S1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [HEADERS]
      }
    });
    return;
  }

  if (
    current.length !== HEADERS.length ||
    !HEADERS.every((header, i) => current[i] === header)
  ) {
    throw new Error(
      "Job Applications sheet headers do not match"
    );
  }
}

function careerID() {
  const random = Math.floor(
    10000000 + Math.random() * 90000000
  );

  return `FCS-JOB-${Date.now()}-${random}`;
}

async function saveJob(number, session, cvLink) {
  await verifySheet();

  const now = new Date();
  const followUp = new Date(now);

  followUp.setDate(followUp.getDate() + 15);

  const id = careerID();
  const v = session.data;

  const row = [
    now.toISOString(),
    id,
    v.name || "",
    v.father || "",
    v.mobile || normalizePhone(number),
    v.email || "",
    v.cnic || "",
    v.city || "",
    v.province || "",
    v.position || "",
    v.education || "",
    v.experience || "",
    cvLink,
    v.additional || "",
    "Received",
    "Application Submitted",
    now.toISOString(),
    followUp.toISOString().slice(0, 10),
    ""
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.GOOGLE_SHEET_ID,
    range: `'${SHEET}'!A:S`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row]
    }
  });

  return id;
}

async function handleJobDocument(number, document) {
  const key = String(number);
  const session = sessions.get(key);

  if (!session) return null;

  if (session.step !== FIELDS.length) {
    return reply(false, question(session));
  }

  if (session.saving) {
    return reply(
      false,
      isUr(session)
        ? "درخواست محفوظ ہو رہی ہے۔"
        : "Application is being saved."
    );
  }

  const name = String(document?.filename || "");
  const mime = String(document?.mime_type || "");

  const extension = name.toLowerCase();

  const allowed =
    extension.endsWith(".pdf") ||
    extension.endsWith(".doc") ||
    extension.endsWith(".docx");

  const allowedMime = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream"
  ].includes(mime);

  if (
    !document?.id ||
    !allowed ||
    !allowedMime ||
    (document.file_size && document.file_size > 10485760)
  ) {
    return reply(
      false,
      isUr(session)
        ? "براہ کرم PDF یا Word CV بھیجیں، زیادہ سے زیادہ 10 MB۔"
        : "Send a PDF or Word CV, maximum 10 MB."
    );
  }

  const folderId = process.env.JOB_CV_FOLDER_ID;

  if (!folderId) {
    console.error("JOB_CV_FOLDER_ID missing");

    return reply(
      false,
      isUr(session)
        ? "CV اسٹوریج ابھی منسلک نہیں۔ درخواست محفوظ نہیں ہوئی۔"
        : "CV storage is not configured. Application was not saved."
    );
  }

  session.saving = true;

  try {
    const buffer = await downloadCV(document.id);
    const { Readable } = require("stream");

    const safeName = name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100);

    const uploaded = await drive.files.create({
      requestBody: {
        name: `${Date.now()}_${safeName}`,
        parents: [folderId],
        description: "FCS Express Career Application CV"
      },
      media: {
        mimeType: mime === "application/octet-stream"
          ? "application/pdf"
          : mime,
        body: Readable.from(buffer)
      },
      fields: "id,webViewLink"
    });

    const fileId = uploaded.data.id;

    const cvLink =
      uploaded.data.webViewLink ||
      `https://drive.google.com/file/d/${fileId}/view`;

    const id = await saveJob(
      number,
      session,
      cvLink
    );

    sessions.delete(key);

    return reply(
      true,
      isUr(session)
        ? `🎉 آپ کی ملازمت کی درخواست موصول ہو گئی ہے۔

Career Application ID: ${id}
Status: Received

آپ کی CV محفوظ ہو گئی ہے۔

FCS Express
0 = Main Menu`
        : `🎉 Your job application has been received.

Career Application ID: ${id}
Status: Received

Your CV has been saved.

FCS Express
0 = Main Menu`
    );
  } catch (error) {
    console.error("Job Application Error:", error);

    return reply(
      false,
      isUr(session)
        ? "درخواست محفوظ نہیں ہو سکی۔ براہ کرم CV دوبارہ بھیجیں۔"
        : "Application could not be saved. Please resend your CV."
    );
  } finally {
    session.saving = false;
    session.updated = Date.now();
  }
}

module.exports = {
  startJob,
  isJobActive,
  handleJob,
  handleJobDocument
};
