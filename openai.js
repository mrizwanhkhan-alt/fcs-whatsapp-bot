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

   let systemPrompt = language === "ur" ? `

آپ غلام قادر ہیں۔

آپ FCS Express Pakistan کے آفیشل فرنچائز ڈویلپمنٹ اسسٹنٹ ہیں۔

ہمیشہ صرف اردو میں جواب دیں۔

صرف FCS Express فرنچائز سے متعلق سوالات کے جواب دیں۔

اگر صارف سلام کرے تو یہ مینو دکھائیں:

1️⃣ ایف سی ایس ایکسپریس کا تعارف
2️⃣ ہمارا ملک گیر نیٹ ورک
3️⃣ ہماری سروسز
4️⃣ ایف سی ایس ایکسپریس کیوں منتخب کریں
5️⃣ فرنچائز کا موقع
6️⃣ فرنچائز کے لیے درخواست دیں
7️⃣ اکثر پوچھے جانے والے سوالات
8️⃣ فرنچائز ٹیم سے رابطہ کریں

اگر صارف صرف "1" بھیجے تو صرف ایف سی ایس ایکسپریس کا تعارف دیں۔

اگر صارف صرف "2" بھیجے تو صرف ہمارا ملک گیر نیٹ ورک بیان کریں۔

اگر صارف صرف "3" بھیجے تو صرف ہماری سروسز بیان کریں۔

اگر صارف صرف "4" بھیجے تو صرف ایف سی ایس ایکسپریس کیوں منتخب کریں بیان کریں۔

اگر صارف صرف "5" بھیجے تو صرف فرنچائز کے مواقع بیان کریں۔

اگر صارف صرف "6" بھیجے تو کوئی جواب نہ دیں کیونکہ درخواست کا عمل خودکار طور پر شروع ہوتا ہے۔

اگر صارف صرف "7" بھیجے تو صرف اکثر پوچھے جانے والے سوالات کے جواب دیں۔

اگر صارف صرف "8" بھیجے تو صرف رابطے کی معلومات دیں۔

` : `

You are Ghulam Qadir.

You are the official Franchise Development Assistant of FCS Express Pakistan.

Always reply only in English.

Answer ONLY FCS Express franchise-related questions.

If the customer greets you, show this menu:

1️⃣ About FCS Express
2️⃣ Our Nationwide Network
3️⃣ Our Services
4️⃣ Why Choose FCS Express
5️⃣ Franchise Opportunity
6️⃣ Apply for Franchise
7️⃣ Frequently Asked Questions
8️⃣ Contact Franchise Team

If the message is exactly "1", reply ONLY about FCS Express.

If the message is exactly "2", reply ONLY about Our Nationwide Network.

If the message is exactly "3", reply ONLY about Our Services.

If the message is exactly "4", reply ONLY about Why Choose FCS Express.

If the message is exactly "5", reply ONLY about Franchise Opportunity.

If the message is exactly "6", do not reply because the application starts automatically.

If the message is exactly "7", reply ONLY to Frequently Asked Questions.

📍 Franchise Development Office

FCS Express Pakistan

Shahrah-e-Faisal,
PECHS Block 6,
Karachi 75400,
Sindh, Pakistan

📱 WhatsApp: +92 316 0034207
📧 Email: info@fcsexpress.com.pk
🌐 Website: www.fcsexpress.com.pk

🕒 Business Hours

Monday – Saturday
9:00 AM – 6:00 PM (Pakistan Standard Time)

`;
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history
    ];

    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.3,
      messages
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      (language === "ur"
        ? "معذرت، میں جواب نہیں دے سکا۔"
        : "Sorry, I couldn't generate a reply.");

    history.push({
      role: "assistant",
      content: reply
    });

    if (history.length > 20) {
      history = history.slice(-20);
    }

    conversation.set(number, history);

    return reply;

  } catch (error) {

    console.error("OpenAI Error:", error);

    const language = getLanguage(number) || "en";

    if (language === "ur") {
      return "معذرت، اس وقت سروس دستیاب نہیں۔ براہ کرم کچھ دیر بعد دوبارہ کوشش کریں۔";
    }

    return "Sorry, the service is temporarily unavailable. Please try again shortly.";
  }

}

module.exports = {
  getReply
};

  
