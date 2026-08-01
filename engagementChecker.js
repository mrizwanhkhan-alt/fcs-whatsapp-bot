const {
  getApplications,
  updateEngagement
} = require("./googleSheets");

const {
  getEngagementMessage
} = require("./engagementManager");



// Check applicants needing engagement

async function checkEngagement(sendWhatsAppMessage) {


  const rows =
    await getApplications();



  for (
    let i = 1;
    i < rows.length;
    i++
  ) {


    const row = rows[i];


    const sheetRow = i + 1;


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



    // Send WhatsApp

    sendWhatsAppMessage(
      whatsappNumber,
      engagement.message
    );



    // Calculate next follow up

    const nextDate =
      new Date();


    nextDate.setDate(
      nextDate.getDate() + engagement.nextDay
    );



    // Update Google Sheet

    await updateEngagement(
      sheetRow,
      engagement.stage,
      nextDate.toLocaleDateString()
    );


  }


}



module.exports = {

  checkEngagement

};
