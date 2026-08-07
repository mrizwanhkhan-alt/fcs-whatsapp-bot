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
  startSupplier,
  isSupplierRegistering,
  handleSupplier
} = require("./supplierHandler");

const {
  startTransport,
  isTransportRegistering,
  handleTransport
} = require("./transportHandler");

const {
  startWarehouse,
  isWarehouseRegistering,
  handleWarehouse
} = require("./warehouseHandler");

const {
  numberExists
} = require("./googleSheets");

const faq = require("./faq");
const faqMode = new Map();

const {
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu
} = require("./language");

const {
  isBlocked
} = require("./blockedUsers");

const {
  isRegistered,
  getRegisteredUser
} = require("./registeredUsers");

const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;


// ========================================
// SEND WHATSAPP MESSAGE
// ========================================

function sendWhatsAppMessage(to, message) {

  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    console.error("WhatsApp credentials missing.");
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

  const options = {
    hostname: "graph.facebook.com",
    port: 443,
    path: `/v21.0/${PHONE_NUMBER_ID}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  const request = https.request(
    options,
    (response) => {

      let result = "";

      response.on("data", (chunk) => {
        result += chunk.toString();
      });

      response.on("end", () => {
        console.log(
          "WhatsApp Response:",
          response.statusCode,
          result
        );
      });
    }
  );

  request.on("error", (error) => {
    console.error(
      "WhatsApp Error:",
      error.message
    );
  });

  request.write(data);
  request.end();
}


// ========================================
// FAQ CATEGORY MENU
// ========================================

function faqCategoryMenu(lang) {

  return lang === "ur"

    ? `❓ اکثر پوچھے جانے والے سوالات

کیٹیگری منتخب کریں:

1️⃣ فرنچائز پارٹنر
2️⃣ ٹرانسپورٹ پارٹنر
3️⃣ ویئر ہاؤس اور ٹرک اڈہ
4️⃣ سپلائر / وینڈر

🏠 مین مینو کے لیے 0 بھیجیں`

    : `❓ Frequently Asked Questions

Select Category:

1️⃣ Franchise Partner
2️⃣ Transport Partner
3️⃣ Warehouse & Truck Adda
4️⃣ Supplier / Vendor

🏠 Reply 0 for Main Menu`;
}


// ========================================
// SERVER
// ========================================

const server = http.createServer((req, res) => {

  const host =
    req.headers.host || "localhost";

  const url =
    new URL(
      req.url,
      `http://${host}`
    );


  // HOME

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


  // ========================================
  // VERIFY WEBHOOK
  // ========================================

  if (
    req.method === "GET" &&
    url.pathname === "/webhook"
  ) {

    const mode =
      url.searchParams.get("hub.mode");

    const token =
      url.searchParams.get(
        "hub.verify_token"
      );

    const challenge =
      url.searchParams.get(
        "hub.challenge"
      );

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN
    ) {

      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      return res.end(
        challenge || ""
      );
    }

    res.writeHead(403);

    return res.end(
      "Verification failed"
    );
  }


  // ========================================
  // RECEIVE WHATSAPP MESSAGE
  // ========================================

  if (
    req.method === "POST" &&
    url.pathname === "/webhook"
  ) {

    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {

      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      res.end("EVENT_RECEIVED");

      try {

        const data = JSON.parse(body);

        const message =
          data.entry?.[0]
            ?.changes?.[0]
            ?.value
            ?.messages?.[0];

        if (!message) {
          return;
        }

        const customerNumber =
          String(message.from);

        const customerText =
          message.text?.body || "";

        const text =
          customerText.trim();

        console.log(
          "Customer:",
          customerNumber
        );

        console.log(
          "Message:",
          text
        );


        // ========================================
        // BLOCKED USERS
        // ========================================

        if (isBlocked(customerNumber)) {

          console.log(
            "Blocked:",
            customerNumber
          );

          return;
        }


        // ========================================
        // COMPLETED / REGISTERED USERS
        // ========================================

        if (isRegistered(customerNumber)) {

          const user =
            getRegisteredUser(
              customerNumber
            );

          if (user) {

            user.postMessages =
              (user.postMessages || 0) + 1;

            if (user.postMessages <= 2) {
              return;
            }

            user.warnings =
              (user.warnings || 0) + 1;

            if (user.warnings <= 3) {

              sendWhatsAppMessage(
                customerNumber,
                `Warning ${user.warnings}/3

Application received.

Please avoid unnecessary messages. Our team will contact you after reviewing your application.`
              );
            }

            return;
          }
        }


        // ========================================
        // LANGUAGE SELECTION
        // ========================================

        if (!hasLanguage(customerNumber)) {

          if (text === "1") {

            setLanguage(
              customerNumber,
              "en"
            );

            sendWhatsAppMessage(
              customerNumber,
              mainMenu("en")
            );

            return;
          }

          if (text === "2") {

            setLanguage(
              customerNumber,
              "ur"
            );

            sendWhatsAppMessage(
              customerNumber,
              mainMenu("ur")
            );

            return;
          }

          sendWhatsAppMessage(
            customerNumber,
            languageMenu()
          );

          return;
        }


        const lang =
          getLanguage(customerNumber) ||
          "en";


        // ========================================
        // CONTINUE FRANCHISE APPLICATION
        // ========================================

        if (isApplying(customerNumber)) {

          const result =
            await handleApplication(
              customerNumber,
              customerText
            );

          sendWhatsAppMessage(
            customerNumber,
            result.reply
          );

          return;
        }


        // ========================================
        // CONTINUE SUPPLIER REGISTRATION
        // ========================================

        if (
          isSupplierRegistering(
            customerNumber
          )
        ) {

          const result =
            await handleSupplier(
              customerNumber,
              customerText
            );

          sendWhatsAppMessage(
            customerNumber,
            result.reply
          );

          return;
        }


        // ========================================
        // CONTINUE TRANSPORT REGISTRATION
        // ========================================

        if (
          isTransportRegistering(
            customerNumber
          )
        ) {

          const result =
            await handleTransport(
              customerNumber,
              customerText
            );

          sendWhatsAppMessage(
            customerNumber,
            result.reply
          );

          return;
        }


        // ========================================
        // CONTINUE WAREHOUSE REGISTRATION
        // ========================================

        if (
          isWarehouseRegistering(
            customerNumber
          )
        ) {

          const result =
            await handleWarehouse(
              customerNumber,
              customerText
            );

          sendWhatsAppMessage(
            customerNumber,
            result.reply
          );

          return;
        }


        // ========================================
        // FAQ MODE
        // ========================================

        if (faqMode.has(customerNumber)) {

          if (text === "0") {

            faqMode.delete(
              customerNumber
            );

            sendWhatsAppMessage(
              customerNumber,
              mainMenu(lang)
            );

            return;
          }

          if (text === "8") {

            sendWhatsAppMessage(
              customerNumber,
              faqCategoryMenu(lang)
            );

            return;
          }

          let category = null;

          if (text === "1") {
            category = "franchise";
          }

          else if (text === "2") {
            category = "transport";
          }

          else if (text === "3") {
            category = "warehouse";
          }

          else if (text === "4") {
            category = "supplier";
          }

          if (category) {

            const faqList =
              faq[lang][category];

            let reply =
              lang === "ur"

                ? "❓ اکثر پوچھے جانے والے سوالات\n\n"

                : "❓ Frequently Asked Questions\n\n";

            faqList.forEach(
              (item, index) => {

                reply +=
                  `${index + 1}. ${item.question}\n\n${item.answer}\n\n`;
              }
            );

            reply +=
              lang === "ur"

                ? "\n↩️ FAQ کیٹیگریز کے لیے 8 بھیجیں۔\n🏠 مین مینو کے لیے 0 بھیجیں۔"

                : "\n↩️ Reply 8 to view FAQ categories again.\n🏠 Reply 0 for Main Menu.";

            sendWhatsAppMessage(
              customerNumber,
              reply
            );

            return;
          }

          sendWhatsAppMessage(
            customerNumber,
            faqCategoryMenu(lang)
          );

          return;
        }


        // ========================================
        // MAIN MENU - 1 ABOUT FCS
        // ========================================

        if (text === "1") {

          sendWhatsAppMessage(
            customerNumber,

            lang === "ur"

              ? `🏢 ایف سی ایس ایکسپریس پاکستان

ایف سی ایس ایکسپریس پاکستان ایک جدید لاجسٹکس اور کورئیر کمپنی ہے جو ملک بھر میں محفوظ، قابلِ اعتماد اور جدید ٹیکنالوجی پر مبنی ترسیلی خدمات فراہم کرنے کے لیے پرعزم ہے۔

ہمارا مقصد تیز رفتار، معیاری اور قابلِ اعتماد لاجسٹکس نیٹ ورک کے ذریعے کاروباروں اور افراد کو بہترین خدمات فراہم کرنا ہے۔

ہم ایکسپریس پارسل ڈیلیوری، ای کامرس لاجسٹکس، کارپوریٹ شپنگ، ویئرہاؤسنگ، فل فلمنٹ اور لاسٹ مائل ڈیلیوری سمیت مکمل لاجسٹکس سلوشنز فراہم کرتے ہیں۔

🌐 ویب سائٹ:
www.fcsexpress.com.pk`

              : `🏢 About FCS Express Pakistan

FCS Express Pakistan is a modern logistics and courier company committed to delivering reliable, secure, and technology-driven shipping solutions across the country.

Our mission is to connect businesses and individuals through a nationwide logistics network built on speed, trust, innovation, and exceptional customer service.

We provide express parcel delivery, e-commerce logistics, corporate shipping, warehousing, fulfilment, and last-mile delivery.

🌐 Website:
www.fcsexpress.com.pk`
          );

          return;
        }


        // ========================================
        // MAIN MENU - 2 NETWORK
        // ========================================

        if (text === "2") {

          sendWhatsAppMessage(
            customerNumber,

            lang === "ur"

              ? `🌍 ہمارا ملک گیر نیٹ ورک

ایف سی ایس ایکسپریس پاکستان بھر میں ایک جدید اور تیزی سے ترقی کرتا ہوا لاجسٹکس نیٹ ورک قائم کر رہا ہے۔

🏢 7 نیشنل ڈسٹری بیوشن سینٹرز
🏢 14 ریجنل ڈسٹری بیوشن سینٹرز
🏙️ 170 سٹی ہبز
📦 2,530+ سروس پوائنٹ فرنچائزز

🌐 ویب سائٹ:
www.fcsexpress.com.pk`

              : `🌍 Our Nationwide Network

FCS Express is developing one of Pakistan's most comprehensive logistics and courier networks.

🏢 7 National Distribution Centers
🏢 14 Regional Distribution Centers
🏙️ 170 City Hubs
📦 2,530+ Service Point Franchises

🌐 Website:
www.fcsexpress.com.pk`
          );

          return;
        }


        // ========================================
        // MAIN MENU - 3 SERVICES
        // ========================================

        if (text === "3") {

          sendWhatsAppMessage(
            customerNumber,

            lang === "ur"

              ? `🚚 ہماری سروسز

📦 ایکسپریس پارسل ڈیلیوری
🚀 سیم ڈے اور نیکسٹ ڈے ڈیلیوری
🏢 کارپوریٹ لاجسٹکس سلوشنز
🛒 ای کامرس ڈیلیوری
💰 کیش آن ڈیلیوری
🏬 ویئرہاؤسنگ اور فل فلمنٹ
🚛 لاسٹ مائل ڈیلیوری
🌍 ملک گیر ڈسٹری بیوشن

🌐 ویب سائٹ:
www.fcsexpress.com.pk`

              : `🚚 Our Services

📦 Express Parcel Delivery
🚀 Same-Day & Next-Day Delivery
🏢 Corporate Logistics Solutions
🛒 E-commerce Delivery
💰 Cash on Delivery
🏬 Warehousing & Fulfilment
🚛 Last-Mile Delivery
🌍 Nationwide Distribution

🌐 Website:
www.fcsexpress.com.pk`
          );

          return;
        }


        // ========================================
        // MAIN MENU - 4 FRANCHISE
        // ========================================

        if (text === "4") {

          faqMode.delete(
            customerNumber
          );

          const alreadyApplied =
            await numberExists(
              customerNumber
            );

          if (alreadyApplied) {

            sendWhatsAppMessage(
              customerNumber,

              lang === "ur"

                ? `⚠️ ہمارے ریکارڈ کے مطابق اس واٹس ایپ نمبر سے پہلے ہی فرنچائز درخواست جمع کرائی جا چکی ہے۔

📱 WhatsApp: +92 316 0034207
📧 Email: franchise@fcsexpress.com.pk`

                : `⚠️ Our records show that a franchise application has already been submitted using this WhatsApp number.

📱 WhatsApp: +92 316 0034207
📧 Email: franchise@fcsexpress.com.pk`
            );

            return;
          }

          const reply =
            startApplication(
              customerNumber
            );

          sendWhatsAppMessage(
            customerNumber,
            reply
          );

          return;
        }


        // ========================================
        // MAIN MENU - 5 SUPPLIER
        // ========================================

        if (text === "5") {

          faqMode.delete(
            customerNumber
          );

          const reply =
            startSupplier(
              customerNumber,
              lang
            );

          sendWhatsAppMessage(
            customerNumber,
            reply
          );

          return;
        }


        // ========================================
        // MAIN MENU - 6 TRANSPORT
        // ========================================

        if (text === "6") {

          faqMode.delete(
            customerNumber
          );

          const reply =
            startTransport(
              customerNumber,
              lang
            );

          sendWhatsAppMessage(
            customerNumber,
            reply
          );

          return;
        }


        // ========================================
        // MAIN MENU - 7 WAREHOUSE
        // ========================================

        if (text === "7") {

          faqMode.delete(
            customerNumber
          );

          const reply =
            startWarehouse(
              customerNumber,
              lang
            );

          sendWhatsAppMessage(
            customerNumber,
            reply
          );

          return;
        }


        // ========================================
        // MAIN MENU - 8 FAQ
        // ========================================

        if (text === "8") {

          faqMode.set(
            customerNumber,
            true
          );

          sendWhatsAppMessage(
            customerNumber,
            faqCategoryMenu(lang)
          );

          return;
        }


        // ========================================
        // MAIN MENU - 9 WHY FCS
        // ========================================

        if (text === "9") {

          sendWhatsAppMessage(
            customerNumber,

            lang === "ur"

              ? `⭐ ایف سی ایس ایکسپریس کیوں منتخب کریں؟

✅ ملک گیر لاجسٹکس نیٹ ورک
✅ تیز رفتار اور قابلِ اعتماد ترسیل
✅ محفوظ شپمنٹ ہینڈلنگ
✅ جدید ٹیکنالوجی
✅ پیشہ ور کسٹمر سپورٹ
✅ بزنس اور ای کامرس سلوشنز

🌐 ویب سائٹ:
www.fcsexpress.com.pk`

              : `⭐ Why Choose FCS Express?

✅ Nationwide Logistics Network
✅ Fast & Reliable Deliveries
✅ Safe Shipment Handling
✅ Modern Technology
✅ Professional Customer Support
✅ Business & E-commerce Solutions

🌐 Website:
www.fcsexpress.com.pk`
          );

          return;
        }


        // ========================================
        // MAIN MENU - 10 CONTACT
        // ========================================

        if (text === "10") {

          sendWhatsAppMessage(
            customerNumber,

            lang === "ur"

              ? `📞 ایف سی ایس ایکسپریس رابطہ

📍 فرنچائز ڈویلپمنٹ دفاتر:
• کراچی
• لاہور
• اسلام آباد
• پشاور
• کوئٹہ
• مظفرآباد

📧 Email:
info@fcsexpress.com.pk

📱 WhatsApp:
+92 316 0034207

🌐 Website:
www.fcsexpress.com.pk`

              : `📞 FCS Express Contact

📍 Franchise Development Offices:
• Karachi
• Lahore
• Islamabad
• Peshawar
• Quetta
• Muzaffarabad

📧 Email:
info@fcsexpress.com.pk

📱 WhatsApp:
+92 316 0034207

🌐 Website:
www.fcsexpress.com.pk`
          );

          return;
        }


        // ========================================
        // NORMAL AI CHAT
        // ========================================

        const reply =
          await getReply(
            customerNumber,
            customerText
          );

        sendWhatsAppMessage(
          customerNumber,
          reply
        );

      } catch (error) {

        console.error(
          "Webhook Error:",
          error
        );
      }
    });

    return;
  }


  // 404

  res.writeHead(404, {
    "Content-Type": "text/plain"
  });

  res.end("Not Found");
});


// ========================================
// START SERVER
// ========================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "FCS Express WhatsApp Bot Started"
    );

    console.log(
      "Port:",
      PORT
    );
  }
);
