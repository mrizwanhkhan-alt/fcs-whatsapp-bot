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
