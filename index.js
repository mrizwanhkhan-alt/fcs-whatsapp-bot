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
const faq = require("./faq");
const {
  setLanguage,
  getLanguage,
  hasLanguage,
  languageMenu,
  mainMenu
} = require("./language");


const {
  isBlocked,
  recordAbuse
} = require("./blockedUsers");

const {
  registerUser,
  isRegistered,
  getRegisteredUser
} = require("./registeredUsers");

const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;



// ==============================
// SEND WHATSAPP MESSAGE
// ==============================

function sendWhatsAppMessage(to, message) {


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

          console.log(
            "WhatsApp Response:",
            result
          );

        }
      );

    }
  );



  request.on(
    "error",
    (error) => {

      console.error(
        "WhatsApp Error:",
        error.message
      );

    }
  );


  request.write(data);

  request.end();

}





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




  // VERIFY WEBHOOK

  if (
    req.method === "GET" &&
    url.pathname === "/webhook"
  ) {


    const mode =
      url.searchParams.get(
        "hub.mode"
      );


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
        challenge
      );

    }


    res.writeHead(403);

    return res.end(
      "Verification failed"
    );


  }
    // RECEIVE MESSAGE

  if (
    req.method === "POST" &&
    url.pathname === "/webhook"
  ) {


    let body = "";



    req.on(
      "data",
      (chunk) => {

        body += chunk.toString();

      }
    );



    req.on(
      "end",
      async () => {


        res.writeHead(200);

        res.end(
          "EVENT_RECEIVED"
        );



        try {


          const data =
            JSON.parse(body);



          const message =
            data.entry?.[0]
            ?.changes?.[0]
            ?.value
            ?.messages?.[0];



          if (!message) {

            return;

          }



          const customerNumber =
            message.from;

if (isRegistered(customerNumber)) {

  const user =
    getRegisteredUser(customerNumber);


  sendWhatsAppMessage(
    customerNumber,

    `Your registration is already received.

Reference ID: ${user.referenceId}

Our team will contact you for further processing.`
  );


  return;

}

          if (
            isBlocked(customerNumber)
          ) {

            console.log(
              "Blocked:",
              customerNumber
            );

            return;

          }



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





          // LANGUAGE SELECTION


          if (
            !hasLanguage(customerNumber)
          ) {



            if (text === "1") {


              setLanguage(
                customerNumber,
                "en"
              );


              sendWhatsAppMessage(
                customerNumber,
                mainMenu(
                  getLanguage(customerNumber)
                )
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
                mainMenu(
                  getLanguage(customerNumber)
                )
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
            getLanguage(customerNumber);






          // CONTINUE FRANCHISE APPLICATION


          if (
            isApplying(customerNumber)
          ) {


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






          // CONTINUE SUPPLIER REGISTRATION


          if (
            isSupplierRegistering(customerNumber)
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
                 // ==============================
// MAIN MENU OPTIONS (1 - 10)
// ==============================


if (text === "1") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ?

`🇵🇰 ایف سی ایس ایکسپریس پاکستان

ایف سی ایس ایکسپریس ایک لاجسٹکس نیٹ ورک ہے جو پارسل ڈیلیوری، بزنس لاجسٹکس، ای کامرس اور لاسٹ مائل ڈیلیوری کی سہولیات فراہم کرتا ہے۔

ہم پاکستان بھر میں ایک مضبوط پارٹنر نیٹ ورک بنا رہے ہیں۔

مزید معلومات:
www.fcsexpress.com.pk`

    :

`🇵🇰 FCS Express Pakistan

FCS Express is a logistics network providing parcel delivery, business logistics, e-commerce and last-mile delivery solutions.

We are building a strong partner network across Pakistan.

More information:
www.fcsexpress.com.pk`

  );

  return;

}







if (text === "2") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ?

`🌐 ایف سی ایس ایکسپریس نیٹ ورک

ہمارے نیٹ ورک میں شامل ہیں:

🏢 نیشنل ڈسٹری بیوشن سینٹرز
🏬 ریجنل ڈسٹری بیوشن سینٹرز
📍 سٹی ہبز
📦 ایف سی ایس سروس پوائنٹس

ہم پاکستان بھر میں اپنی لاجسٹکس کوریج کو بڑھا رہے ہیں۔

مزید معلومات:
www.fcsexpress.com.pk`

    :

`🌐 FCS Express Network

Our network includes:

🏢 National Distribution Centers
🏬 Regional Distribution Centers
📍 City Hubs
📦 FCS Service Points

We are expanding our logistics coverage across Pakistan.

More information:
www.fcsexpress.com.pk`

  );

  return;

}







if (text === "3") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ?

`🚚 ایف سی ایس ایکسپریس سروسز

• ایکسپریس پارسل ڈیلیوری
• کارپوریٹ لاجسٹکس
• ای کامرس ڈیلیوری
• کیش آن ڈیلیوری (COD)
• ویئر ہاؤسنگ
• لاسٹ مائل ڈیلیوری

مکمل معلومات:
www.fcsexpress.com.pk`

    :

`🚚 FCS Express Services

• Express Parcel Delivery
• Corporate Logistics
• E-commerce Delivery
• Cash on Delivery (COD)
• Warehousing
• Last-Mile Delivery

Complete information:
www.fcsexpress.com.pk`

  );

  return;

}




        // 4 - FRANCHISE APPLICATION

if (text === "4") {


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




          // 5 - SUPPLIER

          if (text === "5") {


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





          // 6 - TRANSPORT PARTNER REGISTRATION

if (text === "6") {


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




         // 7 - WAREHOUSE & TRUCK ADDA

if (text === "7") {


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




         // 8 - FAQ

if (text === "8") {


  sendWhatsAppMessage(

    customerNumber,


    lang === "ur"

    ?

`❓ اکثر پوچھے جانے والے سوالات

کیٹیگری منتخب کریں:

1️⃣ فرنچائز پارٹنر
2️⃣ ٹرانسپورٹ پارٹنر
3️⃣ ویئر ہاؤس اور ٹرک اڈہ
4️⃣ سپلائر / وینڈر`

    :

`❓ Frequently Asked Questions

Select Category:

1️⃣ Franchise Partner
2️⃣ Transport Partner
3️⃣ Warehouse & Truck Adda
4️⃣ Supplier / Vendor`

  );

faqMode.set(customerNumber, true);
  return;

}





         // 9 - WHY CHOOSE FCS

if (text === "9") {


  sendWhatsAppMessage(

    customerNumber,


    lang === "ur"

    ?

`⭐ ایف سی ایس ایکسپریس کیوں؟

ایف سی ایس ایکسپریس ایک جدید لاجسٹکس نیٹ ورک ہے جو قابل اعتماد ڈیلیوری، مضبوط پارٹنر نیٹ ورک، ٹیکنالوجی پر مبنی آپریشنز اور کاروباری ترقی کے مواقع فراہم کرتا ہے۔

ہماری ترجیحات:

✅ ملک گیر نیٹ ورک
✅ فرنچائز اور بزنس پارٹنرشپ کے مواقع
✅ جدید ٹریکنگ اور آپریشنل سسٹم
✅ کاروباری اداروں کے لیے قابل اعتماد لاجسٹکس حل
✅ صارفین اور پارٹنرز کے لیے بہتر سروس کا معیار`

    :

`⭐ Why Choose FCS Express?

FCS Express is a modern logistics network built to provide reliable delivery solutions, strong partner opportunities, technology-driven operations and long-term business growth.

Our strengths:

✅ Nationwide logistics network
✅ Franchise and business partnership opportunities
✅ Technology-based tracking and operations
✅ Reliable solutions for businesses and customers
✅ Focus on quality service and partner growth`

  );


  return;

}

          // 10 - CONTACT US

          if (text === "10") {


            sendWhatsAppMessage(

              customerNumber,


              lang === "ur"

              ? `FCS Express Offices

📍 کراچی
📍 لاہور
📍 اسلام آباد
📍 پشاور
📍 کوئٹہ
📍 مظفرآباد

رابطہ کریں

📧 info@fcsexpress.com.pk
📱 WhatsApp: 03160034207
🌐 www.fcsexpress.com.pk`

              :

              `FCS Express Offices

📍 Karachi
📍 Lahore
📍 Islamabad
📍 Peshawar
📍 Quetta
📍 Muzaffarabad

Contact Us

📧 info@fcsexpress.com.pk
📱 WhatsApp: 03160034207
🌐 www.fcsexpress.com.pk`

            );


            return;

          }
                    // ==============================
          // AI CHAT
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


      return;


  }




  // 404

  res.writeHead(404, {

    "Content-Type": "text/plain"

  });


  res.end(
    "Not Found"
  );


});






// ==============================
// SERVER START
// ==============================


server.listen(

  PORT,

  "0.0.0.0",

  () => {


    console.log("--------------------------------");

    console.log(
      "FCS Express WhatsApp Bot Started"
    );


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






// ==============================
// ERROR HANDLING
// ==============================


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






// ==============================
// DAILY ENGAGEMENT CHECK
// ==============================


const {
  checkEngagement
} = require("./engagementChecker");




setInterval(() => {


  checkEngagement(

    sendWhatsAppMessage

  )


  .catch((error) => {


    console.error(

      "Engagement Error:",

      error.message

    );


  });



}, 24 * 60 * 60 * 1000);
