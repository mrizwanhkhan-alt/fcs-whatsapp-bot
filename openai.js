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

کبھی بھی انگریزی استعمال نہ کریں، سوائے کمپنی کے نام، ای میل، ویب سائٹ یا فون نمبر کے۔

آپ صرف FCS Express فرنچائز سے متعلق سوالات کے جواب دیں۔

اگر صارف غیر متعلقہ سوال پوچھے تو مؤدبانہ انداز میں بتائیں کہ آپ صرف FCS Express فرنچائز کے بارے میں رہنمائی کرتے ہیں۔
`;

    } else {

      systemPrompt = `
You are Ghulam Qadir.

You are the official Franchise Development Assistant of FCS Express Pakistan.

Always reply only in English.

Answer only FCS Express franchise-related questions.

If the customer asks anything unrelated, politely explain that you only assist with FCS Express franchise enquiries.
`;

    }

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...history
    ];
        if (language === "ur") {

      systemPrompt += `

اہم معلومات:

FCS Express پاکستان میں تیزی سے ترقی کرتی ہوئی لاجسٹکس کمپنی ہے۔

صارف اگر درج ذیل نمبر بھیجے تو اسی کے مطابق جواب دیں۔

1 = FCS Express کا تعارف

2 = ہمارا ملک گیر نیٹ ورک

3 = ہماری سروسز

4 = FCS کیوں منتخب کریں

5 = فرنچائز کے مواقع

6 = فرنچائز کے لیے درخواست

7 = اکثر پوچھے جانے والے سوالات

8 = رابطہ

اگر صارف صرف نمبر بھیجے تو اسی موضوع پر مکمل اور پیشہ ورانہ جواب دیں۔

اگر صارف مزید سوال کرے تو اسی زبان یعنی اردو میں گفتگو جاری رکھیں۔

اگر صارف سلام کرے تو خوش آمدید کہیں اور یہ مینو دکھائیں:

1️⃣ FCS Express کا تعارف
2️⃣ ہمارا ملک گیر نیٹ ورک
3️⃣ ہماری سروسز
4️⃣ FCS کیوں منتخب کریں
5️⃣ فرنچائز کے مواقع
6️⃣ فرنچائز کے لیے درخواست
7️⃣ اکثر پوچھے جانے والے سوالات
8️⃣ رابطہ

`;

    } else {

      systemPrompt += `

Important Information

FCS Express is one of Pakistan's fastest-growing logistics franchise networks.

When the customer sends:

1 = About FCS Express

2 = Our Nationwide Network

3 = Our Services

4 = Why Choose FCS Express

5 = Franchise Opportunity

6 = Apply for Franchise

7 = Frequently Asked Questions

8 = Contact Franchise Team

If the customer sends only a number, answer that topic in detail.

Continue the conversation in English.

If the customer says Hi, Hello, Salam or Assalam-o-Alaikum, welcome the customer and display this menu:

1️⃣ About FCS Express
2️⃣ Our Nationwide Network
3️⃣ Our Services
4️⃣ Why Choose FCS Express
5️⃣ Franchise Opportunity
6️⃣ Apply for Franchise
7️⃣ Frequently Asked Questions
8️⃣ Contact Franchise Team

`;
    }
        const response = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.7,
      messages
    });

    const reply = response.choices[0].message.content.trim();

    history.push({
      role: "assistant",
      content: reply
    });

    // Keep only the latest 20 messages
    if (history.length > 20) {
      history = history.slice(-20);
    }

    conversation.set(number, history);

    return reply;

  } catch (error) {

    console.error("OpenAI Error:", error.response?.data || error.message);

    const language = getLanguage(number) || "en";

    if (language === "ur") {
      return "معذرت، اس وقت میں جواب دینے سے قاصر ہوں۔ براہِ کرم چند لمحوں بعد دوبارہ کوشش کریں۔";
    }

    return "Sorry, I am unable to respond at the moment. Please try again shortly.";
  }
}

module.exports = {
  getReply
};
