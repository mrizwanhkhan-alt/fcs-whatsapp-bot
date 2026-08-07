const {
  suppliers,
  supplierQuestions
} = require("./supplier");

const {
  appendSupplier,
  generateApplicationNumber,
  supplierExists
} = require("./googleSheets");

const {
  registerUser
} = require("./registeredUsers");

const SESSION_TIMEOUT = 10 * 60 * 1000;

const supplierFields = [
  "companyName",
  "contactPerson",
  "mobile",
  "province",
  "city",
  "cnic",
  "governmentLicence",
  "category",
  "pastProjects",
  "additionalDetails"
];

const provinceMap = {
  "1": "Punjab",
  "2": "Sindh",
  "3": "Khyber Pakhtunkhwa (KPK)",
  "4": "Balochistan",
  "5": "Azad Jammu & Kashmir (AJK)",
  "6": "Gilgit-Baltistan",
  "7": "Islamabad Capital Territory"
};

const categoryMap = {
  "1": "Printing Material",
  "2": "Packaging Material",
  "3": "Courier Supplies",
  "4": "Uniforms / Clothing",
  "5": "Stationery",
  "6": "IT Equipment",
  "7": "Furniture",
  "8": "Vehicle / Transport Supplies",
  "9": "Other"
};

function convertAnswer(field, answer) {

  const value =
    String(answer || "").trim();

  if (field === "province") {
    return provinceMap[value] || value;
  }

  if (field === "category") {
    return categoryMap[value] || value;
  }

  return value;
}

function startSupplier(number, lang = "en") {

  suppliers.set(number, {
    step: 0,
    data: {},
    lang,
    lastActivity: Date.now()
  });

  return supplierQuestions[lang][0];
}

function isSupplierRegistering(number) {

  const supplier =
    suppliers.get(number);

  if (!supplier) {
    return false;
  }

  if (
    Date.now() - supplier.lastActivity >
    SESSION_TIMEOUT
  ) {
    suppliers.delete(number);
    return false;
  }

  return true;
}

async function handleSupplier(number, answer) {

  const supplier =
    suppliers.get(number);

  if (!supplier) {
    return {
      completed: false,
      reply: "Supplier registration not found."
    };
  }

  if (
    Date.now() - supplier.lastActivity >
    SESSION_TIMEOUT
  ) {

    suppliers.delete(number);

    return {
      completed: true,
      expired: true,
      reply:
        supplier.lang === "ur"
          ? "⏰ آپ کی سپلائر رجسٹریشن 10 منٹ کی غیر فعالیت کی وجہ سے ختم ہو گئی ہے۔ براہِ کرم دوبارہ شروع کریں۔"
          : "⏰ Your Supplier Registration expired after 10 minutes of inactivity. Please start again."
    };
  }

  supplier.lastActivity = Date.now();

  const field =
    supplierFields[supplier.step];

  supplier.data[field] =
    convertAnswer(field, answer);

  if (field === "mobile") {

    const alreadyExists =
      await supplierExists(answer);

    if (alreadyExists) {

      suppliers.delete(number);

      return {
        completed: true,
        duplicate: true,
        reply:
          supplier.lang === "ur"
            ? "⚠️ اس موبائل نمبر سے سپلائر رجسٹریشن پہلے ہی جمع ہو چکی ہے۔"
            : "⚠️ A Supplier Registration has already been submitted using this mobile number."
      };
    }
  }

  supplier.step++;

  if (
    supplier.step >=
    supplierQuestions[supplier.lang].length
  ) {

    const data = supplier.data;

    const supplierNumber =
      await generateApplicationNumber();

    const now = new Date();

    const nextFollowUp = new Date(now);
    nextFollowUp.setDate(
      nextFollowUp.getDate() + 7
    );

    await appendSupplier([
      now.toLocaleString(),
      supplierNumber,
      data.companyName || "",
      data.contactPerson || "",
      data.mobile || "",
      data.province || "",
      data.city || "",
      data.cnic || "",
      data.governmentLicence || "",
      data.category || "",
      data.pastProjects || "",
      data.additionalDetails || "",
      "Received",
      "Registration Submitted",
      now.toLocaleString(),
      nextFollowUp.toLocaleDateString(),
      ""
    ]);

    registerUser(
      number,
      data.mobile,
      "Supplier",
      supplierNumber
    );

    suppliers.delete(number);

    return {
      completed: true,
      data,
      referenceId: supplierNumber,
      reply:
        supplier.lang === "ur"
          ? `✅ شکریہ!

آپ کی سپلائر / وینڈر رجسٹریشن موصول ہو گئی ہے۔

سپلائر آئی ڈی:
${supplierNumber}

کمپنی:
${data.companyName}

ہماری ٹیم آپ کی معلومات کا جائزہ لے گی اور آپ سے رابطہ کرے گی۔`
          : `✅ Thank you!

Your Supplier / Vendor Registration has been received.

Supplier ID:
${supplierNumber}

Company:
${data.companyName}

Our team will review your details and contact you.`
    };
  }

  suppliers.set(number, supplier);

  return {
    completed: false,
    reply:
      supplierQuestions[
        supplier.lang
      ][supplier.step]
  };
}

module.exports = {
  startSupplier,
  isSupplierRegistering,
  handleSupplier
};
