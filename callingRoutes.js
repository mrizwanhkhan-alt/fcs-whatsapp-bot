
"use strict";

const crypto = require("crypto");
const {
  requestCallPermission,
  connectWhatsAppCall
} = require("./staffCalling");

const SECRET = process.env.STAFF_CALLING_SECRET || "";

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function authorized(req) {
  const received = req.headers.authorization || "";
  const expected = "Bearer " + SECRET;

  return (
    SECRET.length >= 24 &&
    received.length === expected.length &&
    crypto.timingSafeEqual(
      Buffer.from(received),
      Buffer.from(expected)
    )
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

async function callingRoutes(req, res, url) {
  if (!url.pathname.startsWith("/api/staff-calling/")) {
    return false;
  }

  if (req.method !== "POST") {
    sendJSON(res, 405, { error: "Method not allowed" });
    return true;
  }

  if (!authorized(req)) {
    sendJSON(res, 401, { error: "Unauthorized" });
    return true;
  }

  try {
    const body = await readBody(req);

    if (url.pathname === "/api/staff-calling/permission") {
      const result = await requestCallPermission(body.number);
      sendJSON(res, 200, { result });
      return true;
    }

    if (url.pathname === "/api/staff-calling/connect") {
      const result = await connectWhatsAppCall(
        body.number,
        body.sdp
      );
      sendJSON(res, 200, { result });
      return true;
    }

    sendJSON(res, 404, { error: "Unknown route" });
    return true;

  } catch (error) {
    sendJSON(res, 400, { error: error.message });
    return true;
  }
}

module.exports = { callingRoutes };
