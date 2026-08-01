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

function startApplication(number) {


 
  

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

async function handleApplication(number, answer) {

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
await appendApplication([
  new Date().toLocaleString(),
  completedData.fullName,
  completedData.fatherName,
  completedData.mobile,
  completedData.whatsapp,
  completedData.email,
  completedData.province,
  completedData.city,
  completedData.area,
  completedData.address,
  completedData.education,
  completedData.experience,
  completedData.shop,
  completedData.comments
]);
    // Remove active application
    applications.delete(number);

    // Mark this WhatsApp number as completed
    

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
