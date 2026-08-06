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

const faqMode = new Map();


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
id="part2"
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



            user.postMessages++;

if (user.postMessages <= 2) {
  return;
}

user.warnings++;

if (user.warnings === 1) {

  sendWhatsAppMessage(
    customerNumber,
    "Warning 1/3\n\nApplication received. Avoid unnecessary messages. Otherwise, your application may be rejected, and you may be permanently blocked."
  );

  return;

}

if (user.warnings === 2) {

  sendWhatsAppMessage(
    customerNumber,
    "Warning 2/3\n\nApplication received. Avoid unnecessary messages. Otherwise, your application may be rejected, and you may be permanently blocked."
  );

  return;

}

if (user.warnings === 3) {

  sendWhatsAppMessage(
    customerNumber,
    "Warning 3/3\n\nApplication received. Avoid unnecessary messages. Otherwise, your application may be rejected, and you may be permanently blocked."
  );

  return;

}

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



          // CONTINUE FAQ


          if (
            faqMode.has(customerNumber)
          ) {if (text === "0") {

  faqMode.delete(customerNumber);

  sendWhatsAppMessage(
    customerNumber,
    mainMenu(lang)
  );

  return;

}


            let category;



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



              faqList.forEach((item, index) => {


                reply +=
                `${index + 1}. ${item.question}\n\n${item.answer}\n\n`;


              });
reply +=
"\n↩️ Reply 8 to view FAQ categories again.\n🏠 Reply 0 for Main Menu.";


              sendWhatsAppMessage(
                customerNumber,
                reply
              );




              return;

            }

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





          // MAIN MENU OPTIONS


