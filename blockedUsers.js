const blockedUsers = new Map();
const abuseCounter = new Map();

const MAX_ABUSE = 3;

function isBlocked(number) {
  return blockedUsers.has(String(number));
}

function recordAbuse(number) {
  const key = String(number);

  let count =
    abuseCounter.get(key) || 0;

  count++;

  abuseCounter.set(
    key,
    count
  );

  if (count >= MAX_ABUSE) {
    blockedUsers.set(
      key,
      {
        reason: "Repeated warnings",
        date: new Date().toLocaleString()
      }
    );

    return {
      blocked: true,
      message:
        "This number has been restricted after repeated warnings."
    };
  }

  return {
    blocked: false,
    message:
      `Warning ${count}/${MAX_ABUSE}`
  };
}

function blockUser(number, reason = "Manual block") {
  const key = String(number);

  blockedUsers.set(
    key,
    {
      reason,
      date: new Date().toLocaleString()
    }
  );

  return true;
}

function unblockUser(number) {
  const key = String(number);

  blockedUsers.delete(key);
  abuseCounter.delete(key);

  return true;
}

module.exports = {
  isBlocked,
  recordAbuse,
  blockUser,
  unblockUser
};
