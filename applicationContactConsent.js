const SOURCE = "WhatsApp bot";
const VERSION = "application-contact-v1";
const TAB = "Application Contact Consent";
const HEADERS = ["Application No", "Application Type", "Contact Number", "Consent", "Consent Date and Time (UTC)", "Source", "Consent Wording Version", "WhatsApp Sender"];

const choices = {
  ur: ["ہاں", "نہیں"],
  en: ["Yes", "No"]
};
const buttonIds = ["application_contact_yes", "application_contact_no"];

function consentPrompt(lang) {
  const options = choices[lang] || choices.en;
  const body = lang === "ur"
    ? "کیا FCS Express Pakistan آپ کی درخواست، مطلوبہ دستاویزات اور اگلے مراحل کے بارے میں آپ کے درج کردہ نمبر پر واٹس ایپ کے ذریعے رابطہ کر سکتا ہے؟ یہ رابطہ ہمارے آفیشل واٹس ایپ بوٹ 0316 0034207 یا آفیشل آفس واٹس ایپ نمبر 0332 6237178 سے کیا جا سکتا ہے۔"
    : "May FCS Express Pakistan contact you on the number you entered about your application, required documents and next steps via WhatsApp? We may contact you from our official bot (0316 0034207) or official office WhatsApp (0332 6237178).";

  return {
    reply: body + "\n\n" + options.join(" / "),
    interactive: {
      type: "button",
      body: { text: body },
      action: { buttons: options.map((title, i) => ({
        type: "reply",
        reply: { id: buttonIds[i], title }
      })) }
    }
  };
}

function isConsentButton(value) {
  return buttonIds.includes(value);
}

function consentAnswer(value) {
  const text = String(value || "").trim().toLowerCase();
  if ([buttonIds[0], "yes", "ہاں"].includes(text)) return "YES";
  if ([buttonIds[1], "no", "نہیں"].includes(text)) return "NO";
  return "";
}

async function ensureConsentTab(sheets, spreadsheetId) {
  const list = () => sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });
  const hasTab = result => (result.data.sheets || []).some(sheet => sheet.properties.title === TAB);
  if (hasTab(await list())) return;

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [
        { addSheet: { properties: { title: TAB, sheetId: 1716084219, gridProperties: { frozenRowCount: 1 } } } },
        { updateCells: {
          start: { sheetId: 1716084219, rowIndex: 0, columnIndex: 0 },
          rows: [{ values: HEADERS.map(stringValue => ({ userEnteredValue: { stringValue } })) }],
          fields: "userEnteredValue"
        } }
      ] }
    });
  } catch (error) {
    if (!hasTab(await list())) throw error;
  }
}

async function writeApplicationConsent(sheets, spreadsheetId, record) {
  await ensureConsentTab(sheets, spreadsheetId);
  const range = "'" + TAB + "'!A:H";
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'" + TAB + "'!A1:H1" });
  if (!HEADERS.every((name, i) => current.data.values?.[0]?.[i] === name)) {
    throw new Error("Application Contact Consent sheet headers do not match");
  }

  const ids = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'" + TAB + "'!A2:A" });
  if ((ids.data.values || []).some(([id]) => id === record.applicationNo)) return;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[record.applicationNo, record.applicationType, record.number, record.answer, record.recordedAt, SOURCE, VERSION, record.sender]] }
  });
}

async function recordConsent(session, value, context, applicationType, number, getApplicationNo) {
  const answer = consentAnswer(value);
  if (!answer || !context?.verified) return false;

  if (!session.consentWrite) {
    session.consentRecord ||= {
      applicationType,
      number,
      answer,
      recordedAt: context.receivedAt,
      sender: context.sender
    };

    session.consentWrite = (async () => {
      session.consentRecord.applicationNo ||= await getApplicationNo();
      const { sheets } = require("./googleSheets");
      const { GOOGLE_SHEET_ID } = require("./config");
      await writeApplicationConsent(sheets, GOOGLE_SHEET_ID, session.consentRecord);
    })().catch(error => {
      session.consentWrite = null;
      throw error;
    });
  }

  await session.consentWrite;
  return true;
}

module.exports = { consentPrompt, isConsentButton, recordConsent };
