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

const supplierFields = [
  "companyName",
  "contactPerson",
  "mobile",
  "city",
  "province",
  "cnic",
  "governmentLicence",
  "category",
  "pastProjects",
  "additionalDetails"
];

function startSupplier(number, lang = "en") {

  suppliers.set(number, {
    step: 0,
    data: {},
    lang
  });

  return supplierQuestions[lang][0];
}

function isSupplierRegistering(number) {
  return suppliers.has(number);
}

async function handleSupplier(number, answer) {

  const supplier = suppliers.get(number);

  if (!supplier) {
    return {
      completed: false,
      reply: "Supplier registration not found."
    };
  }

  const field =
    supplierFields[supplier.step];

  supplier.data[field] = answer;

  // Duplicate check after mobile number
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
            ? `⚠️ اس موبائل نمبر سے سپلائر رجسٹریشن پہلے ہی جمع ہو چکی ہے۔`
            : `⚠️ A Supplier Registration has already been submitted using this mobile number.`
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

    await appendSupplier([
      new Date().toLocaleString(),
      supplierNumber,
      data.companyName || "",
      data.contactPerson || "",
      data.mobile || "",
      data.city || "",
      data.province || "",
      data.cnic || "",
      data.governmentLicence || "",
      data.category || "",
      data.pastProjects || "",
      data.additionalDetails || "",
      "Received"
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
