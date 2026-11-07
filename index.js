
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const { adminDashboard } = require("./adminDashboard");
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

const {
  startJob,
  isJobActive,
  handleJob,
  handleJobDocument
} = require("./jobHandler");

const { numberExists } = require("./googleSheets");
const businessTender = require("./businessTenderHandler");
const faq = require("./faq");

const {
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu
} = require("./language");

const { isBlocked } = require("./blockedUsers");

const faqMode = new Set();
const tenderMode = new Set();

const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;

// =====================================
// WHATSAPP MESSAGE SENDING
// =====================================

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
      body: String(message)
    }
  });

  const request = https.request({
    hostname: "graph.facebook.com",
    port: 443,
    path: `/v21.0/${PHONE_NUMBER_ID}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  }, response => {
    let result = "";

    response.on("data", chunk => {
      result += chunk.toString();
    });

    response.on("end", () => {
      console.log(
        "WhatsApp Response:",
        response.statusCode,
        result
      );
    });
  });

  request.on("error", error => {
    console.error("WhatsApp Error:", error.message);
  });

  request.write(data);
  request.end();
}

// =====================================
// CALLING WEBHOOK EVENT HANDLER
// =====================================

function handleCallingEvent(call) {
  if (!call || typeof call !== "object") return;

  const event = {
    callId: call.id || null,
    from: call.from || null,
    to: call.to || null,
    event: call.event || null,
    status: call.status || null,
    direction: call.direction || null,
    timestamp: new Date().toISOString()
  };

  console.log(
    "FCS Calling Event:",
    JSON.stringify(event)
  );

  if (call.event === "connect") {
    console.log("Incoming call connection requested");
  }

  if (call.event === "terminate") {
    console.log("Call termination event received");
  }
}

// =====================================
// FAQ MENU
// =====================================

function faqCategoryMenu(lang) {
  if (lang === "ur") {
    return `❓ اکثر پوچھے جانے والے سوالات

1. فرنچائز
2. ٹرانسپورٹ
3. ویئر ہاؤس / ٹرک اڈہ
4. سپلائر / وینڈر

مین مینو کے لیے 0 بھیجیں۔`;
  }

  return `❓ Frequently Asked Questions

1. Franchise
2. Transport
3. Warehouse / Truck Adda
4. Supplier / Vendor

Reply 0 for Main Menu.`;
}

// =====================================
// INFORMATION RESPONSES
// =====================================

function informationMessage(option, lang) {
  const ur = {
    "1": `🏢 ایف سی ایس ایکسپریس پاکستان

FCS Express Logistics & Transport
ایک لاجسٹکس اور ٹرانسپورٹ کمپنی ہے۔

ہم پارسل ڈیلیوری، ای کامرس، فریٹ، کارپوریٹ لاجسٹکس اور ڈسٹری بیوشن کے شعبوں میں کام کر رہے ہیں۔

www.fcsexpress.com.pk`,

    "2": `🌍 ایف سی ایس ملک گیر نیٹ ورک

7 National Distribution Centers
14 Regional Distribution Centers
170 City Hubs
2,530+ Service Point Franchises

www.fcsexpress.com.pk`,

    "3": `🚚 ایف سی ایس خدمات

• پارسل کلیکشن اور ڈیلیوری
• ای کامرس لاجسٹکس
• کیش آن ڈیلیوری (COD)
• فریٹ بکنگ اور ہینڈلنگ
• ویئر ہاؤسنگ
• کارپوریٹ لاجسٹکس
• ملک گیر ڈسٹری بیوشن

www.fcsexpress.com.pk`,

    "9": `📞 ایف سی ایس رابطہ

FCS Express Pakistan
Lahore, Pakistan

Office: 042 3246 2221
Email: info@fcsexpress.com.pk
Website: www.fcsexpress.com.pk`,

    "10": `⭐ ایف سی ایس ایکسپریس کیوں؟

• ملک گیر لاجسٹکس نیٹ ورک
• جدید ٹیکنالوجی
• بین الاقوامی پلیٹ فارم
• کاروباری مواقع
• فرنچائز اور بزنس سپورٹ

www.fcsexpress.com.pk`
  };

  const en = {
    "1": `🏢 ABOUT FCS EXPRESS

FCS Express Logistics & Transport is a logistics and transport company.

Our business areas include parcel delivery, e-commerce, freight, corporate logistics and distribution.

www.fcsexpress.com.pk`,

    "2": `🌍 FCS NATIONWIDE NETWORK

7 National Distribution Centers
14 Regional Distribution Centers
170 City Hubs
2,530+ Service Point Franchises

www.fcsexpress.com.pk`,

    "3": `🚚 FCS SERVICES

• Parcel Collection and Delivery
• E-commerce Logistics
• Cash on Delivery (COD)
• Freight Booking and Handling
• Warehousing
• Corporate Logistics
• Nationwide Distribution

www.fcsexpress.com.pk`,

    "9": `📞 CONTACT FCS EXPRESS

FCS Express Pakistan
Lahore, Pakistan

Office: 042 3246 2221
Email: info@fcsexpress.com.pk
Website: www.fcsexpress.com.pk`,

    "10": `⭐ WHY CHOOSE FCS EXPRESS?

• Nationwide Logistics Network
• Modern Technology
• International Platform
• Business Opportunities
• Franchise and Business Support

www.fcsexpress.com.pk`
  };

  const reply = (lang === "ur" ? ur : en)[option];

  if (!reply) return null;

  return reply + (
    lang === "ur"
      ? "\n\nمین مینو کے لیے 0 بھیجیں۔"
      : "\n\nReply 0 for Main Menu."
  );
}

// =====================================
// HANDLE INCOMING MESSAGES
// =====================================

async function processMessage(message) {
  const number = String(message.from || "");

  if (!number || isBlocked(number)) return;

  const type = message.type;

  const customerText =
    type === "text"
      ? (message.text?.body || "")
      : "";

  const text = customerText.trim();

  // JOB CV DOCUMENT HANDLING

  if (type === "document") {
    if (isJobActive(number)) {
      const result = await handleJobDocument(
        number,
        message.document
      );

      if (result && result.reply) {
        sendWhatsAppMessage(number, result.reply);
      }
    }

    return;
  }

  if (type !== "text") return;

  console.log("Customer:", number);
  console.log("Message:", text);

  // FRANCHISE APPLICATION

  if (isApplying(number)) {
    const result = await handleApplication(
      number,
      customerText
    );

    if (result && result.reply) {
      sendWhatsAppMessage(number, result.reply);
    }

    return;
  }

  // SUPPLIER REGISTRATION

  if (isSupplierRegistering(number)) {
    const result = await handleSupplier(
      number,
      customerText
    );

    if (result && result.reply) {
      sendWhatsAppMessage(number, result.reply);
    }

    return;
  }

  // TRANSPORT REGISTRATION

  if (isTransportRegistering(number)) {
    const result = await handleTransport(
      number,
      customerText
    );

    if (result && result.reply) {
      sendWhatsAppMessage(number, result.reply);
    }

    return;
  }

  // WAREHOUSE REGISTRATION

  if (isWarehouseRegistering(number)) {
    const result = await handleWarehouse(
      number,
      customerText
    );

    if (result && result.reply) {
      sendWhatsAppMessage(number, result.reply);
    }

    return;
  }

  // JOB APPLICATION

  if (isJobActive(number)) {
    const result = await handleJob(
      number,
      customerText
    );

    if (result && result.reply) {
      sendWhatsAppMessage(number, result.reply);
    }

    return;
  }

  // BUSINESS CENTER / TENDER

  if (businessTender.isActive(number)) {
    const result = await businessTender.handle(
      number,
      customerText
    );

    if (result && result.reply) {
      sendWhatsAppMessage(number, result.reply);
    }

    return;
  }

  // LANGUAGE SELECTION

  if (!hasLanguage(number)) {
    if (text === "1" || text === "2") {
      const selected = text === "1" ? "en" : "ur";

      setLanguage(number, selected);

      sendWhatsAppMessage(
        number,
        mainMenu(selected)
      );
    } else {
      sendWhatsAppMessage(
        number,
        languageMenu()
      );
    }

    return;
  }

  const lang = getLanguage(number) || "en";

  // MAIN MENU

  if (
    text === "0" ||
    text.toLowerCase() === "menu" ||
    text.toLowerCase() === "main menu"
  ) {
    faqMode.delete(number);
    tenderMode.delete(number);

    sendWhatsAppMessage(
      number,
      mainMenu(lang)
    );

    return;
  }

  // FAQ SESSION

  if (faqMode.has(number)) {
    if (text === "8") {
      sendWhatsAppMessage(
        number,
        faqCategoryMenu(lang)
      );

      return;
    }

    const categories = {
      "1": "franchise",
      "2": "transport",
      "3": "warehouse",
      "4": "supplier"
    };

    const category = categories[text];

    const items = category
      ? faq[lang]?.[category]
      : null;

    if (Array.isArray(items)) {
      let reply = lang === "ur"
        ? "❓ اکثر پوچھے جانے والے سوالات\n\n"
        : "❓ Frequently Asked Questions\n\n";

      items.forEach((item, index) => {
        reply += `${index + 1}. ${item.question}\n\n${item.answer}\n\n`;
      });

      reply += lang === "ur"
        ? "\nمین مینو کے لیے 0 بھیجیں۔"
        : "\nReply 0 for Main Menu.";

      sendWhatsAppMessage(number, reply);
    } else {
      sendWhatsAppMessage(
        number,
        faqCategoryMenu(lang)
      );
    }

    return;
  }

  // TENDER SELECTION

  if (tenderMode.has(number)) {
    if (/^(10|[1-9])$/.test(text)) {
      tenderMode.delete(number);

      const reply = businessTender.startTender(
        number,
        lang,
        text
      );

      sendWhatsAppMessage(number, reply);
    } else {
      sendWhatsAppMessage(
        number,
        businessTender.tenderMenu(lang)
      );
    }

    return;
  }

  // OPTION 4 - FREE FRANCHISE

  if (text === "4") {
    const alreadyApplied = await numberExists(number);

    if (alreadyApplied) {
      sendWhatsAppMessage(
        number,
        lang === "ur"
          ? `آپ کی فرنچائز درخواست پہلے سے ریکارڈ میں موجود ہے۔

مزید معلومات:
info@fcsexpress.com.pk

مین مینو کے لیے 0 بھیجیں۔`
          : `Your franchise application is already recorded.

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

  // OPTION 5 - CITY BUSINESS CENTER

  if (text === "5") {
    const reply = businessTender.startBusiness(
      number,
      lang
    );

    sendWhatsAppMessage(number, reply);
    return;
  }

  // OPTION 6 - TENDERS

  if (text === "6") {
    tenderMode.add(number);

    sendWhatsAppMessage(
      number,
      businessTender.tenderMenu(lang)
    );

    return;
  }

  // OPTION 7 - JOB APPLICATION

  if (text === "7") {
    const reply = startJob(number, lang);

    sendWhatsAppMessage(number, reply);
    return;
  }

  // OPTION 8 - FAQ

  if (text === "8") {
    faqMode.add(number);

    sendWhatsAppMessage(
      number,
      faqCategoryMenu(lang)
    );

    return;
  }

  // OTHER MENU OPTIONS

  const info = informationMessage(text, lang);

  if (info) {
    sendWhatsAppMessage(number, info);
    return;
  }

  // AI ASSISTANT

  const reply = await getReply(
    number,
    customerText
  );

  sendWhatsAppMessage(number, reply);
}

// =====================================
// HTTP SERVER
// =====================================

const server = http.createServer((req, res) => {

  // ADMIN DASHBOARD

  if (
    req.method === "GET" &&
    adminDashboard(req, res)
  ) {
    return;
  }

  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  // HOME / HEALTH CHECK

  if (
    req.method === "GET" &&
    url.pathname === "/"
  ) {
    res.writeHead(200, {
      "Content-Type": "text/plain"
    });

    return res.end(
      "FCS Express WhatsApp Bot Running"
    );
  }

  // STAFF CALLING PANEL

  if (
    req.method === "GET" &&
    url.pathname === "/staff-calling"
  ) {
    const filePath = path.join(
      __dirname,
      "staffCalling.html"
    );

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.writeHead(404, {
          "Content-Type": "text/plain"
        });

        return res.end("Calling panel file not found");
      }

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      });

      res.end(content);
    });

    return;
  }

  // META WEBHOOK VERIFICATION

  if (
    req.method === "GET" &&
    url.pathname === "/webhook"
  ) {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN
    ) {
      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      return res.end(challenge || "");
    }

    res.writeHead(403);
    return res.end("Verification failed");
  }

  // META WEBHOOK: MESSAGES + CALLS

  if (
    req.method === "POST" &&
    url.pathname === "/webhook"
  ) {
    let body = "";
    let tooLarge = false;

    req.on("data", chunk => {
      if (tooLarge) return;

      body += chunk.toString();

      if (Buffer.byteLength(body) > 1024 * 1024) {
        tooLarge = true;
        res.writeHead(413);
        res.end("Payload Too Large");
      }
    });

    req.on("end", async () => {
      if (tooLarge) return;

      let data;

      try {
        data = JSON.parse(body);
      } catch (error) {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }

      res.writeHead(200, {
        "Content-Type": "text/plain"
      });
      res.end("EVENT_RECEIVED");

      try {
        for (const entry of data.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value || {};

            // CALLING EVENTS

            for (const call of value.calls || []) {
              try {
                handleCallingEvent(call);
              } catch (error) {
                console.error(
                  "Calling Event Error:",
                  error.message
                );
              }
            }

            // EXISTING WHATSAPP MESSAGES

            for (const message of value.messages || []) {
              try {
                await processMessage(message);
              } catch (error) {
                console.error(
                  "Message Processing Error:",
                  error
                );
              }
            }
          }
        }
      } catch (error) {
        console.error(
          "Webhook Processing Error:",
          error
        );
      }
    });

    req.on("error", error => {
      console.error("Webhook Request Error:", error);
    });

    return;
  }

  // NOT FOUND

  res.writeHead(404, {
    "Content-Type": "text/plain"
  });

  res.end("Not Found");
});

// =====================================
// START SERVER
// =====================================

server.listen(PORT, "0.0.0.0", () => {
  console.log("FCS Express WhatsApp Bot Started");
  console.log("Port:", PORT);
});
