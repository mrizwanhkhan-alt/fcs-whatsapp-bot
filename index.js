const http = require("http");
const https = require("https");

const PORT = Number(process.env.PORT) || 10000;
const VERIFY_TOKEN =
  (process.env.VERIFY_TOKEN || "FCS2026Verify").trim();

const PHONE_NUMBER_ID =
  (process.env.PHONE_NUMBER_ID || "").trim();

const WHATSAPP_TOKEN =
  (process.env.WHATSAPP_TOKEN || "").trim();

function sendWhatsAppMessage(to, message) {
  if (!PHONE_NUMBER_ID) {
    console.error("PHONE_NUMBER_ID is missing in Render.");
    return;
  }

  if (!WHATSAPP_TOKEN) {
    console.error("WHATSAPP_TOKEN is missing in Render.");
    return;
  }

  const data = JSON.stringify({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(to),
    type: "text",
    text: {
      preview_url: false,
      body: message
    }
  });

  const options = {
    hostname: "graph.facebook.com",
    port: 443,
    path: `/v25.0/${PHONE_NUMBER_ID}/messages`,
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data)
    }
  };

  console.log(
    `Sending WhatsApp reply using Phone Number ID: ${PHONE_NUMBER_ID}`
  );

  const request = https.request(options, (response) => {
    let responseBody = "";

    response.on("data", (chunk) => {
      responseBody += chunk.toString();
    });

    response.on("end", () => {
      if (
        response.statusCode >= 200 &&
        response.statusCode < 300
      ) {
        console.log(
          "WhatsApp message sent successfully:",
          response.statusCode,
          responseBody
        );
      } else {
        console.error(
          "WhatsApp API error:",
          response.statusCode,
          responseBody
        );
      }
    });
  });

  request.on("error", (error) => {
    console.error(
      "WhatsApp sending request failed:",
      error.message
    );
  });

  request.write(data);
  request.end();
}

const server = http.createServer((req, res) => {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url, `http://${host}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain"
    });

    return res.end(
      "FCS Express WhatsApp Bot is running"
    );
  }

  if (
    req.method === "GET" &&
    url.pathname === "/webhook"
  ) {
    const mode = url.searchParams.get("hub.mode");
    const token =
      url.searchParams.get("hub.verify_token");
    const challenge =
      url.searchParams.get("hub.challenge");

    console.log(
      "Webhook verification request received."
    );

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN
    ) {
      console.log(
        "Webhook verified successfully."
      );

      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      return res.end(challenge || "");
    }

    console.error("Webhook verification failed.");

    res.writeHead(403, {
      "Content-Type": "text/plain"
    });

    return res.end("Verification failed");
  }

  if (
    req.method === "POST" &&
    url.pathname === "/webhook"
  ) {
    console.log("WEBHOOK POST RECEIVED");

    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      res.end("EVENT_RECEIVED");

      try {
        const webhookData = JSON.parse(body);

        console.log(
          "Webhook payload:",
          JSON.stringify(webhookData, null, 2)
        );

        const value =
          webhookData.entry?.[0]?.changes?.[0]
            ?.value;

        const message = value?.messages?.[0];

        if (!message) {
          console.log(
            "Webhook received without a customer message."
          );
          return;
        }

        const customerNumber = message.from;

        const customerText =
          message.text?.body ||
          `[${message.type || "unknown"} message]`;

        console.log(
          "Customer number:",
          customerNumber
        );

        console.log(
          "Customer message:",
          customerText
        );

        const reply =
  "🚚 Welcome to FCS Express Pakistan\n\n" +
  "Thank you for contacting FCS Express.\n\n" +
  "Please reply with the number below:\n\n" +
  "1️⃣ Apply for Franchise\n" +
  "2️⃣ Track Shipment\n" +
  "3️⃣ Our Services\n" +
  "4️⃣ Rate Calculator\n" +
  "5️⃣ Book a Pickup\n" +
  "6️⃣ Customer Support\n" +
  "7️⃣ Company Information\n" +
  "8️⃣ Business Account\n" +
  "9️⃣ Speak to a Representative";
        sendWhatsAppMessage(
          customerNumber,
          reply
        );
      } catch (error) {
        console.error(
          "Webhook processing error:",
          error.message
        );
      }
    });

    req.on("error", (error) => {
      console.error(
        "Webhook request error:",
        error.message
      );

      if (!res.headersSent) {
        res.writeHead(500, {
          "Content-Type": "text/plain"
        });

        res.end("Request error");
      }
    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain"
  });

  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `FCS Express bot running on port ${PORT}`
  );

  console.log(
    "PHONE_NUMBER_ID loaded:",
    PHONE_NUMBER_ID
      ? PHONE_NUMBER_ID
      : "MISSING"
  );

  console.log(
    "WHATSAPP_TOKEN loaded:",
    WHATSAPP_TOKEN
      ? "YES"
      : "MISSING"
  );
});
