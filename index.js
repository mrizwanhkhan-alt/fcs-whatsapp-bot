const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "FCS2026Verify";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = "1336918219494908";

function sendWhatsAppMessage(to, message) {
  const data = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: {
      preview_url: false,
      body: message
    }
  });

  const options = {
    hostname: "graph.facebook.com",
    path: `/v25.0/${PHONE_NUMBER_ID}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  const request = https.request(options, (response) => {
    let responseBody = "";

    response.on("data", (chunk) => {
      responseBody += chunk;
    });

    response.on("end", () => {
      console.log("WhatsApp response:", response.statusCode, responseBody);
    });
  });

  request.on("error", (error) => {
    console.error("WhatsApp sending error:", error.message);
  });

  request.write(data);
  request.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("FCS Express WhatsApp Bot is running");
  }

  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(challenge);
    }

    res.writeHead(403);
    return res.end("Verification failed");
  }

  if (req.method === "POST" && url.pathname === "/webhook") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      res.writeHead(200);
      res.end("EVENT_RECEIVED");

      try {
        const webhookData = JSON.parse(body);

        const message =
          webhookData.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (!message) {
          return;
        }

        const customerNumber = message.from;

        const reply =
          "Welcome to FCS Express.\n\nThank you for contacting us. Please tell us how we can help you.";

        sendWhatsAppMessage(customerNumber, reply);
      } catch (error) {
        console.error("Webhook processing error:", error.message);
      }
    });

    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FCS Express bot running on port ${PORT}`);
});
