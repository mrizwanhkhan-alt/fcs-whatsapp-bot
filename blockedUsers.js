// ==============================
// FCS EXPRESS BLOCKED USERS SYSTEM
// ==============================


const blockedUsers = new Map();

const abuseCounter = new Map();


// Maximum warnings before blocking

const MAX_ABUSE = 3;



// Check if number is blocked

function isBlocked(number) {

  return blockedUsers.has(number);

}



// Record abusive behaviour

function recordAbuse(number) {


  let count =
    abuseCounter.get(number) || 0;


  count++;


  abuseCounter.set(
    number,
    count
  );



  if (count >= MAX_ABUSE) {


    blockedUsers.set(
      number,
      {
        reason: "Repeated abusive messages",
        date: new Date().toLocaleString()
      }
    );


    return {
      blocked: true,
      message:
        "This number has been restricted due to repeated inappropriate messages."
    };

  }



  return {
    blocked: false,
    message:
      "Please use respectful language. Our team is here to assist you."
  };


}



// Manually unblock if required

function unblockUser(number) {

  blockedUsers.delete(number);

  abuseCounter.delete(number);

}




module.exports = {

  isBlocked,

  recordAbuse,

  unblockUser

};
