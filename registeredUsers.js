const registeredUsers = new Map();


// Register completed user

function registerUser(
  whatsappNumber,
  mobileNumber,
  registrationType,
  referenceId
) {

  const key =
    whatsappNumber + "_" +
    mobileNumber + "_" +
    registrationType;


  registeredUsers.set(key, {

  whatsappNumber: whatsappNumber,

  mobileNumber: mobileNumber,

  registrationType: registrationType,

  referenceId: referenceId,

  registeredAt: new Date().toLocaleString(),

  postMessages: 0,

  warnings: 0

});

}



// Check already registered

function isRegistered(
  whatsappNumber,
  mobileNumber,
  registrationType
) {

  const key =
    whatsappNumber + "_" +
    mobileNumber + "_" +
    registrationType;


  return registeredUsers.has(key);

}



// Get registered details

function getRegisteredUser(
  whatsappNumber,
  mobileNumber,
  registrationType
) {

  const key =
    whatsappNumber + "_" +
    mobileNumber + "_" +
    registrationType;


  return registeredUsers.get(key);

}



// Admin unlock user

function unlockUser(
  whatsappNumber,
  mobileNumber,
  registrationType
) {

  const key =
    whatsappNumber + "_" +
    mobileNumber + "_" +
    registrationType;


  registeredUsers.delete(key);

  return true;

}



module.exports = {

  registerUser,

  isRegistered,

  getRegisteredUser,

  unlockUser

};
