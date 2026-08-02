const {
  transports,
  transportQuestions
} = require("./transport");


const {
  appendTransport,
  generateApplicationNumber
} = require("./googleSheets");


const {
  registerUser
} = require("./registeredUsers");



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





// START TRANSPORT REGISTRATION

function startTransport(number, lang = "en") {


  transports.set(number, {

    step: 0,

    data: {},

    lang: lang

  });


  return transportQuestions[lang][0];

}





// CHECK ACTIVE TRANSPORT REGISTRATION

function isTransportRegistering(number) {

  return transports.has(number);

}





// HANDLE TRANSPORT REGISTRATION

async function handleTransport(number, answer) {


  const transport =
    transports.get(number);



  if (!transport) {


    return {

      completed: false,

      reply: "Transport registration not found."

    };

  }





  const field =
    transportFields[transport.step];



  transport.data[field] = answer;



  transport.step++;






  if (
    transport.step >=
    transportQuestions[transport.lang].length
  ) {



    const data =
      transport.data;



    const partnerId =
      await generateApplicationNumber();






    await appendTransport([


      new Date().toLocaleString(),

      partnerId,

      data.companyName,

      data.contactPerson,

      data.mobile,

      data.city,

      data.province,

      data.cnic,

      data.governmentRegistration,

      data.partnerType,

      data.vehicleTypes,

      data.vehicleCount,

      data.routes,

      data.pastProjects,

      data.additionalDetails,

      "Received"

    ]);





    registerUser(
      number,
      "Transport",
      partnerId
    );





    transports.delete(number);






    return {

      completed: true,


      reply:

`✅ Thank you!

Your Transport & Vehicle Partner Registration has been received.

Partner ID: ${partnerId}

Our team will review your details and contact you.`

    };


  }






  transports.set(number, transport);






  return {

    completed: false,

    reply:
      transportQuestions[transport.lang][transport.step]

  };


}





module.exports = {

  startTransport,

  isTransportRegistering,

  handleTransport

};
