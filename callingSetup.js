
const https = require("https");

function enableCalling() {
  const phoneId = process.env.PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneId || !token) {
    console.error("WhatsApp API credentials missing");
    return;
  }

  const data = JSON.stringify({
    messaging_product: "whatsapp",
    calling: {
      status: "ENABLED",
      call_icon_visibility: "DEFAULT",
      callback_permission_status: "ENABLED"
    }
  });

  const req = https.request({
    hostname: "graph.facebook.com",
    path: `/v25.0/${phoneId}/settings`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  }, res => {
    let body = "";

    res.on("data", chunk => {
      body += chunk;
    });

    res.on("end", () => {
      console.log("HTTP Status:", res.statusCode);
      console.log("Calling Settings:", body);
    });
  });

  req.on("error", error => {
    console.error("Calling Setup Error:", error.message);
  });

  req.write(data);
  req.end();
}

module.exports = { enableCalling };
