
const http = require("http");
const https = require("https");
const config = require("./config");
const { getReply } = require("./openai");

const {
  startApplication,
  isApplying,
  handleApplication
} = require("./applicationHandler");

const {
  isSupplierRegistering,
  handleSupplier
} = require("./supplierHandler");

const {
  isTransportRegistering,
  handleTransport
} = require("./transportHandler");

const {
  isWarehouseRegistering,
  handleWarehouse
} = require("./warehouseHandler");

const { numberExists } = require("./googleSheets");
const faq = require("./faq");
const faqMode = new Map();
const tenderMode = new Set();

const {
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu
} = require("./language");

const { isBlocked } = require("./blockedUsers");
const {
  isRegistered,
  getRegisteredUser
} = require("./registeredUsers");

const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;

function sendWhatsAppMessage(to, message) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    console.error("WhatsApp credentials missing");
    return;
  }

  const data = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(to),
    type: "text",
    text: {
      preview_url: false,
      body: message
    }
  });

  const req = https.request({
    hostname: "graph.facebook.com",
    port: 443,
    path: `/v21.0/${PHONE_NUMBER_ID}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  }, res => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      console.log("WhatsApp Response:", res.statusCode, body);
    });
  });

  req.on("error", err => console.error(err.message));
  req.write(data);
  req.end();
}

function faqCategoryMenu(lang) {
  return lang === "ur"
    ? `❓ اکثر پوچھے جانے والے سوالات

1️⃣ فری فرنچائز
2️⃣ ٹرانسپورٹ
3️⃣ ویئر ہاؤس / ٹرک اڈہ
4️⃣ سپلائر / وینڈر

مین مینو کے لیے 0 بھیجیں۔`
    : `❓ Frequently Asked Questions

1️⃣ Free Franchise
2️⃣ Transport
3️⃣ Warehouse / Truck Adda
4️⃣ Supplier / Vendor

Reply 0 for Main Menu.`;
}

function businessCenterMessage(lang) {
  return lang === "ur"
    ? `🏢 FCS CITY BUSINESS CENTER

سٹی بزنس سینٹر ایف سی ایس کا وسیع کاروباری ماڈل ہے۔

• پارسل کلیکشن اور ڈیلیوری
• فریٹ بکنگ اور ہینڈلنگ
• متعلقہ فرنچائزز کے ساتھ کام
• ایونٹس اور منظور شدہ خدمات
• مستقبل کی FCS خدمات

سیکیورٹی ڈپازٹ کمپنی پالیسی کے مطابق لازمی ہے۔

اہلیت، درخواست اور تفصیلات:
info@fcsexpress.com.pk

مین مینو کے لیے 0 بھیجیں۔`
    : `🏢 FCS CITY BUSINESS CENTER

Business activities include:

• Parcel collection and delivery
• Freight booking and handling
• Coordination with assigned franchises
• Events and approved services
• Future FCS services

A security deposit is required according to company policy.

Applications and details:
info@fcsexpress.com.pk

Reply 0 for Main Menu.`;
}

function tenderMenu(lang) {
  return lang === "ur"
    ? `📋 FCS EXPRESS TENDERS

متعلقہ ٹینڈر منتخب کریں:

1️⃣ جنرل آرڈر سپلائر
2️⃣ ٹرانسپورٹ سروسز
3️⃣ ویئر ہاؤس / ٹرک اڈہ

شرکت کے لیے متعلقہ ٹینڈر کی خریداری ضروری ہے۔

ٹینڈر کی شرائط اور خریداری:
info@fcsexpress.com.pk

مین مینو کے لیے 0 بھیجیں۔`
    : `📋 FCS EXPRESS TENDERS

Select the relevant tender:

1️⃣ General Order Supplier
2️⃣ Transport Services
3️⃣ Warehouse / Truck Adda

Purchase of the relevant tender is required.

Tender terms and purchase information:
info@fcsexpress.com.pk

Reply 0 for Main Menu.`;
}

function tenderReply(lang, choice) {
  const categories = {
    "1": ["جنرل آرڈر سپلائر", "General Order Supplier"],
    "2": ["ٹرانسپورٹ سروسز", "Transport Services"],
    "3": ["ویئر ہاؤس / ٹرک اڈہ", "Warehouse / Truck Adda"]
  };

  if (!categories[choice]) return tenderMenu(lang);

  const name = categories[choice][lang === "ur" ? 0 : 1];

  return lang === "ur"
    ? `📋 ${name}

اس کیٹیگری میں شرکت کے لیے متعلقہ ٹینڈر خریدنا ہوگا۔

دستیابی، شرائط اور خریداری:
info@fcsexpress.com.pk

واپس جانے کے لیے 0 بھیجیں۔`
    : `📋 ${name}

Purchase of the relevant tender is required to participate.

For availability, terms and purchase:
info@fcsexpress.com.pk

Reply 0 to return to Main Menu.`;
}

function careerMessage(lang) {
  return lang === "ur"
    ? `💼 FCS EXPRESS CAREERS

ملازمت کے مواقع کے لیے اپنی CV، نام، شہر اور مطلوبہ پوزیشن بھیجیں۔

Email: info@fcsexpress.com.pk
Subject: Career Application

درخواست جمع کروانا ملازمت کی ضمانت نہیں۔

مین مینو کے لیے 0 بھیجیں۔`
    : `💼 FCS EXPRESS CAREERS

For career opportunities, submit your CV, name, city and preferred position.

Email: info@fcsexpress.com.pk
Subject: Career Application

Submitting an application does not guarantee employment.

Reply 0 for Main Menu.`;
}

function informationMessage(option, lang) {
  const ur = {
    "1": `🏢 ایف سی ایس ایکسپریس پاکستان

ایف سی ایس ایکسپریس لاجسٹکس، کورئیر، ای کامرس، فریٹ اور ڈسٹری بیوشن کی خدمات فراہم کرنے کے لیے کام کر رہی ہے۔

www.fcsexpress.com.pk`,
    "2": `🌍 ہمارا ملک گیر نیٹ ورک

7 نیشنل ڈسٹری بیوشن سینٹرز
14 ریجنل ڈسٹری بیوشن سینٹرز
170 سٹی ہبز
2,530+ سروس پوائنٹ فرنچائزز

www.fcsexpress.com.pk`,
    "3": `🚚 ہماری خدمات

• پارسل ڈیلیوری
• ای کامرس لاجسٹکس
• کیش آن ڈیلیوری
• فریٹ بکنگ
• ویئر ہاؤسنگ
• کارپوریٹ لاجسٹکس
• ملک گیر ڈسٹری بیوشن

www.fcsexpress.com.pk`,
    "9": `📞 رابطہ اور معاونت

FCS Express Pakistan
Lahore, Pakistan

Office: 042 3246 2221
Email: info@fcsexpress.com.pk
Website: www.fcsexpress.com.pk`,
    "10": `⭐ ایف سی ایس ایکسپریس کیوں؟

• ملک گیر لاجسٹکس نیٹ ورک
• جدید ٹیکنالوجی
• کاروباری مواقع
• بین الاقوامی پلیٹ فارم
• فرنچائز اور بزنس سپورٹ

www.fcsexpress.com.pk`
  };

  const en = {
    "1": `🏢 ABOUT FCS EXPRESS

FCS Express Pakistan works in logistics, courier services, e-commerce, freight and distribution.

www.fcsexpress.com.pk`,
    "2": `🌍 OUR NATIONWIDE NETWORK

7 National Distribution Centers
14 Regional Distribution Centers
170 City Hubs
2,530+ Service Point Franchises

www.fcsexpress.com.pk`,
    "3": `🚚 OUR SERVICES

• Parcel Delivery
• E-commerce Logistics
• Cash on Delivery
• Freight Booking
• Warehousing
• Corporate Logistics
• Nationwide Distribution

www.fcsexpress.com.pk`,
    "9": `📞 CONTACT & SUPPORT

FCS Express Pakistan
Lahore, Pakistan

Office: 042 3246 2221
Email: info@fcsexpress.com.pk
Website: www.fcsexpress.com.pk`,
    "10": `⭐ WHY CHOOSE FCS EXPRESS?

• Nationwide Logistics Network
• Modern Technology
• Business Opportunities
• International Platform
• Franchise and Business Support

www.fcsexpress.com.pk`
  };

  const message = (lang === "ur" ? ur : en)[option];
  if (!message) return null;

  return message + (lang === "ur"
    ? "\n\nمین مینو کے لیے 0 بھیجیں۔"
    : "\n\nReply 0 for Main Menu.");
}

const server = http.createServer((req, res) => {
  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("FCS Express WhatsApp Bot Running");
  }

  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(challenge || "");
    }

    res.writeHead(403);
    return res.end("Verification failed");
  }

  if (req.method === "POST" && url.pathname === "/webhook") {
    let body = "";

    req.on("data", chunk => body += chunk.toString());

    req.on("end", async () => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("EVENT_RECEIVED");

      try {
        const data = JSON.parse(body);
        const message =
          data.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (!message || message.type !== "text") return;

        const number = String(message.from);
        const customerText = message.text?.body || "";
        const text = customerText.trim();
        const lower = text.toLowerCase();

        if (isBlocked(number)) return;

        const lang = getLanguage(number) || "en";

        // Continue applications already in progress.
        if (isApplying(number)) {
          const result = await handleApplication(number, customerText);
          sendWhatsAppMessage(number, result.reply);
          return;
        }

        // Preserve previously started vendor applications.
        if (isSupplierRegistering(number)) {
          const result = await handleSupplier(number, customerText);
          sendWhatsAppMessage(number, result.reply);
          return;
        }

        if (isTransportRegistering(number)) {
          const result = await handleTransport(number, customerText);
          sendWhatsAppMessage(number, result.reply);
          return;
        }

        if (isWarehouseRegistering(number)) {
          const result = await handleWarehouse(number, customerText);
          sendWhatsAppMessage(number, result.reply);
          return;
        }

        // Allow registered applicants to view information,
        // but do not create another franchise application.
        if (isRegistered(number)) {
          const user = getRegisteredUser(number);
          if (user) {
            console.log("Registered applicant:", number);
          }
        }

        // Language selection.
        if (!hasLanguage(number)) {
          if (text === "1" || text === "2") {
            const selected = text === "1" ? "en" : "ur";
            setLanguage(number, selected);
            sendWhatsAppMessage(number, mainMenu(selected));
          } else {
            sendWhatsAppMessage(number, languageMenu());
          }
          return;
        }

        // Global return to main menu.
        if (
          text === "0" ||
          lower === "menu" ||
          lower === "main menu"
        ) {
          faqMode.delete(number);
          tenderMode.delete(number);
          sendWhatsAppMessage(number, mainMenu(lang));
          return;
        }

        // FAQ session.
        if (faqMode.has(number)) {
          if (text === "8") {
            sendWhatsAppMessage(number, faqCategoryMenu(lang));
            return;
          }

          const categories = {
            "1": "franchise",
            "2": "transport",
            "3": "warehouse",
            "4": "supplier"
          };

          const category = categories[text];

          if (category && Array.isArray(faq[lang]?.[category])) {
            let reply = lang === "ur"
              ? "❓ اکثر پوچھے جانے والے سوالات\n\n"
              : "❓ Frequently Asked Questions\n\n";

            faq[lang][category].forEach((item, i) => {
              reply += `${i + 1}. ${item.question}\n\n${item.answer}\n\n`;
            });

            reply += lang === "ur"
              ? "مین مینو کے لیے 0 بھیجیں۔"
              : "Reply 0 for Main Menu.";

            sendWhatsAppMessage(number, reply);
            return;
          }

          sendWhatsAppMessage(number, faqCategoryMenu(lang));
          return;
        }

        // Tender category session.
        if (tenderMode.has(number)) {
          if (text === "6") {
            sendWhatsAppMessage(number, tenderMenu(lang));
          } else {
            sendWhatsAppMessage(number, tenderReply(lang, text));
          }
          return;
        }

        // Free Franchise with existing Google Sheets check.
        if (text === "4") {
          const alreadyApplied = await numberExists(number);

          if (alreadyApplied || isRegistered(number)) {
            sendWhatsAppMessage(
              number,
              lang === "ur"
                ? `آپ کی درخواست پہلے ہی ریکارڈ میں موجود ہے۔

مزید معلومات:
info@fcsexpress.com.pk

مین مینو کے لیے 0 بھیجیں۔`
                : `Your application is already recorded.

For information:
info@fcsexpress.com.pk

Reply 0 for Main Menu.`
            );
            return;
          }

          const reply = startApplication(number);
          sendWhatsAppMessage(number, reply);
          return;
        }

        // City Business Center.
        if (text === "5") {
          sendWhatsAppMessage(number, businessCenterMessage(lang));
          return;
        }

        // Tenders.
        if (text === "6") {
          tenderMode.add(number);
          sendWhatsAppMessage(number, tenderMenu(lang));
          return;
        }

        // Career.
        if (text === "7") {
          sendWhatsAppMessage(number, careerMessage(lang));
          return;
        }

        // FAQs.
        if (text === "8") {
          faqMode.set(number, true);
          sendWhatsAppMessage(number, faqCategoryMenu(lang));
          return;
        }

        // Other information options.
        const info = informationMessage(text, lang);
        if (info) {
          sendWhatsAppMessage(number, info);
          return;
        }

        // Existing AI assistant.
        const reply = await getReply(number, customerText);
        sendWhatsAppMessage(number, reply);

      } catch (error) {
        console.error("Webhook Error:", error);
      }
    });

    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("FCS Express WhatsApp Bot Started");
  console.log("Port:", PORT);
});
