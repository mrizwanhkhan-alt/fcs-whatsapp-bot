"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { ROLE_FEATURES, dashboardFeatures, canAccess, withinScope, normalizeTerritories, normalizeRole } = require("../dashboardRoles");

test("all four dashboards expose role-specific features", () => {
  for (const role of ["admin","business_center","franchise","communicator"]) {
    const items = dashboardFeatures({role});
    assert.equal(items.length, ROLE_FEATURES[role].length);
    assert.ok(items.every(x => x.visible));
  }
  assert.equal(normalizeRole("freelance_communicator"), "communicator");
  assert.deepEqual(dashboardFeatures({role:"unknown"}), []);
});
test("free accounts see locked features; active subscriptions unlock", () => {
  const identity = {role:"franchise"};
  assert.ok(dashboardFeatures(identity).every(x => x.locked));
  assert.equal(canAccess(identity,"calling"),false);
  assert.equal(canAccess(identity,"calling",{active:true}),true);
  assert.equal(canAccess(identity,"network",{active:true}),false);
  assert.equal(canAccess(identity,"calling",{active:true,expiresAt:"2000-01-01T00:00:00Z"}),false);
  assert.equal(canAccess({role:"admin"},"network"),true);
});
test("hierarchy prevents access outside assigned branches", () => {
  assert.equal(withinScope({role:"business_center",branchId:"bc1"},{businessCenterId:"bc1"}),true);
  assert.equal(withinScope({role:"business_center",branchId:"bc1"},{businessCenterId:"bc2"}),false);
  assert.equal(withinScope({role:"franchise",branchId:"fr1"},{franchiseId:"fr1"}),true);
  assert.equal(withinScope({role:"franchise",branchId:"fr1"},{franchiseId:"fr2"}),false);
  assert.equal(withinScope({role:"communicator",id:"c1"},{communicatorId:"c1"}),true);
  assert.equal(withinScope({role:"communicator",id:"c1"},{communicatorId:"c2"}),false);
});
test("remote multi-city territories do not depend on current location", () => {
  assert.deepEqual(normalizeTerritories([
    {province:"Punjab",city:"Multan",area:""},
    {province:"Sindh",city:"Karachi",area:"Gulshan"},
    {province:"",city:"Unknown"},
    null
  ]),[
    {province:"Punjab",city:"Multan",area:""},
    {province:"Sindh",city:"Karachi",area:"Gulshan"}
  ]);
});
