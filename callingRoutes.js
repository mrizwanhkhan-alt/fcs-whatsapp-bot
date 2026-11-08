
"use strict";

const crypto = require("crypto");

const {
  requestCallPermission,
  connectWhatsAppCall,
  terminateWhatsAppCall
} = require("./staffCalling");

const SECRET = process.env.STAFF_CALLING_SECRET || "";

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });

  res.end(JSON.stringify(data));
}

function authorized(req) {
  if (SECRET.length < 24) {
    return false;
  }

  const received = req.headers.authorization || "";
  const expected = "Bearer " + SECRET;

  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let finished = false;

    req.on("data", chunk => {
      if (finished) return;

      body += chunk.toString();

      if (Buffer.byteLength(body) > 100000) {
        finished = true;
        reject(new Error("Request too large"));
      }
    });

    req.on("end", () => {
      if (finished) return;
      finished = true;

      try {
        const parsed = JSON.parse(body);

        if (
          !parsed ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new Error("Invalid request body");
        }

        resolve(parsed);
      } catch {
        reject(new Error("Invalid JSON request"));
      }
    });

    req.on("error", error => {
      if (!finished) {
        finished = true;
        reject(error);
      }
    });
  });
}

function validateNumber(number) {
  const value = String(number || "")
    .trim()
    .replace(/^\+/, "");

  if (!/^\d{8,15}$/.test(value)) {
    throw new Error(
      "Valid international WhatsApp number required"
    );
  }

  return value;
}

function validateSDP(sdp) {
  if (
    typeof sdp !== "string" ||
    !sdp.startsWith("v=0") ||
    !sdp.includes("m=audio") ||
    sdp.length > 80000
  ) {
    throw new Error(
      "Valid WebRTC audio SDP offer required"
    );
  }

  return sdp;
}

function validateCallId(callId) {
  if (
    typeof callId !== "string" ||
    !/^[A-Za-z0-9_.:-]{1,256}$/.test(callId)
  ) {
    throw new Error("Valid WhatsApp call ID required");
  }

  return callId;
}

async function callingRoutes(req, res, url) {
  const pathname = url.pathname;

  if (!pathname.startsWith("/api/staff-calling/")) {
    return false;
  }

  if (req.method !== "POST") {
    sendJSON(res, 405, {
      success: false,
      error: "Method not allowed"
    });
    return true;
  }

  if (!authorized(req)) {
    sendJSON(res, 401, {
      success: false,
      error: "Unauthorized staff access"
    });
    return true;
  }

  try {
    const body = await readBody(req);

    if (pathname === "/api/staff-calling/permission") {
      const number = validateNumber(body.number);

      const result = await requestCallPermission(number);

      sendJSON(res, 200, {
        success: true,
        message: "Calling permission request submitted",
        result
      });

      return true;
    }

    if (pathname === "/api/staff-calling/connect") {
      const number = validateNumber(body.number);
      const sdp = validateSDP(body.sdp);

      const result = await connectWhatsAppCall(
        number,
        sdp
      );

      const callId =
        result.calls?.[0]?.id || null;

      sendJSON(res, 200, {
        success: true,
        message: "Meta calling request accepted",
        callId,
        result
      });

      return true;
    }

    if (pathname === "/api/staff-calling/terminate") {
      const callId = validateCallId(body.callId);

      const result = await terminateWhatsAppCall(
        callId
      );

      sendJSON(res, 200, {
        success: true,
        message: "Call termination submitted",
        result
      });

      return true;
    }

    sendJSON(res, 404, {
      success: false,
      error: "Unknown calling API route"
    });

    return true;

  } catch (error) {
    const message = error.message || "Calling API error";

    const metaMatch = message.match(
      /Meta API HTTP (\d{3})/
    );

    const status = metaMatch
      ? Number(metaMatch[1])
      : 400;

    sendJSON(
      res,
      status >= 400 && status <= 599 ? status : 502,
      {
        success: false,
        error: message
      }
    );

    return true;
  }
}

module.exports = {
  callingRoutes
};
