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

const SESSION_TIMEOUT = 10 * 60 * 1000;

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

const provinceMap = {
  "1": "Punjab",
  "2": "Sindh",
  "3": "KPK",
  "4": "Balochistan",
  "5": "AJK",
  "6": "Gilgit Baltistan",
  "7": "Islamabad"
};

const educationMap = {
  "1": "Primary",
  "2": "Middle",
  "3": "Matric",
  "4": "Intermediate",
  "5": "Graduate",
  "6": "Masters"
};

const experienceMap = {
  "1": "No Experience",
  "2": "Less than 1 Year",
  "3": "1-3 Years",
  "4": "3-5 Years",
  "5": "More than 5 Years"
};

function convertAnswer(field, answer) {
  const value = String(answer || "").trim();

  if (field === "province") {
    return provinceMap[value] || value;
  }

  if (field === "education") {
    return educationMap[value] || value;
  }

  if (field === "experience") {
    return experienceMap[value] || value;
  }

  if (field === "shop") {
    const lower = value.toLowerCase();

    if (
      lower === "yes" ||
      value === "ہاں" ||
      value === "1"
    ) {
      return "Yes";
    }

    if (
      lower === "no" ||
      value === "نہیں" ||
      value === "2"
    ) {
      return "No";
    }
  }

  return value;
}

function startApplication(number) {
  const lang = getLanguage(number) || "en";

  applications.set(number, {
    step: 0,
    data: {},
    duplicateChecked: false,
    lastActivity: Date.now()
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
  const app = applications.get(number);

  if (!app) {
    return false;
  }

  if (
    Date.now() - app.lastActivity >
    SESSION_TIMEOUT
  ) {
    applications.delete(number);
    return false;
  }

  return true;
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

  if (
    Date.now() - app.lastActivity >
    SESSION_TIMEOUT
  ) {
    applications.delete(number);

    return {
      completed: true,
      expired: true,
      reply:
        lang === "ur"
          ? "⏰ آپ کی درخواست 10 منٹ کی غیر فعالیت کی وجہ سے ختم ہو گئی ہے۔ براہِ کرم دوبارہ شروع کریں۔"
          : "⏰ Your application expired after 10 minutes of inactivity. Please start again."
    };
  }

  app.lastActivity = Date.now();

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

  const currentField =
    fields[app.step];

  app.data[currentField] =
    convertAnswer(
      currentField,
      answer
    );

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


