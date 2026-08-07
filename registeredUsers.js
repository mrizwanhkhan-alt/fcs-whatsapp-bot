const registeredUsers = new Map();

function registerUser(
  whatsappNumber,
  mobileNumber,
  registrationType,
  referenceId
) {
  const key = String(whatsappNumber);

  registeredUsers.set(key, {
    whatsappNumber,
    mobileNumber,
    registrationType,
    referenceId,
    registeredAt: new Date().toLocaleString(),
    postMessages: 0,
    warnings: 0
  });
}

function isRegistered(whatsappNumber) {
  return registeredUsers.has(
    String(whatsappNumber)
  );
}

function getRegisteredUser(whatsappNumber) {
  return registeredUsers.get(
    String(whatsappNumber)
  );
}

function unlockUser(whatsappNumber) {
  registeredUsers.delete(
    String(whatsappNumber)
  );

  return true;
}

module.exports = {
  registerUser,
  isRegistered,
  getRegisteredUser,
  unlockUser
};
