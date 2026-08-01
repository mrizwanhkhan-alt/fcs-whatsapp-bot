const { getApplications } = require("./googleSheets");
const { getEngagementMessage } = require("./engagementManager");


// Check applicants needing engagement
async function checkEngagement() {

  const rows = await getApplications();

  const today = new Date();


  for (let i = 1; i < rows.length; i++) {

    const row = rows[i];


    const applicationDate = row[0];
    const status = row[16];
    const lastMessageSent = row[18];
    const nextFollowUpDate = row[19];


    // Skip completed applicants
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
      "Applicant:",
      row[2],
      "Message:",
      engagement.message
    );

  }

}


module.exports = {
  checkEngagement
};
