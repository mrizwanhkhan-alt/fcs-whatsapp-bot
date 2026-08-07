const { engagementPlan } = require("./engagement");

function getDaysPassed(applicationDate) {
  const today = new Date();
  const appliedDate = new Date(applicationDate);

  const difference = today - appliedDate;

  return Math.floor(
    difference / (1000 * 60 * 60 * 24)
  );
}

function getEngagementMessage(
  applicationDate,
  engagementStage
) {
  const daysPassed =
    getDaysPassed(applicationDate);

  let selectedMessage = null;

  for (const item of engagementPlan) {
    if (daysPassed >= item.day) {
      selectedMessage = item;
    }
  }

  if (!selectedMessage) {
    return null;
  }

  if (
    engagementStage ===
    selectedMessage.stage
  ) {
    return null;
  }

  return {
    stage: selectedMessage.stage,
    message: selectedMessage.message,
    nextDay: selectedMessage.nextDay
  };
}

module.exports = {
  getDaysPassed,
  getEngagementMessage
};
