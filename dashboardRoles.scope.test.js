"use strict";
const assert = require("node:assert/strict");
const { withinScope, canAccessCustomer, filterAuthorizedCustomers } = require("./dashboardRoles");
const center = { role: "business_center", branchId: "BC-1" };
assert.equal(withinScope(center, { businessCenterId: "BC-1", franchiseId: "FR-1" }), true);
assert.equal(withinScope(center, { businessCenterId: "BC-1", communicatorId: "C-1", type: "franchise_communicator" }), true);
assert.equal(withinScope(center, { businessCenterId: "BC-2", franchiseId: "FR-2" }), false);
assert.equal(withinScope(center, { franchiseId: "FR-1", communicatorId: "C-1" }), false);
assert.equal(withinScope(center, { branchId: "BC-1", type: "franchise_communicator" }), false);
assert.equal(withinScope({ role: "franchise", branchId: "FR-1" }, { franchiseId: "FR-2" }), false);
assert.equal(withinScope({ role: "communicator", id: "C-1" }, { communicatorId: "C-2" }), false);
console.log("Dashboard hierarchy scope checks passed");

const customers = [
  { id: "A", businessCenterId: "BC-1", franchiseId: "FR-1", communicatorId: "C-1" },
  { id: "B", businessCenterId: "BC-2", franchiseId: "FR-2", communicatorId: "C-2" },
  { id: "C" }
];
assert.deepEqual(filterAuthorizedCustomers(center, customers).map(c => c.id), ["A"]);
assert.deepEqual(filterAuthorizedCustomers({ role: "franchise", branchId: "FR-1" }, customers).map(c => c.id), ["A"]);
assert.deepEqual(filterAuthorizedCustomers({ role: "communicator", id: "C-1" }, customers).map(c => c.id), ["A"]);
assert.equal(canAccessCustomer({ role: "communicator", id: "C-1" }, customers[2]), false);
assert.equal(canAccessCustomer({ role: "viewer", branchId: "BC-1" }, customers[0]), false);
