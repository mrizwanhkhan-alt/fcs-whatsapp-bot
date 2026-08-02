const {
  warehouses,
  warehouseQuestions
} = require("./warehouse");


const {
  appendWarehouse,
  generateApplicationNumber
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





// START WAREHOUSE REGISTRATION

function startWarehouse(number, lang = "en") {


  warehouses.set(number, {

    step: 0,

    data: {},

    lang: lang

  });


  return warehouseQuestions[lang][0];

}





// CHECK ACTIVE WAREHOUSE REGISTRATION

function isWarehouseRegistering(number) {

  return warehouses.has(number);

}





// HANDLE WAREHOUSE REGISTRATION

async function handleWarehouse(number, answer) {


  const warehouse =
    warehouses.get(number);



  if (!warehouse) {


    return {

      completed: false,

      reply: "Warehouse registration not found."

    };

  }





  const field =
    warehouseFields[warehouse.step];



  warehouse.data[field] = answer;



  warehouse.step++;






  if (
    warehouse.step >=
    warehouseQuestions[warehouse.lang].length
  ) {



    const data =
      warehouse.data;



    const partnerId =
      await generateApplicationNumber();






    await appendWarehouse([


      new Date().toLocaleString(),

      partnerId,

      data.companyName,

      data.contactPerson,

      data.mobile,

      data.city,

      data.province,

      data.cnic,

      data.governmentRegistration,

      data.facilityType,

      data.facilityCategory,

      data.capacity,

      data.truckCapacity,

      data.loadingFacility,

      data.address,

      data.pastProjects,

      data.additionalDetails,

      "Received"

    ]);






    registerUser(
      number,
      "Warehouse",
      partnerId
    );






    warehouses.delete(number);






    return {

      completed: true,


      reply:

`✅ Thank you!

Your Warehouse & Truck Adda Registration has been received.

Partner ID: ${partnerId}

Our team will review your details and contact you.`

    };


  }






  warehouses.set(number, warehouse);






  return {

    completed: false,

    reply:
      warehouseQuestions[warehouse.lang][warehouse.step]

  };


}





module.exports = {

  startWarehouse,

  isWarehouseRegistering,

  handleWarehouse

};
