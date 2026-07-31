const { applications, questions } = require("./application");

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

  return (
    "📝 FCS Express Franchise Application\n\n" +
    "Thank you for choosing FCS Express.\n\n" +
    questions[0]
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

  if (app.step >= questions.length) {

    const completedData = app.data;

    applications.delete(number);

    return {
      completed: true,
      data: completedData,
      reply:
`🎉 Thank you!

Your franchise application has been submitted successfully.

Our Franchise Development Team will review your application and contact you shortly.`
    };

  }

  applications.set(number, app);

  return {
    completed: false,
    reply: questions[app.step]
  };
}

module.exports = {
  startApplication,
  isApplying,
  handleApplication
};
