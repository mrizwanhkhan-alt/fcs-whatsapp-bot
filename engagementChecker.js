const {
  getApplications,
  updateEngagement
} = require("./googleSheets");

const {
  getEngagementMessage
} = require("./engagementManager");

async function checkEngagement(sendWhatsAppMessage) {

  const rows = await getApplications();

  for (let i = 1; i < rows.length; i++) {

    const row = rows[i];
    const sheetRow = i + 1;

    const applicationDate = row[0];
    const whatsappNumber = row[5];
    const status = row[16];
    const engagementStage = row[17];

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

    if (!engagement || !whatsappNumber) {
      continue;
    }

    await sendWhatsAppMessage(
      whatsappNumber,
      engagement.message
    );

    const nextDate = new Date();

    nextDate.setDate(
      nextDate.getDate() +
      engagement.nextDay
    );

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
