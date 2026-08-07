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

  app.data[fields[app.step]] = answer;
  app.step++;

  if (app.step >= questions[lang].length) {
    const data = app.data;

    const applicationNumber =
      await generateApplicationNumber();

    const now = new Date();

    const nextFollowUp = new Date(now);
    nextFollowUp.setDate(
      nextFollowUp.getDate() + 3
    );

    await appendApplication([
      now.toLocaleString(),             // A Date
      applicationNumber,                // B Application No
      data.fullName || "",              // C Full Name
      data.fatherName || "",            // D Father Name
      data.mobile || "",                // E Mobile
      String(number),                   // F WhatsApp
      data.cnic || "",                  // G CNIC
      data.email || "",                 // H Email
      data.province || "",              // I Province
      data.city || "",                  // J City
      data.area || "",                  // K Area / Tehsil
      data.address || "",               // L Office / Shop Address
      data.education || "",             // M Education
      data.experience || "",            // N Business Experience
      data.shop || "",                  // O Shop / Office Available
      data.comments || "",              // P Comments
      "Received",                       // Q Status
      "Application Submitted",          // R Engagement Stage
      now.toLocaleString(),             // S Last Message Sent
      nextFollowUp.toLocaleDateString() // T Next Follow Up Date
    ]);

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

ہماری فرنچائز ڈویلپمنٹ ٹیم آپ کی درخواست کا جائزہ لے گی اور جلد آپ سے رابطہ کرے گی۔

👋 اللہ حافظ۔`
          : `🎉 Thank you!

Your FCS Express Franchise Application has been submitted successfully.

Application No: ${applicationNumber}

Our Franchise Development Team will review your application and contact you shortly.

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
