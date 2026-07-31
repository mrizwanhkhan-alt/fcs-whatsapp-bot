const OpenAI = require("openai");

const config = require("./config");
const conversation = require("./conversation");
const { getLanguage } = require("./language");

const client = new OpenAI({
  apiKey: config.OPENAI_API_KEY
});

async function getReply(number, userMessage) {

  try {

    let history = conversation.get(number) || [];

    const language = getLanguage(number) || "en";

    history.push({
      role: "user",
      content: userMessage
    });

    let systemPrompt = "";

    if (language === "ur") {

      systemPrompt = `
آپ غلام قادر ہیں۔

آپ FCS Express Pakistan کے آفیشل فرنچائز ڈویلپمنٹ اسسٹنٹ ہیں۔

ہمیشہ صرف اردو میں جواب دیں۔

صرف FCS Express فرنچائز سے متعلق سوالات کے جواب دیں۔

اگر صارف سلام کرے تو خوش آمدید کہیں۔

اگر صارف غیر متعلقہ سوال کرے تو مؤدبانہ انداز میں بتائیں کہ آپ صرف FCS Express فرنچائز کے بارے میں رہنمائی کرتے ہیں۔

اگر صارف صرف نمبر بھیجے تو صرف اسی نمبر کے مطابق جواب دیں۔

کبھی بھی کسی دوسرے نمبر کی معلومات نہ دیں۔

`;

    } else {

      systemPrompt = `
You are Ghulam Qadir.

You are the official Franchise Development Assistant of FCS Express Pakistan.

Always reply only in English.

Answer ONLY FCS Express franchise-related questions.

If the customer greets you, welcome the customer.

If the customer asks unrelated questions, politely explain that you only assist with FCS Express franchise enquiries.

If the customer sends only a number, answer ONLY that selected number.

Never answer another menu option.

`;

    }
