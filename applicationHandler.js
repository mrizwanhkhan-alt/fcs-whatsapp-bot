const {
  applications,
  completedApplications,
  questions
} = require("./application");
const { getLanguage } = require("./language");
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
    return `⚠️ Franchise Application Already Submitted

Our records show that a franchise application has already been submitted using this WhatsApp number.

If you need to update your information or have any questions about your application, please contact our Franchise Development Team.

📱 WhatsApp: +92 316 0034207
📧 Email: info@fcsexpress.com.pk

Thank you for your interest in FCS Express Pakistan.`;
  }

  applications.set(number, {
    step: 0,
    data: {}
  });

  return (
    "📝 FCS Express Franchise Application\n\n" +
    "Thank you for choosing FCS Express.\n\n" +
    questions[getLanguage(number) || "en"][0]
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
`🎉 Thank you!

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
