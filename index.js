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
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu
} = require("./language");


const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;


// SEND WHATSAPP MESSAGE
function sendWhatsAppMessage(to, message) {

  if (!PHONE_NUMBER_ID) {
    console.error("PHONE_NUMBER_ID is missing.");
    return;
  }


  if (!WHATSAPP_TOKEN) {
    console.error("WHATSAPP_TOKEN is missing.");
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

    path:
      `/v21.0/${PHONE_NUMBER_ID}/messages`,

    method: "POST",

    headers: {

      "Content-Type": "application/json",

      "Authorization":
        `Bearer ${WHATSAPP_TOKEN}`

    }

  };


  const request = https.request(
    options,
    (response) => {

      let result = "";

      response.on(
        "data",
        (chunk) => {
          result += chunk;
        }
      );


      response.on(
        "end",
        () => {

          if (response.statusCode >= 400) {

            console.error(
              "WhatsApp Error:",
              result
            );

          } else {

            console.log(
              "WhatsApp Sent:",
              result
            );

          }

        }
      );

    }
  );


  request.on(
    "error",
    (error) => {

      console.error(
        "WhatsApp Request Error:",
        error.message
      );

    }
  );


  request.write(data);

  request.end();

}
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
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu
} = require("./language");


const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;


// SEND WHATSAPP MESSAGE
function sendWhatsAppMessage(to, message) {

  if (!PHONE_NUMBER_ID) {
    console.error("PHONE_NUMBER_ID is missing.");
    return;
  }


  if (!WHATSAPP_TOKEN) {
    console.error("WHATSAPP_TOKEN is missing.");
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

    path:
      `/v21.0/${PHONE_NUMBER_ID}/messages`,

    method: "POST",

    headers: {

      "Content-Type": "application/json",

      "Authorization":
        `Bearer ${WHATSAPP_TOKEN}`

    }

  };


  const request = https.request(
    options,
    (response) => {

      let result = "";

      response.on(
        "data",
        (chunk) => {
          result += chunk;
        }
      );


      response.on(
        "end",
        () => {

          if (response.statusCode >= 400) {

            console.error(
              "WhatsApp Error:",
              result
            );

          } else {

            console.log(
              "WhatsApp Sent:",
              result
            );

          }

        }
      );

    }
  );


  request.on(
    "error",
    (error) => {

      console.error(
        "WhatsApp Request Error:",
        error.message
      );

    }
  );


  request.write(data);

  request.end();

}
const text =
  customerText.trim();
// ==============================
// LANGUAGE SELECTION
// ==============================

if (!hasLanguage(customerNumber)) {

  if (text === "1") {

    setLanguage(customerNumber, "en");

    sendWhatsAppMessage(
      customerNumber,
`🇵🇰 Welcome to FCS Express Pakistan

Assalam-o-Alaikum!

I am Ghulam Qadir, your Franchise Development Assistant.

Please reply with a number:

1️⃣ About FCS Express
2️⃣ Our Nationwide Network
3️⃣ Our Services
4️⃣ Why Choose FCS Express
5️⃣ Franchise Opportunity
6️⃣ Apply for Franchise
7️⃣ Frequently Asked Questions
8️⃣ Contact Franchise Team`
    );

    return;
  }


  if (text === "2") {

    setLanguage(customerNumber, "ur");

    sendWhatsAppMessage(
      customerNumber,
`🇵🇰 ایف سی ایس ایکسپریس پاکستان میں خوش آمدید

السلام علیکم!

میں غلام قادر، آپ کا فرنچائز ڈویلپمنٹ اسسٹنٹ ہوں۔

براہِ کرم نمبر منتخب کریں:

1️⃣ ایف سی ایس ایکسپریس کے بارے میں
2️⃣ ہمارا ملک گیر نیٹ ورک
3️⃣ ہماری سروسز
4️⃣ ایف سی ایس ایکسپریس کیوں؟
5️⃣ فرنچائز کا موقع
6️⃣ فرنچائز کے لیے درخواست دیں
7️⃣ اکثر پوچھے جانے والے سوالات
8️⃣ فرنچائز ٹیم سے رابطہ کریں`
    );

    return;
  }


  sendWhatsAppMessage(
    customerNumber,
    languageMenu()
  );

  return;
}


// ==============================
// START FRANCHISE APPLICATION
// ==============================

if (text === "6") {

  const reply =
    startApplication(customerNumber);

  sendWhatsAppMessage(
    customerNumber,
    reply
  );

  return;
}


// ==============================
// CONTINUE APPLICATION
// ==============================

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


// ==============================
// NORMAL AI CHAT
// ==============================

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
  error.message
);

}


});


req.on("error", (error) => {

console.error(
  "Webhook request error:",
  error.message
);

});


return;

}


// 404

res.writeHead(404, {
  "Content-Type": "text/plain"
});


res.end("Not Found");


});


// SERVER START

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log("--------------------------------");
    console.log("FCS Express WhatsApp Bot Started");
    console.log("--------------------------------");

    console.log(
      "Port:",
      PORT
    );

    console.log(
      "PHONE_NUMBER_ID:",
      PHONE_NUMBER_ID ? "Loaded" : "Missing"
    );

    console.log(
      "WHATSAPP_TOKEN:",
      WHATSAPP_TOKEN ? "Loaded" : "Missing"
    );

    console.log(
      "VERIFY_TOKEN:",
      VERIFY_TOKEN ? "Loaded" : "Missing"
    );

    console.log("--------------------------------");

  }
);


process.on(
  "uncaughtException",
  (err) => {

    console.error(
      "Uncaught Exception:",
      err
    );

  }
);


process.on(
  "unhandledRejection",
  (err) => {

    console.error(
      "Unhandled Rejection:",
      err
    );

  }
);
