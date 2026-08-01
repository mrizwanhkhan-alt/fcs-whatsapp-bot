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


  if (!PHONE_NUMBER_ID) {

    console.error(
      "PHONE_NUMBER_ID is missing."
    );

    return;

  }


  if (!WHATSAPP_TOKEN) {

    console.error(
      "WHATSAPP_TOKEN is missing."
    );

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
const server = http.createServer((req, res) => {


  const host = req.headers.host || "localhost";


  const url = new URL(
    req.url,
    `http://${host}`
  );



  if (req.method === "GET" && url.pathname === "/") {


    res.writeHead(200, {
      "Content-Type": "text/plain"
    });


    return res.end(
      "FCS Express WhatsApp Bot Running"
    );


  }




  if (req.method === "GET" && url.pathname === "/webhook") {


    const mode =
      url.searchParams.get("hub.mode");


    const token =
      url.searchParams.get("hub.verify_token");


    const challenge =
      url.searchParams.get("hub.challenge");



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


      res.end(
        "EVENT_RECEIVED"
      );



      try {


        const webhookData =
          JSON.parse(body);



        const value =
          webhookData.entry?.[0]
          ?.changes?.[0]
          ?.value;



        const message =
          value?.messages?.[0];



        if (!message) {

          console.log(
            "No customer message found."
          );

          return;

        }



        const customerNumber =
          message.from;



        // ==============================
        // BLOCKED USER CHECK
        // ==============================

        if (isBlocked(customerNumber)) {

          console.log(
            "Blocked user ignored:",
            customerNumber
          );

          return;

        }




        const customerText =
          message.text?.body ||
          `[${message.type || "unknown"} message]`;



        const text =
          customerText.trim();



        console.log(
          "Customer:",
          customerNumber
        );


        console.log(
          "Message:",
          customerText
        );





        // ==============================
        // LANGUAGE SELECTION
        // ==============================


        if (!hasLanguage(customerNumber)) {



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
// MAIN MENU OPTIONS
// ==============================

if (hasLanguage(customerNumber)) {


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



}




// ==============================
// START APPLICATION
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
