function sendWhatsAppMessage(to, message) {
  if (!PHONE_NUMBER_ID) {
    console.error("PHONE_NUMBER_ID is missing.");
    return;
  }

  if (!WHATSAPP_TOKEN) {
    console.error("WHATSAPP_TOKEN is missing.");
    return;
  }

  // keep your existing sending code here
}

module.exports = {
  sendWhatsAppMessage
};
