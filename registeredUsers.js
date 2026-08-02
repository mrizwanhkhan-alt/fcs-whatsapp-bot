const registeredUsers = new Map();


// Register completed user

function registerUser(
  number,
  registrationType,
  referenceId
) {

  registeredUsers.set(number, {

    registrationType: registrationType,

    referenceId: referenceId,

    registeredAt: new Date().toLocaleString()

  });

}



// Check already registered

function isRegistered(number) {

  return registeredUsers.has(number);

}



// Get registered details

function getRegisteredUser(number) {

  return registeredUsers.get(number);

}



// Admin unlock user

function unlockUser(number) {

  registeredUsers.delete(number);

  return true;

}



module.exports = {

  registerUser,

  isRegistered,

  getRegisteredUser,

  unlockUser

};
