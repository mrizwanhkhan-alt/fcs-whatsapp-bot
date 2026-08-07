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
module.exports = {
  startApplication,
  isApplying,
  handleApplication
};
