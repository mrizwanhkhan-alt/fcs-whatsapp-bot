const {
  applications,
  questions
} = require("./application");

const { getLanguage } = require("./language");

const {
  appendApplication,
  numberExists
} = require("./googleSheets");


const fields = [
  "fullName",
  "fatherName",
  "mobile",
  "whatsapp",
  "email",
  "province",
  "city",
  "area",
  "address",
  "education",
  "experience",
  "shop",
  "comments"
];


// ==============================
// START APPLICATION
// ==============================

function startApplication(number) {

  const lang = getLanguage(number) || "en";

  applications.set(number, {
    step: 0,
    data: {},
    duplicateChecked: false
  });

  return lang === "ur"

    ? `📝 ایف سی ایس ایکسپریس فرنچائز درخواست

ایف سی ایس ایکسپریس کا انتخاب کرنے کا شکریہ۔

${questions[lang][0]}`

    : `📝 FCS Express Franchise Application

Thank you for choosing FCS Express.

${questions[lang][0]}`;
}


// ==============================
// CHECK ACTIVE APPLICATION
// ==============================

function isApplying(number) {

  return applications.has(number);

}


// ==============================
// HANDLE APPLICATION
// ==============================

async function handleApplication(number, answer) {

  const app = applications.get(number);

  const lang = getLanguage(number) || "en";


  if (!app) {

    return {
      completed: false,
      reply:
        lang === "ur"
          ? "درخواست نہیں ملی۔"
          : "Application not found."
    };

  }


  // ==============================
  // CHECK GOOGLE SHEET FOR DUPLICATE
  // ==============================

  if (!app.duplicateChecked) {

    const alreadyApplied =
      await numberExists(String(number));

    app.duplicateChecked = true;


    if (alreadyApplied) {

      applications.delete(number);

      return {
        completed: true,
        duplicate: true,

        reply:
          lang === "ur"

            ? `⚠️ ہمارے ریکارڈ کے مطابق اس واٹس ایپ نمبر سے پہلے ہی فرنچائز درخواست جمع کرائی جا چکی ہے۔

اگر آپ کو اپنی درخواست کے بارے میں مدد درکار ہو تو ہماری فرنچائز ڈویلپمنٹ ٹیم سے رابطہ کریں۔

📱 WhatsApp: +92 316 0034207
📧 Email: franchise@fcsexpress.com.pk`

            : `⚠️ Our records show that a franchise application has already been submitted using this WhatsApp number.

If you need assistance with your application, please contact our Franchise Development Team.

📱 WhatsApp: +92 316 0034207
📧 Email: franchise@fcsexpress.com.pk`
      };

    }

  }


  // ==============================
  // SAVE ANSWER
  // ==============================

  app.data[fields[app.step]] = answer;

  app.step++;


  // ==============================
  // APPLICATION COMPLETED
  // ==============================

  if (app.step >= questions[lang].length) {

    const data = app.data;


    await appendApplication([

      new Date().toLocaleString(),

      data.fullName || "",

      data.fatherName || "",

      data.mobile || "",

      String(number),

      data.email || "",

      data.province || "",

      data.city || "",

      data.area || "",

      data.address || "",

      data.education || "",

      data.experience || "",

      data.shop || "",

      data.comments || ""

    ]);


    applications.delete(number);


    return {

      completed: true,

      data,

      reply:
        lang === "ur"

          ? `🎉 شکریہ!

آپ کی فرنچائز درخواست کامیابی سے جمع ہو گئی ہے۔

ہماری فرنچائز ڈویلپمنٹ ٹیم آپ کی درخواست کا جائزہ لے گی اور جلد آپ سے رابطہ کرے گی۔

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔

👋 اللہ حافظ۔`

          : `🎉 Thank you!

Your FCS Express Franchise Application has been submitted successfully.

Our Franchise Development Team will review your application and contact you shortly.

Thank you for choosing FCS Express Pakistan.

👋 Goodbye.`

    };

  }


  // ==============================
  // NEXT QUESTION
  // ==============================

  applications.set(number, app);


  return {

    completed: false,

    reply: questions[lang][app.step]

  };

}


// ==============================
// EXPORTS
// ==============================

module.exports = {
  startApplication,
  isApplying,
  handleApplication
};
