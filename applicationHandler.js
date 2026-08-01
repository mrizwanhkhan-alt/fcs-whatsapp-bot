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


// START APPLICATION
function startApplication(number) {

  applications.set(number, {
    step: 0,
    data: {}
  });

  const lang = getLanguage(number) || "en";

  return (
    lang === "ur"
      ? "📝 ایف سی ایس ایکسپریس فرنچائز درخواست\n\n" +
        "ایف سی ایس ایکسپریس کا انتخاب کرنے کا شکریہ۔\n\n" +
        questions[lang][0]
      :
        "📝 FCS Express Franchise Application\n\n" +
        "Thank you for choosing FCS Express.\n\n" +
        questions[lang][0]
  );
}


// CHECK ACTIVE APPLICATION
function isApplying(number) {
  return applications.has(number);
}


// HANDLE APPLICATION
async function handleApplication(number, answer) {

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


  // APPLICATION COMPLETED
  if (app.step >= questions[lang].length) {


    const completedData = app.data;

const applicationNumber = await generateApplicationNumber();

await appendApplication([
  new Date().toLocaleString(),
  applicationNumber,
  completedData.fullName,
      completedData.fatherName,
      completedData.mobile,
      completedData.whatsapp,
      completedData.email,
      completedData.province,
      completedData.city,
      completedData.area,
      completedData.address,
      completedData.education,
      completedData.experience,
      completedData.shop,
      completedData.comments

    ]);


    applications.delete(number);



    return {

      completed: true,

      data: completedData,


    reply:

lang === "ur"

?

`🎉 شکریہ!

آپ کی فرنچائز درخواست کامیابی سے جمع ہو گئی ہے۔

درخواست نمبر: ${applicationNumber}

براہِ کرم یہ درخواست نمبر مستقبل کے لیے محفوظ رکھیں۔

ہماری فرنچائز ڈویلپمنٹ ٹیم آپ کی درخواست کا جائزہ لے گی اور مزید رابطہ کرے گی۔

ایف سی ایس ایکسپریس پاکستان کا انتخاب کرنے کا شکریہ۔`

:

`🎉 Thank you!

Your FCS Express Franchise Application has been submitted successfully.

Application Number: ${applicationNumber}

Please save this application number for future reference.

Our Franchise Development Team will review your application and contact you further.

Thank you for choosing FCS Express Pakistan.`

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
