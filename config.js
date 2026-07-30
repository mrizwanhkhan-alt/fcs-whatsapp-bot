module.exports = {
  PORT: Number(process.env.PORT) || 10000,

  VERIFY_TOKEN:
    (process.env.VERIFY_TOKEN || "FCS2026Verify").trim(),

  PHONE_NUMBER_ID:
    (process.env.PHONE_NUMBER_ID || "").trim(),

  WHATSAPP_TOKEN:
    (process.env.WHATSAPP_TOKEN || "").trim(),

  OPENAI_API_KEY:
    (process.env.OPENAI_API_KEY || "").trim()
};
