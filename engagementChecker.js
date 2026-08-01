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

    const engagementStage = row[17];



    // Skip completed applications

    if (
      status === "Approved" ||
      status === "Operational" ||
      status === "Rejected"
    ) {

      continue;

    }



    const engagement =
      getEngagementMessage(
        applicationDate,
        engagementStage
      );



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



    sendWhatsAppMessage(
      whatsappNumber,
      engagement.message
    );



    // Future step:
    // Update Engagement Stage
    // Update Next Follow Up Date

  }

}



module.exports = {

  checkEngagement

};
