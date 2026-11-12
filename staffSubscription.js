"use strict";

// Subscription policy is server-owned. No browser-supplied dates or activation flags.
// Accounts are configured via STAFF_ACCOUNTS_JSON in the deployment environment.
function subscriptionOf(account, now = Date.now()) {
  if (!account || account.active !== true) return { status: "disabled", expiresAt: null };
  const start = account.startsAt;
  const end = account.expiresAt;
  if (typeof start !== "string" || typeof end !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { status: "unconfigured", expiresAt: null };
  }
  const from = Date.parse(start + "T00:00:00Z");
  const until = Date.parse(end + "T00:00:00Z");
  if (!Number.isFinite(from) || !Number.isFinite(until) ||
      new Date(from).toISOString().slice(0, 10) !== start ||
      new Date(until).toISOString().slice(0, 10) !== end || until < from) {
    return { status: "unconfigured", expiresAt: null };
  }
  const expiresAt = new Date(until + 86400000).toISOString();
  return { status: now < from ? "scheduled" : now >= until + 86400000 ? "expired" : "active", expiresAt };
}
module.exports = { subscriptionOf };
