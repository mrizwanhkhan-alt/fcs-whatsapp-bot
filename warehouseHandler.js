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

function startWarehouse(number, lang = "en") {
  warehouses.set(number, {
    step: 0,
    data: {},
    lang
  });

  return warehouseQuestions[lang][0];
}

function isWarehouseRegistering(number) {
  return warehouses.has(number);
}

async function handleWarehouse(number, answer) {
  const warehouse = warehouses.get(number);

  if (!warehouse) {
    return {
      completed: false,
      reply: "Warehouse registration not found."
    };
  }

  const field =
    warehouseFields[warehouse.step];

  warehouse.data[field] = answer;

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

    await appendWarehouse([
      new Date().toLocaleString(),
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
      "Received"
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
