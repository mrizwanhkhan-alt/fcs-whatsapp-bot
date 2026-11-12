"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { subscriptionOf } = require("../staffSubscription");

test("staff subscriptions fail closed when inactive or missing dates", () => {
  assert.equal(subscriptionOf({ active: false, startsAt: "2026-01-01", expiresAt: "2099-12-31" }).status, "disabled");
  assert.equal(subscriptionOf({ active: true }).status, "unconfigured");
});
test("subscriptions enforce UTC dates and expiration", () => {
  const account = { active: true, startsAt: "2026-01-01", expiresAt: "2026-01-02" };
  assert.equal(subscriptionOf(account, Date.parse("2025-12-31T23:59:59Z")).status, "scheduled");
  assert.equal(subscriptionOf(account, Date.parse("2026-01-02T23:59:59Z")).status, "active");
  assert.equal(subscriptionOf(account, Date.parse("2026-01-03T00:00:00Z")).status, "expired");
});
