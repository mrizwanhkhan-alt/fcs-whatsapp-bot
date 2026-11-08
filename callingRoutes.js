"use strict";

const crypto = require("crypto");
const { PHONE_NUMBER_ID } = require("./config");
const {
  normalizeNumber,
  getCallPermission,
  requestCallPermission,
  connectWhatsAppCall,
  updateWhatsAppCall
} = require("./staffCalling");

const SECRET = process.env.STAFF_CALLING_SECRET || "";
const APP_SECRET = process.env.META_APP_SECRET || "";
const TEMPLATE = process.env.CALL_PERMISSION_TEMPLATE_NAME || "";
const ICE_SERVERS = process.env.STAFF_CALLING_ICE_SERVERS;
const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const calls = new Map();
const pending = new Map();
const RING_MS = 90000;
const END_MS = 10 * 60 * 1000;
const ACTIVE_MS = 12 * 60 * 60 * 1000;

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(data));
}

function safeEqual(received, expected) {
  const a = Buffer.from(received || "");
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 100000) {
      req.resume();
      fail(413, "Calling request too large.");
    }
    chunks.push(chunk);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    fail(400, "Invalid JSON request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    fail(400, "Invalid calling request.");
  }
  return body;
}

function validSDP(sdp) {
  return typeof sdp === "string" && sdp.length <= 80000 &&
    /^v=0\r?\n/.test(sdp) && /^m=audio\s/m.test(sdp);
}

function validId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_.:+/=-]{1,256}$/.test(id);
}

function iceServers() {
  if (!ICE_SERVERS) return defaultIceServers;
  try {
    const servers = JSON.parse(ICE_SERVERS);
    if (Array.isArray(servers) && servers.every(server => server?.urls)) return servers;
  } catch {}
  fail(503, "STAFF_CALLING_ICE_SERVERS must contain a JSON array of ICE servers.");
}

function setState(call, state, duration) {
  call.state = state;
  call.expires = Date.now() + duration;
  if (duration === END_MS) {
    call.sdp = undefined;
  }
}

function prune() {
  const now = Date.now();
  for (const [id, call] of calls) {
    if (call.expires <= now) calls.delete(id);
  }
  for (const [id, call] of pending) {
    if (call.expires <= now) pending.delete(id);
  }
}

function ended(call) {
  return ["ended", "rejected", "failed"].includes(call.state);
}

function handleCallingWebhook(data, rawBody, signature) {
  if (!APP_SECRET || data.object !== "whatsapp_business_account") return;
  const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  if (!safeEqual(signature, expected)) return;

  prune();
  for (const entry of data.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (change.field !== "calls" || !PHONE_NUMBER_ID || value?.metadata?.phone_number_id !== PHONE_NUMBER_ID) {
        continue;
      }
      for (const event of value.calls || []) recordEvent(event);
      for (const event of value.statuses || []) {
        if (event?.type === "call") recordEvent(event);
      }
    }
  }
}

function recordEvent(event) {
  if (!validId(event?.id)) return;
  const existing = calls.get(event.id);
  const outbound = pending.get(event.biz_opaque_callback_data);
  if (outbound?.id && outbound.id !== event.id) return;
  if (outbound && existing && outbound !== existing) {
    Object.assign(outbound, existing, { owner: outbound.owner, number: outbound.number });
  }
  let call = outbound || existing;
  const type = event.session?.sdp_type;
  const incoming = event.event === "connect" && type === "offer" && validSDP(event.session.sdp);
  const terminal = event.event === "terminate" || event.status === "REJECTED";
  if (!call) {
    // Retain early termination and answer events until the connect request returns its call ID.
    if (!incoming && !terminal && type !== "answer" && !["RINGING", "ACCEPTED"].includes(event.status)) return;
    const eventAge = Date.now() - Number(event.timestamp) * 1000;
    if (incoming && Number.isFinite(eventAge) && eventAge > RING_MS) return;
    call = { number: event.from || event.from_user_id };
    setState(call, incoming ? "incoming" : "dialing", RING_MS);
  }
  call.id = event.id;
  calls.set(call.id, call);

  if (ended(call)) return;
  if (terminal) {
    const state = event.status === "REJECTED" ? "rejected" : event.status === "FAILED" ? "failed" : "ended";
    setState(call, state, END_MS);
  } else if (incoming && call.state === "incoming" && !call.sdp) {
    call.sdp = event.session.sdp;
  } else if (event.event === "connect" && type === "answer" && validSDP(event.session.sdp)) {
    call.sdp ||= event.session.sdp;
  } else if (event.status === "ACCEPTED") {
    setState(call, "accepted", ACTIVE_MS);
  } else if (event.status === "RINGING" && call.state === "dialing") {
    setState(call, "ringing", RING_MS);
  }
}

function publicCall(call) {
  return { id: call.id, number: call.number, state: call.state, sdp: call.sdp };
}

function getCall(callId) {
  if (!validId(callId)) fail(400, "Invalid WhatsApp call ID.");
  const call = calls.get(callId);
  if (!call) fail(404, "This WhatsApp call has expired or is unavailable.");
  return call;
}

