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



// Remove registration (admin use later)

function removeRegisteredUser(number) {

  registeredUsers.delete(number);

}



module.exports = {

  registerUser,

  isRegistered,

  getRegisteredUser,

  removeRegisteredUser

};
