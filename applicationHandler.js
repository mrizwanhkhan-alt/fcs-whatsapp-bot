const {
  applications,
  completedApplications,
  questions
} = require("./application");
const { getLanguage } = require("./language");
const { appendApplication } = require("./googleSheets");

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

function startApplication(number) {

  // Prevent duplicate applications
  if (completedApplications.has(number)) {
    const lang = getLanguage(number) || "en";

return lang === "ur"
? `⚠️ فرنچائز درخواست پہلے ہی جمع ہو چکی ہے۔

اس واٹس ایپ نمبر سے پہلے ہی ایک فرنچائز درخواست جمع کرائی جا چکی ہے۔

اگر آپ اپنی معلومات اپ ڈیٹ کرنا چاہتے ہیں یا اپنی درخواست کے بارے میں کوئی سوال ہے تو براہِ کرم ہماری فرنچائز ٹیم سے رابطہ کریں۔

📱 WhatsApp: +92 316 0034207
📧 Email: info@fcsexpress.com.pk`
: `⚠️ Franchise Application Already Submitted

Our records show that a franchise application has already been submitted using this WhatsApp number.

If you need to update your information or have any questions about your application, please contact our Franchise Development Team.

📱 WhatsApp: +92 316 0034207
📧 Email: info@fcsexpress.com.pk`;
  }

  applications.set(number, {
    step: 0,
    data: {}
  });

  const lang = getLanguage(number) || "en";

return (
  lang === "ur"
    ? "📝 ایف سی ایس ایکسپریس فرنچائز درخواست\n\n" +
      "ایف سی ایس ایکسپریس کا انتخاب کرنے کا شکریہ۔\n\n" +
      questions[lang][0]
    : "📝 FCS Express Franchise Application\n\n" +
      "Thank you for choosing FCS Express.\n\n" +
      questions[lang][0]
);
}

function isApplying(number) {
  return applications.has(number);
}

function handleApplication(number, answer) {

  const app = applications.get(number);

  if (!app) {
    return {
      completed: false,
      reply: "Application not found."
    };
  }

  app.data[fields[app.step]] = answer;

  app.step++;

 const lang = getLanguage(number) || "en";

if (app.step >= questions[lang].length) {

    const completedData = app.data;

    // Remove active application
    applications.delete(number);

    // Mark this WhatsApp number as completed
    completedApplications.add(number);

    return {
      completed: true,
      data: completedData,
      reply:
lang === "ur"
? `🎉 شکریہ!

آپ کی فرنچائز درخواست کامیابی سے جمع ہو گئی ہے۔

ہماری فرنچائز ڈویلپمنٹ ٹیم جلد آپ سے رابطہ کرے گی۔

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔

👋 اللہ حافظ۔`
: `🎉 Thank you!

Your franchise application has been submitted successfully.

Our Franchise Development Team will review your application and contact you shortly.

Thank you for choosing FCS Express Pakistan.

👋 Goodbye.`
    };

  }

  applications.set(number, app);

  return {
    completed: false,
reply: questions[lang][app.step]
  };
}

module.exports = {
  startApplication,
  isApplying,
  handleApplication
};
