const http = require("http");
const https = require("https");

const config = require("./config");
const { getReply } = require("./openai");

const PORT = config.PORT;
const VERIFY_TOKEN = config.VERIFY_TOKEN;
const PHONE_NUMBER_ID = config.PHONE_NUMBER_ID;
const WHATSAPP_TOKEN = config.WHATSAPP_TOKEN;

function sendWhatsAppMessage(to, message) {
  if (!PHONE_NUMBER_ID) {
    console.error("PHONE_NUMBER_ID is missing.");
    return;
  }

  if (!WHATSAPP_TOKEN) {
    console.error("WHATSAPP_TOKEN is missing.");
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

  const request = https.request(options, (response) => {
    let responseBody = "";

    response.on("data", (chunk) => {
      responseBody += chunk.toString();
    });

    response.on("end", () => {
      console.log(
        "WhatsApp API:",
        response.statusCode,
        responseBody
      );
    });
  });

  request.on("error", (error) => {
    console.error(error.message);
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

    return res.end("FCS Express WhatsApp Bot Running");
  }

  if (req.method === "GET" && url.pathname === "/webhook") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token === VERIFY_TOKEN
    ) {
      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      return res.end(challenge || "");
    }

    res.writeHead(403);
    return res.end("Verification failed");
  }

  if (req.method === "POST" && url.pathname === "/webhook") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      res.writeHead(200, {
        "Content-Type": "text/plain"
      });

      res.end("EVENT_RECEIVED");

      try {
        const webhookData = JSON.parse(body);

        const value =
          webhookData.entry?.[0]?.changes?.[0]?.value;

        const message = value?.messages?.[0];

        if (!message) {
          console.log("No customer message found.");
          return;
        }

        const customerNumber = message.from;

        const customerText =
          message.text?.body ||
          `[${message.type || "unknown"} message]`;

        console.log("Customer:", customerNumber);
        console.log("Message:", customerText);

        const reply = await getReply(
          customerNumber,
          customerText
        );

        sendWhatsAppMessage(
          customerNumber,
          reply
        );

      } catch (error) {
        console.error(
          "Webhook Error:",
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

        res.end("Request Error");
      }
    });

    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain"
  });

  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("--------------------------------");
  console.log("FCS Express WhatsApp Bot Started");
  console.log("--------------------------------");

  console.log("Port:", PORT);

  console.log(
    "PHONE_NUMBER_ID:",
    PHONE_NUMBER_ID ? "Loaded" : "Missing"
  );

  console.log(
    "WHATSAPP_TOKEN:",
    WHATSAPP_TOKEN ? "Loaded" : "Missing"
  );

  console.log(
    "VERIFY_TOKEN:",
    VERIFY_TOKEN ? "Loaded" : "Missing"
  );

  console.log("--------------------------------");
  console.log("Webhook URL:");
  console.log("/webhook");
  console.log("--------------------------------");
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:");
  console.error(err);
});

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:");
  console.error(err);
});
