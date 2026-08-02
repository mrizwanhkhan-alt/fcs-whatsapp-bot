const {
  suppliers,
  supplierQuestions
} = require("./supplier");


const {
  appendSupplier,
  generateApplicationNumber
} = require("./googleSheets");



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





// START SUPPLIER REGISTRATION

function startSupplier(number, lang = "en") {


  suppliers.set(number, {

    step: 0,

    data: {},

    lang: lang

  });


  return supplierQuestions[lang][0];

}





// CHECK ACTIVE SUPPLIER

function isSupplierRegistering(number) {

  return suppliers.has(number);

}





// HANDLE SUPPLIER REGISTRATION

async function handleSupplier(number, answer) {


  const supplier =
    suppliers.get(number);



  if (!supplier) {


    return {

      completed: false,

      reply: "Supplier registration not found."

    };

  }





  const field =
    supplierFields[supplier.step];



  supplier.data[field] = answer;



  supplier.step++;






  if (
    supplier.step >=
    supplierQuestions[supplier.lang].length
  ) {



    const data =
      supplier.data;



    const supplierNumber =
      await generateApplicationNumber();






    await appendSupplier([


      new Date().toLocaleString(),

      supplierNumber,

      data.companyName,

      data.contactPerson,

      data.mobile,

      data.city,

      data.province,

      data.cnic,

      data.governmentLicence,

      data.category,

      data.pastProjects,

      data.additionalDetails,

      "Received"


    ]);






    suppliers.delete(number);






    return {

      completed: true,


      reply:

`✅ Thank you!

Your Supplier Registration has been received.

Supplier ID: ${supplierNumber}

Company: ${data.companyName}

Our team will review your details and contact you.`

    };


  }






  suppliers.set(number, supplier);






  return {

    completed: false,

    reply:
      supplierQuestions[supplier.lang][supplier.step]

  };


}




module.exports = {

  startSupplier,

  isSupplierRegistering,

  handleSupplier

};
