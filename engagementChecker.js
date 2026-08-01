const { getApplications } = require("./googleSheets");
const { getEngagementMessage } = require("./engagementManager");


// Check applicants needing engagement
async function checkEngagement(sendWhatsAppMessage) {

  const rows = await getApplications();


  for (let i = 1; i < rows.length; i++) {


    const row = rows[i];


    const applicationDate = row[0];
    const whatsappNumber = row[5];
    const status = row[16];


    // Skip completed cases
    if (
      status === "Approved" ||
      status === "Operational" ||
      status === "Rejected"
    ) {

      continue;

    }



    const engagement =
      getEngagementMessage(applicationDate);



    if (!engagement) {

      continue;

    }



    console.log(
      "Sending engagement to:",
      whatsappNumber
    );


    console.log(
      engagement.message
    );



    // Send WhatsApp message
    sendWhatsAppMessage(
      whatsappNumber,
      engagement.message
    );


  }

}



module.exports = {

  checkEngagement

};