if (text === "1") {

  const lang = getLanguage(customerNumber);

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

      ? `🏢 ایف سی ایس ایکسپریس پاکستان

ایف سی ایس ایکسپریس پاکستان ایک جدید لاجسٹکس اور کورئیر کمپنی ہے جو ملک بھر میں محفوظ، قابلِ اعتماد اور جدید ٹیکنالوجی پر مبنی ترسیلی خدمات فراہم کرنے کے لیے پرعزم ہے۔

ہمارا مقصد تیز رفتار، معیاری اور قابلِ اعتماد لاجسٹکس نیٹ ورک کے ذریعے کاروباروں اور افراد کو بہترین خدمات فراہم کرنا ہے۔

ہم ایکسپریس پارسل ڈیلیوری، ای کامرس لاجسٹکس، کارپوریٹ شپنگ، ویئرہاؤسنگ، فل فلمنٹ اور لاسٹ مائل ڈیلیوری سمیت مکمل لاجسٹکس سلوشنز فراہم کرتے ہیں۔

جدید ٹیکنالوجی، بہترین آپریشنز اور اعلیٰ کسٹمر سروس کے ذریعے ایف سی ایس ایکسپریس پاکستان کے تیزی سے ترقی کرتے ہوئے لاجسٹکس نیٹ ورک کی تعمیر کر رہا ہے۔

🌐 ویب سائٹ:
www.fcsexpress.com.pk

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔
ہم آپ کی خدمت کے منتظر ہیں۔`

      : `🏢 About FCS Express Pakistan

FCS Express Pakistan is a modern logistics and courier company committed to delivering reliable, secure, and technology-driven shipping solutions across the country.

Our mission is to connect businesses and individuals through a nationwide logistics network built on speed, trust, innovation, and exceptional customer service.

We provide comprehensive logistics solutions, including express parcel delivery, e-commerce logistics, corporate shipping, warehousing, fulfilment, and last-mile delivery.

With a strong focus on technology, operational excellence, and customer satisfaction, FCS Express is building one of Pakistan's fastest-growing logistics networks.

🌐 Website:
www.fcsexpress.com.pk

Thank you for choosing FCS Express Pakistan.
We look forward to serving you.`
  );

  return;
}



         if (text === "2") {

  const lang = getLanguage(customerNumber);

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

      ? `🌍 ہمارا ملک گیر نیٹ ورک

ایف سی ایس ایکسپریس پاکستان بھر میں ایک جدید، مضبوط اور تیزی سے ترقی کرتا ہوا لاجسٹکس اور کورئیر نیٹ ورک قائم کر رہا ہے، جس کا مقصد ملک کے ہر شہر اور علاقے تک محفوظ، بروقت اور قابلِ اعتماد ترسیلی خدمات فراہم کرنا ہے۔

ہمارا بڑھتا ہوا نیٹ ورک شامل ہے:

🏢 7 نیشنل ڈسٹری بیوشن سینٹرز (NDCs)
🏢 14 ریجنل ڈسٹری بیوشن سینٹرز (RDCs)
🏙️ 170 سٹی ہبز
📦 2,530 سے زائد سروس پوائنٹ فرنچائزز

بڑے شہروں سے لے کر تحصیل اور دور دراز علاقوں تک ہمارا نیٹ ورک وسیع تر کوریج، تیز تر ترسیل اور معیاری لاجسٹکس خدمات فراہم کرنے کے لیے مسلسل وسعت اختیار کر رہا ہے۔

آئیے، مل کر پاکستان کے مستقبل کا جدید لاجسٹکس نیٹ ورک تعمیر کریں۔

🌐 ویب سائٹ:
www.fcsexpress.com.pk

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔
ہم آپ کی خدمت کے منتظر ہیں۔`

      : `🌍 Our Nationwide Network

FCS Express is developing one of Pakistan's most comprehensive logistics and courier networks, designed to provide fast, reliable, and seamless delivery services across the country.

Our growing network includes:

🏢 7 National Distribution Centers (NDCs)
🏢 14 Regional Distribution Centers (RDCs)
🏙️ 170 City Hubs
📦 2,530+ Service Point Franchises

From major metropolitan cities to tehsils and remote areas, our expanding infrastructure ensures wider coverage, faster transit times, and dependable logistics solutions for businesses and individuals alike.

Together, we are building the future of logistics in Pakistan.

🌐 Website:
www.fcsexpress.com.pk

Thank you for choosing FCS Express Pakistan.
We look forward to serving you.`
  );

  return;
}




         if (text === "3") {

  const lang = getLanguage(customerNumber);

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

      ? `🚚 ہماری سروسز

ایف سی ایس ایکسپریس پاکستان افراد، کاروباری اداروں اور کارپوریٹ صارفین کی ضروریات کو مدِنظر رکھتے ہوئے جدید، محفوظ اور قابلِ اعتماد لاجسٹکس اور کورئیر خدمات فراہم کرتا ہے۔

ہماری خدمات میں شامل ہیں:

📦 ایکسپریس پارسل ڈیلیوری
🚀 سیم ڈے اور نیکسٹ ڈے ڈیلیوری
🏢 کارپوریٹ لاجسٹکس سلوشنز
🛒 ای کامرس ڈیلیوری
💰 کیش آن ڈیلیوری (COD)
🏬 ویئرہاؤسنگ اور فل فلمنٹ
🚛 لاسٹ مائل ڈیلیوری
🌍 ملک گیر ڈسٹری بیوشن
📄 دستاویزات اور پارسل کی ترسیل
🤝 بزنس اور سپلائی چین سلوشنز

جدید ٹیکنالوجی، مضبوط آپریشنز اور اعلیٰ معیار کی کسٹمر سروس کے ذریعے ایف سی ایس ایکسپریس ہر ترسیل کو محفوظ، بروقت اور مؤثر بنانے کے لیے پرعزم ہے۔

🌐 ویب سائٹ:
www.fcsexpress.com.pk

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔
ہم آپ کی خدمت کے منتظر ہیں۔`

      : `🚚 Our Services

FCS Express Pakistan offers a comprehensive range of logistics and courier solutions designed to meet the needs of individuals, businesses, and corporate clients across the country.

Our services include:

📦 Express Parcel Delivery
🚀 Same-Day & Next-Day Delivery
🏢 Corporate Logistics Solutions
🛒 E-commerce Delivery
💰 Cash on Delivery (COD)
🏬 Warehousing & Fulfilment
🚛 Last-Mile Delivery
🌍 Nationwide Distribution
📄 Document & Parcel Delivery
🤝 Business & Supply Chain Solutions

Driven by innovation, advanced technology, and a commitment to excellence, FCS Express delivers reliable, secure, and efficient logistics solutions that help businesses grow and customers stay connected.

🌐 Website:
www.fcsexpress.com.pk

Thank you for choosing FCS Express Pakistan.
We look forward to serving you.`
  );

  return;
}




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


            faqMode.set(
              customerNumber,
              true
            );


            return;

          }





          // 9 - WHY CHOOSE FCS


         if (text === "9") {

  const lang = getLanguage(customerNumber);

  sendWhatsAppMessage(
    customerNumber,

    lang === "ur"

? `⭐ ایف سی ایس ایکسپریس کیوں منتخب کریں؟

ایف سی ایس ایکسپریس پاکستان جدید ٹیکنالوجی، مضبوط لاجسٹکس نیٹ ورک اور بہترین کسٹمر سروس کے ذریعے محفوظ، قابلِ اعتماد اور بروقت ترسیلی خدمات فراہم کرنے کے لیے پرعزم ہے۔

ہمیں منتخب کرنے کی وجوہات:

✅ ملک گیر لاجسٹکس نیٹ ورک
✅ تیز رفتار اور قابلِ اعتماد ترسیل
✅ ہر شپمنٹ کی محفوظ ہینڈلنگ
✅ ریئل ٹائم شپمنٹ ٹریکنگ
✅ پیشہ ور کسٹمر سپورٹ
✅ کاروباری، کارپوریٹ اور ای کامرس سلوشنز
✅ مضبوط فرنچائز اور ڈسٹری بیوشن نیٹ ورک
✅ جدید ٹیکنالوجی پر مبنی آپریشنز
✅ اعلیٰ معیار کی خدمات کا عزم

چاہے آپ ایک پارسل بھیج رہے ہوں یا اپنے کاروبار کے لیے مکمل لاجسٹکس سروس چاہتے ہوں، ایف سی ایس ایکسپریس مؤثر، محفوظ اور پیشہ ورانہ خدمات فراہم کرنے کے لیے تیار ہے۔

🌐 ویب سائٹ:
www.fcsexpress.com.pk

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔
ہم آپ کی خدمت کے منتظر ہیں۔`

: `⭐ Why Choose FCS Express?

FCS Express Pakistan delivers reliable, secure, and technology-driven logistics solutions for individuals and businesses across the country.

Why choose us?

✅ Nationwide Logistics Network
✅ Fast & Reliable Deliveries
✅ Safe & Secure Shipment Handling
✅ Real-Time Shipment Tracking
✅ Professional Customer Support
✅ Business, Corporate & E-commerce Solutions
✅ Strong Franchise & Distribution Network
✅ Modern Technology-Driven Operations
✅ Commitment to Service Excellence

Whether you are sending a single parcel or managing large-scale business logistics, FCS Express provides dependable, efficient and professional logistics solutions designed around your needs.

🌐 Website:
www.fcsexpress.com.pk

Thank you for choosing FCS Express Pakistan.
We look forward to serving you.`
  );

  return;
}



          // 10 - CONTACT US


          if (text === "10") {


            sendWhatsAppMessage(

              customerNumber,


`FCS Express Offices

📍 Karachi
📍 Lahore
📍 Islamabad
📍 Peshawar
📍 Quetta
📍 Muzaffarabad

📧 info@fcsexpress.com.pk
📱 WhatsApp: 03160034207
🌐 www.fcsexpress.com.pk`

            );


            return;

          }






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



  res.writeHead(404, {

    "Content-Type": "text/plain"

  });


  res.end(
    "Not Found"
  );


});





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
