const {
  warehouses,
  warehouseQuestions
} = require("./warehouse");

const {
  appendWarehouse,
  generateApplicationNumber,
  warehouseExists
} = require("./googleSheets");

const {
  registerUser
} = require("./registeredUsers");

const SESSION_TIMEOUT = 10 * 60 * 1000;

const warehouseFields = [
  "companyName",
  "contactPerson",
  "mobile",
  "city",
  "province",
  "cnic",
  "governmentRegistration",
  "facilityType",
  "facilityCategory",
  "capacity",
  "truckCapacity",
  "loadingFacility",
  "address",
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

const facilityTypeMap = {
  "1": "Warehouse",
  "2": "Truck Adda",
  "3": "Both Warehouse & Truck Adda"
};

const facilityCategoryMap = {
  "1": "General Storage Warehouse",
  "2": "E-commerce Fulfillment Warehouse",
  "3": "Cold Storage",
  "4": "Industrial / Commercial Warehouse",
  "5": "Open Yard / Truck Parking",
  "6": "Other"
};

function convertAnswer(field, answer) {
  const value = String(answer || "").trim();

  if (field === "province") {
    return provinceMap[value] || value;
  }

  if (field === "facilityType") {
    return facilityTypeMap[value] || value;
  }

  if (field === "facilityCategory") {
    return facilityCategoryMap[value] || value;
  }

  if (field === "loadingFacility") {
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

function startWarehouse(number, lang = "en") {
  warehouses.set(number, {
    step: 0,
    data: {},
    lang,
    lastActivity: Date.now()
  });

  return warehouseQuestions[lang][0];
}

function isWarehouseRegistering(number) {
  const warehouse = warehouses.get(number);

  if (!warehouse) {
    return false;
  }

  if (
    Date.now() - warehouse.lastActivity >
    SESSION_TIMEOUT
  ) {
    warehouses.delete(number);
    return false;
  }

  return true;
}

async function handleWarehouse(number, answer) {
  const warehouse = warehouses.get(number);

  if (!warehouse) {
    return {
      completed: false,
      reply: "Warehouse registration not found."
    };
  }

  if (
    Date.now() - warehouse.lastActivity >
    SESSION_TIMEOUT
  ) {
    warehouses.delete(number);

    return {
      completed: true,
      expired: true,
      reply:
        warehouse.lang === "ur"
          ? "⏰ آپ کی ویئر ہاؤس / ٹرک اڈہ رجسٹریشن 10 منٹ کی غیر فعالیت کی وجہ سے ختم ہو گئی ہے۔ براہِ کرم دوبارہ شروع کریں۔"
          : "⏰ Your Warehouse / Truck Adda Registration expired after 10 minutes of inactivity. Please start again."
    };
  }

  warehouse.lastActivity = Date.now();

  const field =
    warehouseFields[warehouse.step];

  warehouse.data[field] =
    convertAnswer(field, answer);

  if (field === "mobile") {
    const alreadyExists =
      await warehouseExists(answer);

    if (alreadyExists) {
      warehouses.delete(number);

      return {
        completed: true,
        duplicate: true,
        reply:
          warehouse.lang === "ur"
            ? "⚠️ اس موبائل نمبر سے ویئر ہاؤس / ٹرک اڈہ رجسٹریشن پہلے ہی جمع ہو چکی ہے۔"
            : "⚠️ A Warehouse / Truck Adda Registration has already been submitted using this mobile number."
      };
    }
  }

  warehouse.step++;

  if (
    warehouse.step >=
    warehouseQuestions[warehouse.lang].length
  ) {
    const data = warehouse.data;

    const partnerId =
      await generateApplicationNumber();

    const now = new Date();

    const nextFollowUp = new Date(now);
    nextFollowUp.setDate(
      nextFollowUp.getDate() + 7
    );

    await appendWarehouse([
      now.toLocaleString(),
      partnerId,
      data.companyName || "",
      data.contactPerson || "",
      data.mobile || "",
      data.city || "",
      data.province || "",
      data.cnic || "",
      data.governmentRegistration || "",
      data.facilityType || "",
      data.facilityCategory || "",
      data.capacity || "",
      data.truckCapacity || "",
      data.loadingFacility || "",
      data.address || "",
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
      "Warehouse",
      partnerId
    );

    warehouses.delete(number);

    return {
      completed: true,
      data,
      referenceId: partnerId,
      reply:
        warehouse.lang === "ur"
          ? `✅ شکریہ!

آپ کی ویئر ہاؤس / ٹرک اڈہ رجسٹریشن موصول ہو گئی ہے۔

پارٹنر آئی ڈی:
${partnerId}

ہماری ٹیم آپ کی معلومات کا جائزہ لے گی اور آپ سے رابطہ کرے گی۔`
          : `✅ Thank you!

Your Warehouse & Truck Adda Registration has been received.

Partner ID:
${partnerId}

Our team will review your details and contact you.`
    };
  }

  warehouses.set(number, warehouse);

  return {
    completed: false,
    reply:
      warehouseQuestions[
        warehouse.lang
      ][warehouse.step]
  };
}

module.exports = {
  startWarehouse,
  isWarehouseRegistering,
  handleWarehouse
};
