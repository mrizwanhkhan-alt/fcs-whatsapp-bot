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
  languageMenu,
  mainMenu
} = require("./language");

const {
  isBlocked,
  recordAbuse
} = require("./blockedUsers");


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
          // ==============================
          if (isApplying(customerNumber)) {

  const result = await handleApplication(
    customerNumber,
    customerText
  );

  sendWhatsAppMessage(
    customerNumber,
    result.reply
  );

  return;

}
// MAIN MENU OPTIONS
// ==============================


const lang =
  getLanguage(customerNumber);



if (text === "1") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ? "ایف سی ایس ایکسپریس پاکستان کا ایک قابل اعتماد لاجسٹکس نیٹ ورک بنا رہا ہے۔"

    : "FCS Express is building Pakistan's trusted logistics network."

  );

  return;

}



if (text === "2") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ? "ہمارا ملک گیر نیٹ ورک NDCs، RDCs، سٹی ہبز اور سروس پوائنٹس پر مشتمل ہے۔"

    : "Our nationwide network includes NDCs, RDCs, City Hubs and Service Points across Pakistan."

  );

  return;

}



if (text === "3") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ? "ہماری سروسز میں ایکسپریس ڈلیوری، کارپوریٹ لاجسٹکس، ای کامرس ڈلیوری اور COD شامل ہیں۔"

    : "Our services include Express Delivery, Corporate Logistics, E-commerce Delivery and COD."

  );

  return;

}



if (text === "4") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ? "ایف سی ایس ایکسپریس جدید ٹیکنالوجی کے ساتھ قابل اعتماد لاجسٹکس حل فراہم کرتا ہے۔"

    : "FCS Express provides reliable technology-driven logistics solutions."

  );

  return;

}



if (text === "5") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ? "ایف سی ایس ایکسپریس فرنچائز نیٹ ورک کا حصہ بنیں اور ہمارے ساتھ ترقی کریں۔"

    : "Join FCS Express Franchise Network and become part of Pakistan's growing logistics future."

  );

  return;

}



if (text === "6") {


  const reply =
    startApplication(customerNumber);



  sendWhatsAppMessage(
    customerNumber,
    reply
  );


  return;

}



if (text === "7") {

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

    ? "اکثر پوچھے جانے والے سوالات کے لیے ہماری فرنچائز ٹیم آپ کی رہنمائی کرے گی۔"

    : "Frequently Asked Questions will be available here. Our franchise team will guide you."

  );

  return;

}



if (text === "8") {

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
📱 WhatsApp: 031600344207
🌐 www.fcsexpress.com.pk`

    : `FCS Express Offices

📍 Karachi
📍 Lahore
📍 Islamabad
📍 Peshawar
📍 Quetta
📍 Muzaffarabad

Contact Us

📧 info@fcsexpress.com.pk
📱 WhatsApp: 031600344207
🌐 www.fcsexpress.com.pk`

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
