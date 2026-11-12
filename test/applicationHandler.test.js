"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");

test("franchise submission retains the final answer when Sheets must be retried", async () => {
  let fail = true;
  const saved = [];
  const fixture = (path, exports) => {
    const id = require.resolve(path);
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  fixture("../googleSheets", {
    numberExists: async () => false,
    generateApplicationNumber: async () => "FCS-TEST",
    appendApplication: async row => {
      if (fail) throw new Error("Sheets unavailable");
      saved.push(row);
    }
  });
  fixture("../registeredUsers", { registerUser() {} });
  const { startApplication, handleApplication } = require("../applicationHandler");
  const number = "923000000075";
  startApplication(number);
  for (let step = 0; step < 12; step++) {
    assert.equal((await handleApplication(number, "answer " + step)).completed, false);
  }
  await assert.rejects(handleApplication(number, "final comments"), /Sheets unavailable/);
  fail = false;
  const result = await handleApplication(number, "final comments");
  assert.equal(result.completed, true);
  assert.equal(result.data.comments, "final comments");
  assert.equal(saved.length, 1);
});