async function updateCall(call, owner, action, sdp) {
  if (call.owner && call.owner !== owner) fail(409, "Another staff session is handling this call.");
  if (ended(call)) return publicCall(call);
  if (call.operation) fail(409, "A call action is already in progress.");
  if (action === "terminate" ? call.state === "incoming" : call.state !== "incoming") {
    fail(409, "This action is unavailable for the current call.");
  }
  if (action === "accept" && !validSDP(sdp)) fail(400, "A valid WebRTC audio answer is required.");

  call.operation = true;
  try {
    await updateWhatsAppCall(call.id, action, sdp);
    call.owner = owner;
    if (!ended(call)) {
      if (action === "accept") setState(call, "accepted", ACTIVE_MS);
      else setState(call, action === "reject" ? "rejected" : "ended", END_MS);
    }
    if (action === "accept") call.sdp = undefined;
  } catch (error) {
    if (!ended(call)) throw error;
  } finally {
    call.operation = false;
  }
  return publicCall(call);
}

async function handleAction(route, body) {
  if (route === "permission-status" || route === "permission" || route === "connect") {
    const number = normalizeNumber(body.number);
    const permission = await getCallPermission(number);
    if (route === "permission-status") return permission;
    if (route === "permission") {
      if (permission.canCall || ["temporary", "permanent", "granted"].includes(permission.permission)) {
        return { ...permission, submitted: false };
      }
      if (!permission.canRequest) fail(409, "Meta is not accepting another permission request for this customer yet.");
      if (body.useTemplate === true && !TEMPLATE) fail(503, "No approved call permission template is configured.");
      await requestCallPermission(number, body.useTemplate === true ? TEMPLATE : null);
      return { ...permission, submitted: true };
    }
    if (!permission.canCall) {
      fail(409, "Meta does not currently allow a call. Check the customer's permission and calling limits.");
    }
    if (!validSDP(body.sdp)) fail(400, "A valid WebRTC audio offer is required.");

    const belongsToStaff = call => call.owner === body.owner && !ended(call);
    if (Array.from(pending.values()).some(belongsToStaff) || Array.from(calls.values()).some(belongsToStaff)) {
      fail(409, "This staff session already has a call.");
    }
    const call = { number, owner: body.owner };
    const reference = crypto.randomUUID();
    setState(call, "dialing", RING_MS);
    pending.set(reference, call);
    try {
      const result = await connectWhatsAppCall(number, body.sdp, reference);
      const id = result.calls?.[0]?.id;
      if (!validId(id)) fail(502, "Meta did not return a WhatsApp call ID.");
      const earlyEvent = calls.get(id);
      if (earlyEvent && earlyEvent !== call) {
        Object.assign(call, earlyEvent, { number, owner: body.owner });
      }
      call.id = id;
      calls.set(id, call);
      return publicCall(call);
    } catch (error) {
      if (call.id) return publicCall(call);
      throw error;
    } finally {
      pending.delete(reference);
    }
  }

  if (route === "poll" || route === "session") {
    const incoming = [];
    for (const call of calls.values()) {
      if (call.state === "incoming" && !call.operation) incoming.push({ id: call.id, number: call.number });
    }
    let call;
    if (body.callId) {
      const existing = calls.get(body.callId);
      call = existing?.owner === body.owner ? publicCall(existing) : { id: body.callId, state: "ended" };
    }
    return { incoming, call, hasTemplate: Boolean(TEMPLATE), ...(route === "session" && { iceServers: iceServers() }) };
  }

  if (route === "offer") {
    const call = getCall(body.callId);
    if (call.state !== "incoming" || call.operation) fail(409, "This incoming call is no longer available.");
    return publicCall(call);
  }

  if (["accept", "reject", "terminate"].includes(route)) {
    return updateCall(getCall(body.callId), body.owner, route, body.sdp);
  }
  fail(404, "Unknown calling API route.");
}

async function callingRoutes(req, res, url) {
  if (req.method !== "POST") {
    sendJSON(res, 405, { success: false, error: "Method not allowed." });
    return;
  }
  if (SECRET.length < 24 || !safeEqual(req.headers.authorization, "Bearer " + SECRET)) {
    sendJSON(res, 401, { success: false, error: "Unauthorized staff access." });
    return;
  }
  if (!APP_SECRET || !PHONE_NUMBER_ID) {
    sendJSON(res, 503, { success: false, error: "Calling requires META_APP_SECRET and PHONE_NUMBER_ID on the server." });
    return;
  }

  try {
    const body = await readBody(req);
    if (typeof body.owner !== "string" || !/^[0-9a-f-]{36}$/.test(body.owner)) {
      fail(400, "Invalid staff session ID.");
    }
    prune();
    const route = url.pathname.slice("/api/staff-calling/".length);
    sendJSON(res, 200, { success: true, ...await handleAction(route, body) });
  } catch (error) {
    sendJSON(res, error.status || 502, { success: false, error: error.message });
  }
}

module.exports = { callingRoutes, handleCallingWebhook };
