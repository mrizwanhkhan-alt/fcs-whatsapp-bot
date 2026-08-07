const {
  getApplications,
  getSuppliers,
  getTransports,
  getWarehouses,
  updateEngagement,
  updateSupplierEngagement,
  updateTransportEngagement,
  updateWarehouseEngagement
} = require("./googleSheets");

const {
  getEngagementMessage
} = require("./engagementManager");

async function processRows(
  rows,
  mobileColumn,
  statusColumn,
  stageColumn,
  updateFunction,
  sendEngagementMessage
) {
  for (let i = 1; i < rows.length; i++) {

    const row = rows[i];
    const sheetRow = i + 1;

    const applicationDate = row[0];
    const whatsappNumber = row[mobileColumn];
    const status = row[statusColumn];
    const engagementStage = row[stageColumn];

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

    await sendEngagementMessage(
      whatsappNumber,
      engagement
    );

    let nextDate = "";

    if (engagement.nextDay !== null) {
      nextDate = new Date(applicationDate);

      nextDate.setDate(
        nextDate.getDate() +
        engagement.nextDay
      );

      nextDate =
        nextDate.toLocaleDateString();
    }

    await updateFunction(
      sheetRow,
      engagement.stage,
      nextDate
    );
  }
}

async function checkEngagement(
  sendEngagementMessage
) {

  await processRows(
    await getApplications(),
    5,
    16,
    17,
    updateEngagement,
    sendEngagementMessage
  );

  await processRows(
    await getSuppliers(),
    4,
    12,
    13,
    updateSupplierEngagement,
    sendEngagementMessage
  );

  await processRows(
    await getTransports(),
    4,
    15,
    16,
    updateTransportEngagement,
    sendEngagementMessage
  );

  await processRows(
    await getWarehouses(),
    4,
    17,
    18,
    updateWarehouseEngagement,
    sendEngagementMessage
  );
}

module.exports = {
  checkEngagement
};
