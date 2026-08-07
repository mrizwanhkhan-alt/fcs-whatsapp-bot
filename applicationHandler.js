const {
  applications,
  questions
} = require("./application");

const { getLanguage } = require("./language");

const {
  appendApplication,
  numberExists,
  generateApplicationNumber
} = require("./googleSheets");

const {
  registerUser
} = require("./registeredUsers");

const fields = [
  "fullName",
  "fatherName",
  "mobile",
  "cnic",
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

function isApplying(number) {
  return applications.has(number);
}

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
            ? `⚠️ اس واٹس ایپ نمبر سے فرنچائز درخواست پہلے ہی جمع ہو چکی ہے۔

📱 WhatsApp: +92 316 0034207
📧 Email: franchise@fcsexpress.com.pk`
            : `⚠️ A Franchise Application has already been submitted using this WhatsApp number.

📱 WhatsApp: +92 316 0034207
📧 Email: franchise@fcsexpress.com.pk`
      };
    }
  }

  app.data[fields[app.step]] = answer;
  app.step++;

  if (app.step >= questions[lang].length) {

    const data = app.data;

    const applicationNumber =
      await generateApplicationNumber();

    const now = new Date();

    const nextFollowUp = new Date(now);
    nextFollowUp.setDate(
      nextFollowUp.getDate() + 15
    );

    await appendApplication([
      now.toLocaleString(),
      applicationNumber,
      data.fullName || "",
      data.fatherName || "",
      data.mobile || "",
      String(number),
      data.cnic || "",
      data.email || "",
      data.province || "",
      data.city || "",
      data.area || "",
      data.address || "",
      data.education || "",
      data.experience || "",
      data.shop || "",
      data.comments || "",
      "Received",
      "Application Submitted",
      now.toLocaleString(),
      nextFollowUp.toLocaleDateString()
    ]);

    registerUser(
      number,
      data.mobile,
      "Franchise",
      applicationNumber
    );

    applications.delete(number);

    return {
      completed: true,
      data,
      applicationNumber,
      reply:
        lang === "ur"
          ? `🎉 شکریہ!

آپ کی فرنچائز درخواست کامیابی سے جمع ہو گئی ہے۔

درخواست نمبر: ${applicationNumber}

ہماری ٹیم آپ کی درخواست کا جائزہ لے گی اور آپ سے رابطہ کرے گی۔

👋 اللہ حافظ۔`
          : `🎉 Thank you!

Your FCS Express Franchise Application has been submitted successfully.

Application No: ${applicationNumber}

Our team will review your application and contact you.

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
