const {
  transports,
  transportQuestions
} = require("./transport");

const {
  appendTransport,
  generateApplicationNumber,
  transportExists
} = require("./googleSheets");

const {
  registerUser
} = require("./registeredUsers");

const SESSION_TIMEOUT = 10 * 60 * 1000;

const transportFields = [
  "companyName",
  "contactPerson",
  "mobile",
  "city",
  "province",
  "cnic",
  "governmentRegistration",
  "partnerType",
  "vehicleTypes",
  "vehicleCount",
  "routes",
  "pastProjects",
  "additionalDetails"
];

function startTransport(number, lang = "en") {
  transports.set(number, {
    step: 0,
    data: {},
    lang,
    lastActivity: Date.now()
  });

  return transportQuestions[lang][0];
}

function isTransportRegistering(number) {
  const transport = transports.get(number);

  if (!transport) return false;

  if (
    Date.now() - transport.lastActivity >
    SESSION_TIMEOUT
  ) {
    transports.delete(number);
    return false;
  }

  return true;
}

async function handleTransport(number, answer) {
  const transport = transports.get(number);

  if (!transport) {
    return {
      completed: false,
      reply: "Transport registration not found."
    };
  }

  if (
    Date.now() - transport.lastActivity >
    SESSION_TIMEOUT
  ) {
    transports.delete(number);

    return {
      completed: true,
      expired: true,
      reply:
        transport.lang === "ur"
          ? "⏰ آپ کی ٹرانسپورٹ رجسٹریشن 10 منٹ کی غیر فعالیت کی وجہ سے ختم ہو گئی ہے۔ براہِ کرم دوبارہ شروع کریں۔"
          : "⏰ Your Transport Registration expired after 10 minutes of inactivity. Please start again."
    };
  }

  transport.lastActivity = Date.now();

  const field =
    transportFields[transport.step];

  transport.data[field] = answer;

  if (field === "mobile") {
    const alreadyExists =
      await transportExists(answer);

    if (alreadyExists) {
      transports.delete(number);

      return {
        completed: true,
        duplicate: true,
        reply:
          transport.lang === "ur"
            ? "⚠️ اس موبائل نمبر سے ٹرانسپورٹ پارٹنر رجسٹریشن پہلے ہی جمع ہو چکی ہے۔"
            : "⚠️ A Transport Partner Registration has already been submitted using this mobile number."
      };
    }
  }

  transport.step++;

  if (
    transport.step >=
    transportQuestions[transport.lang].length
  ) {
    const data = transport.data;

    const partnerId =
      await generateApplicationNumber();

    const now = new Date();

    const nextFollowUp = new Date(now);
    nextFollowUp.setDate(
      nextFollowUp.getDate() + 7
    );

    await appendTransport([
      now.toLocaleString(),
      partnerId,
      data.companyName || "",
      data.contactPerson || "",
      data.mobile || "",
      data.city || "",
      data.province || "",
      data.cnic || "",
      data.governmentRegistration || "",
      data.partnerType || "",
      data.vehicleTypes || "",
      data.vehicleCount || "",
      data.routes || "",
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
      "Transport",
      partnerId
    );

    transports.delete(number);

    return {
      completed: true,
      data,
      referenceId: partnerId,
      reply:
        transport.lang === "ur"
          ? `✅ شکریہ!

آپ کی ٹرانسپورٹ پارٹنر رجسٹریشن موصول ہو گئی ہے۔

پارٹنر آئی ڈی:
${partnerId}

ہماری ٹیم آپ کی معلومات کا جائزہ لے گی اور آپ سے رابطہ کرے گی۔`
          : `✅ Thank you!

Your Transport & Vehicle Partner Registration has been received.

Partner ID:
${partnerId}

Our team will review your details and contact you.`
    };
  }

  transports.set(number, transport);

  return {
    completed: false,
    reply:
      transportQuestions[
        transport.lang
      ][transport.step]
  };
}

module.exports = {
  startTransport,
  isTransportRegistering,
  handleTransport
};
