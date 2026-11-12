
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const { menuFlow, menuList, menuSelection, listSelection } = require("./serviceMenuFlow");
const { callingRoutes, handleCallingWebhook, isVerifiedMetaWebhook, requestRepresentativeCall } = require("./callingRoutes");
const { adminDashboard } = require("./adminDashboard");
const { recordAdminWindows } = require("./adminMessaging");
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

function sendWhatsAppMessage(to, message, interactive, fallbackInteractive) {
  const payload = interactive ? { type: "interactive", interactive } : {
    type: "text",
    text: { preview_url: false, body: String(message) }
  };
  sendWhatsAppPayload(to, payload, status => {
    if (interactive && status >= 400 && status < 500 && status !== 429) {
      sendWhatsAppMessage(to, message, fallbackInteractive);
    }
  });
}

function sendWhatsAppPayload(to, payload, onResponse, onClose) {
  if (!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) {
    console.error("WhatsApp credentials missing");
    return;
  }

  const data = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(to),
    ...payload
  });

  const request = https.request({
    hostname: "graph.facebook.com",
    port: 443,
    path: `/v21.0/${PHONE_NUMBER_ID}/messages`,
    method: "POST",
    ...(onClose ? { timeout: 5000 } : {}),
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
      onResponse?.(response.statusCode, result);
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

  if (onClose) {
    request.once("close", onClose);
    request.once("timeout", () => request.destroy(new Error("WhatsApp menu artwork request timed out")));
  }
  request.write(data);
  request.end();
}

const pendingMenuArtwork = new Map();

function sendMainMenu(number, language, verified) {
  const flow = verified ? menuFlow(number, language) : null;
  const list = verified ? menuList(language) : null;
  const sendMenu = () => sendWhatsAppMessage(number, mainMenu(language), flow || list, flow ? list : null);
  const origin = process.env.RENDER_EXTERNAL_URL;
  if (flow || !list || !origin?.startsWith("https://")) {
    sendMenu();
    return;
  }

  let artworkId;
  sendWhatsAppPayload(number, {
    type: "image",
    image: { link: new URL(`${menuImagePath}?v=5`, origin).href }
  }, (status, result) => {
    if (status < 200 || status >= 300) return;
    try {
      artworkId = JSON.parse(result).messages?.[0]?.id;
    } catch {
      return;
    }
    if (!artworkId) return;
    const finish = () => {
      clearTimeout(timer);
      pendingMenuArtwork.delete(artworkId);
      sendMenu();
    };
    const timer = setTimeout(finish, 6000);
    timer.unref();
    pendingMenuArtwork.set(artworkId, finish);
  }, () => {
    if (!artworkId) sendMenu();
  });
}

const fleetWelcomeImagePath = "/assets/fcs-welcome-v4.jpg";
const welcomeImagePath = "/assets/fcs-welcome-v5.jpg";
const menuImagePath = "/assets/fcs-service-menu.jpg";
const messageAssets = new Map([
  ["/assets/fcs-welcome-v1.jpg", "image/jpeg"],
  ["/assets/fcs-welcome-v2.png", "image/png"],
  ["/assets/fcs-welcome-v3.jpg", "image/jpeg"],
  [fleetWelcomeImagePath, "image/jpeg"],
  [welcomeImagePath, "image/jpeg"],
  [menuImagePath, "image/jpeg"]
]);
const languageButtons = [
  { id: "fcs_welcome_en", title: "English", language: "en" },
  { id: "fcs_welcome_ur", title: "اردو", language: "ur" }
];

function sendWelcomeMessage(number, verified) {
  const fallback = languageMenu();
  const origin = process.env.RENDER_EXTERNAL_URL;
  if (!verified || !origin?.startsWith("https://")) {
    sendWhatsAppMessage(number, fallback);
    return;
  }

  sendWhatsAppMessage(number, fallback, {
    type: "button",
    header: { type: "image", image: { link: new URL(welcomeImagePath, origin).href } },
    body: { text: "*Welcome to FCS Express Pakistan*\n*خوش آمدید*\n\n*براہِ کرم اپنی پسند کی زبان منتخب کریں۔*" },
    action: {
      buttons: languageButtons.map(({ id, title }) => ({ type: "reply", reply: { id, title } }))
    }
  });
}

// =====================================
// FAQ MENU
// =====================================

function faqCategoryMenu(lang) {
  if (lang === "ur") {
    return `❓ اکثر پوچھے جانے والے سوالات

1. فرنچائز

مین مینو کے لیے 0 بھیجیں۔`;
  }

  return `❓ Frequently Asked Questions

1. Franchise

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

واٹس ایپ بوٹ (درخواستوں کے لیے): *+92 316 0034207*
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

WhatsApp Bot (applications): *+92 316 0034207*
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

async function processMessage(message, verified) {
  const number = String(message.from || "");

  if (!number || isBlocked(number)) return;

  const type = message.type;

  let customerText =
    type === "text"
      ? (message.text?.body || "")
      : "";

  let text = customerText.trim();

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

  const languageChoice = verified && type === "interactive" &&
    message.interactive?.type === "button_reply" &&
    languageButtons.find(button => button.id === message.interactive.button_reply?.id);

  const flowReply = verified && type === "interactive" && message.interactive?.type === "nfm_reply";
  const listReply = verified && type === "interactive" && message.interactive?.type === "list_reply";
  if (type !== "text" && !languageChoice && !flowReply && !listReply) return;
  if ((languageChoice || flowReply || listReply) && (isApplying(number) || isSupplierRegistering(number) ||
      isTransportRegistering(number) || isWarehouseRegistering(number) ||
      isJobActive(number) || businessTender.isActive(number))) return;

  if (flowReply || listReply) {
    const selection = flowReply ? menuSelection(number, message.interactive) : listSelection(message.interactive);
    if (!selection) return;
    setLanguage(number, selection.language);
    faqMode.delete(number);
    tenderMode.delete(number);
    customerText = selection.option;
    text = customerText;
  }

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

  if ((text === "10" || text === "11") && !faqMode.has(number) && !tenderMode.has(number)) {
    if (!verified) return;
    const language = getLanguage(number) || "en";
    try {
      await requestRepresentativeCall(message, language);
    } catch (error) {
      console.error("Representative call button failed:", error.status || "network error");
      if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        sendWhatsAppMessage(number, language === "ur"
          ? "آپ کی درخواست ایف سی ایس کو موصول ہو گئی ہے۔ اگر کال کا آئیکن دستیاب ہے تو اسی واٹس ایپ چیٹ سے کال کریں۔"
          : "FCS has received your request. If the call icon is available, use it to call us from this WhatsApp chat.");
      }
    }
    return;
  }

  if (/^(hi|hello)[!.]?$/i.test(text) && verified) {
    faqMode.delete(number);
    tenderMode.delete(number);
    sendWelcomeMessage(number, verified);
    return;
  }

  // LANGUAGE SELECTION

  if (languageChoice || !hasLanguage(number)) {
    if (languageChoice || text === "1" || text === "2") {
      const selected = languageChoice ? languageChoice.language : text === "1" ? "en" : "ur";
      faqMode.delete(number);
      tenderMode.delete(number);

      setLanguage(number, selected);

      sendMainMenu(number, selected, verified);
    } else {
      sendWelcomeMessage(number, verified);
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

    sendMainMenu(number, lang, verified);

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

    const items = text === "1" ? faq[lang]?.franchise : null;

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

  const url = new URL(
    req.url,
    `http://${req.headers.host || "localhost"}`
  );

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    return void adminDashboard(req, res, url);
  }

  // STAFF CALLING API

  if (url.pathname.startsWith("/api/staff-calling/")) {
    Promise.resolve(callingRoutes(req, res, url)).catch(error => {
      console.error("Calling API Error:", error);

      if (!res.headersSent) {
        res.writeHead(500, {
          "Content-Type": "application/json"
        });

        res.end(JSON.stringify({
          error: "Internal server error"
        }));
      }
    });

    return;
  }

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

  const messageAssetType = messageAssets.get(url.pathname);
  if (messageAssetType && (req.method === "GET" || req.method === "HEAD")) {
    const encoded = [menuImagePath, fleetWelcomeImagePath, welcomeImagePath].includes(url.pathname);
    const filename = path.basename(url.pathname) + (encoded ? ".base64" : "");
    fs.readFile(path.join(__dirname, "assets", filename), encoded ? "utf8" : null, (error, contents) => {
      if (error) {
        res.writeHead(404);
        return res.end();
      }
      const image = encoded ? Buffer.from(contents, "base64") : contents;
      res.writeHead(200, {
        "Content-Type": messageAssetType,
        "Content-Length": image.length,
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(req.method === "HEAD" ? undefined : image);
    });
    return;
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
    const chunks = [];
    let size = 0;
    let tooLarge = false;

    req.on("data", chunk => {
      if (tooLarge) return;

      chunks.push(chunk);
      size += chunk.length;

      if (size > 1024 * 1024) {
        tooLarge = true;
        res.writeHead(413);
        res.end("Payload Too Large");
      }
    });

    req.on("end", async () => {
      if (tooLarge) return;

      const rawBody = Buffer.concat(chunks);
      let data;

      try {
        data = JSON.parse(rawBody.toString("utf8"));
      } catch (error) {
        res.writeHead(400);
        res.end("Invalid JSON");
        return;
      }

      // Persist verified calling events BEFORE acknowledging Meta.
      // A storage outage returns 503 so Meta can redeliver the webhook.
      const signature = req.headers["x-hub-signature-256"];
      const verifiedCallWebhook = data.object === "whatsapp_business_account" &&
        isVerifiedMetaWebhook(rawBody, signature);
      if (verifiedCallWebhook) {
        const events = [];
        for (const entry of data.entry || []) for (const change of entry.changes || []) {
          if (change.field !== "calls" || change.value?.metadata?.phone_number_id !== PHONE_NUMBER_ID) continue;
          for (const event of change.value.calls || []) if (event?.id) events.push(event);
          for (const event of change.value.statuses || []) if (event?.type === "call" && event?.id) events.push(event);
        }
        if (events.length) {
          try { await require("./callWebhookInbox").saveVerifiedEvents(events); }
          catch (error) {
            console.error("Durable call webhook intake failed:", error.message);
            res.writeHead(503, { "Content-Type": "text/plain" });
            res.end("Call event storage temporarily unavailable");
            return;
          }
        }
      }

      res.writeHead(200, {
        "Content-Type": "text/plain"
      });
      res.end("EVENT_RECEIVED");

      try {
        handleCallingWebhook(data, rawBody, req.headers["x-hub-signature-256"]);
      } catch (error) {
        console.error("Calling Event Error:", error.message);
      }

      try {
        recordAdminWindows(data, rawBody, req.headers["x-hub-signature-256"]);
      } catch {
        console.error("Could not record admin WhatsApp messaging windows.");
      }

      try {
        const verified = data.object === "whatsapp_business_account" &&
          isVerifiedMetaWebhook(rawBody, req.headers["x-hub-signature-256"]);
        for (const entry of data.entry || []) {
          for (const change of entry.changes || []) {
            const value = change.value || {};
            const verifiedMessage = verified && Boolean(PHONE_NUMBER_ID) &&
              change.field === "messages" && value.metadata?.phone_number_id === PHONE_NUMBER_ID;
            if (verifiedMessage) {
              for (const status of value.statuses || []) {
                if (["delivered", "read", "failed"].includes(status.status)) {
                  pendingMenuArtwork.get(status.id)?.();
                }
              }
            }

            // EXISTING WHATSAPP MESSAGES

            for (const message of value.messages || []) {
              try {
                await processMessage(message, verifiedMessage);
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
