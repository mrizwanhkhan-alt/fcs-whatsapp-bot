
const https = require("https");
const config = require("./config");

const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;

function connectWhatsAppCall(customerNumber, sdpOffer) {
  return new Promise((resolve, reject) => {
    if (!customerNumber || !sdpOffer) {
      return reject(
        new Error("Customer number and WebRTC SDP offer required")
      );
    }

    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      to: customerNumber,
      action: "connect",
      session: {
        sdp_type: "offer",
        sdp: sdpOffer
      }
    });

    const req = https.request({
      hostname: "graph.facebook.com",
      path: `/v21.0/${PHONE_NUMBER_ID}/calls`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      }
    }, res => {
      let body = "";

      res.on("data", chunk => body += chunk);

      res.on("end", () => {
        try {
          const result = JSON.parse(body);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(result);
          } else {
            reject(new Error(JSON.stringify(result)));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", reject);
    req.end(payload);
  });
}

module.exports = { connectWhatsAppCall };
