const { engagementPlan } = require("./engagement");


// Calculate applicant waiting days
function getDaysPassed(applicationDate) {

  const today = new Date();

  const appliedDate = new Date(applicationDate);

  const difference =
    today - appliedDate;

  const days =
    Math.floor(difference / (1000 * 60 * 60 * 24));

  return days;

}


// Find correct engagement message
function getEngagementMessage(applicationDate) {

  const daysPassed = getDaysPassed(applicationDate);

  let selectedMessage = null;


  for (const item of engagementPlan) {

    if (daysPassed >= item.day) {

      selectedMessage = item;

    }

  }


  return selectedMessage;

}


module.exports = {
  getDaysPassed,
  getEngagementMessage
};
