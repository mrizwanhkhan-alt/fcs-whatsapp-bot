const {
  applications,
  questions,
  confirmations
} = require("./application");

const { getLanguage } = require("./language");

const {
  appendApplication,
  generateApplicationNumber
} = require("./googleSheets");

const {
  registerUser
} = require("./registeredUsers");


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




// START APPLICATION

function startApplication(number) {

  applications.set(number, {
    step: 0,
    data: {},
    startedAt: Date.now()
  });


  const lang =
    getLanguage(number) || "en";


  return (

    lang === "ur"

      ?

`📝 ایف سی ایس ایکسپریس فرنچائز درخواست

ایف سی ایس ایکسپریس کا انتخاب کرنے کا شکریہ۔

${questions[lang][0]}`


      :

`📝 FCS Express Franchise Application

Thank you for choosing FCS Express.

${questions[lang][0]}`

  );

}





// CHECK ACTIVE APPLICATION

function isApplying(number) {

  return applications.has(number);

}





// SAVE APPLICATION

async function saveApplication(number, data, lang) {

  try {

    const applicationNumber =
      await generateApplicationNumber();


    await appendApplication([

      new Date().toLocaleString(),

      applicationNumber,

      data.fullName,

      data.fatherName,

      data.mobile,

      number,

      data.cnic,

      data.email,

      data.province,

      data.city,

      data.area,

      data.address,

      data.education,

      data.experience,

      data.shop,

      data.comments,

      "Received",

      "Application Submitted",

      new Date().toLocaleString(),

      new Date(
        Date.now() + 3 * 24 * 60 * 60 * 1000
      ).toLocaleDateString()

    ]);



    registerUser(

      number,

      data.mobile,

      "Franchise",

      applicationNumber

    );



    applications.delete(number);

    confirmations.delete(number);
        return lang === "ur"

      ?

`🎉 شکریہ!

آپ کی فرنچائز درخواست کامیابی سے جمع ہو گئی ہے۔

درخواست نمبر: ${applicationNumber}

براہِ کرم یہ درخواست نمبر محفوظ رکھیں۔

ہماری فرنچائز ڈویلپمنٹ ٹیم آپ کی درخواست کا جائزہ لے گی اور مزید رابطہ کرے گی.`


      :

`🎉 Thank you!

Your FCS Express Franchise Application has been submitted successfully.

Application Number: ${applicationNumber}

Please save this application number for future reference.

Our Franchise Development Team will review your application and contact you further.`;



  } catch (error) {

    console.error(
      "SAVE APPLICATION ERROR:",
      error
    );


    return lang === "ur"

      ?

`❌ درخواست جمع نہیں ہو سکی۔

براہِ کرم کچھ دیر بعد دوبارہ کوشش کریں۔`

      :

`❌ Application submission failed.

Please try again later.`;

  }

}





// HANDLE APPLICATION

async function handleApplication(number, answer) {


  const lang =
    getLanguage(number) || "en";



  if (confirmations.has(number)) {


    if (answer.trim() === "1") {


      const data =
        confirmations.get(number);



      return {

        completed: true,

        reply:
          await saveApplication(
            number,
            data,
            lang
          )

      };


    }



    if (answer.trim() === "2") {


      confirmations.delete(number);

      applications.delete(number);



      return {

        completed:false,

        reply:
          lang === "ur"

          ?

          "درخواست منسوخ کر دی گئی ہے۔ براہِ کرم دوبارہ شروع کریں۔"

          :

          "Application cancelled. Please start again."

      };


    }



    return {

      completed:false,

      reply:
        "Please reply 1 to confirm or 2 to cancel."

    };


  }





  const app =
    applications.get(number);



  if (!app) {


    return {

      completed:false,

      reply:
        "Application not found."

    };


  }





  // MOBILE VALIDATION

  if (fields[app.step] === "mobile") {


    const mobile =
      answer.replace(/\s+/g,"");



    if (!/^03\d{9}$/.test(mobile)) {


      return {

        completed:false,

        reply:
          "Please enter a valid mobile number."

      };


    }


  }
