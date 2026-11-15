"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");

test("franchise submission retains the final answer when Sheets must be retried", async () => {
  let fail = true;
  const saved = [];
  const consentRows = [];
  const headers = ["Application No", "Application Type", "Contact Number", "Consent", "Consent Date and Time (UTC)", "Source", "Consent Wording Version", "WhatsApp Sender"];
  const fixture = (path, exports) => {
    const id = require.resolve(path);
    require.cache[id] = { id, filename: id, loaded: true, exports };
  };
  fixture("../googleSheets", {
    sheets: { spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: "Application Contact Consent" } }] } }),
      values: {
        get: async ({ range }) => ({ data: { values: range.endsWith("A1:H1") ? [headers] : consentRows } }),
        append: async ({ requestBody }) => { consentRows.push(...requestBody.values); }
      }
    } },
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
  await handleApplication(number, "Applicant Name");
  await handleApplication(number, "Parent Name");
  const prompt = await handleApplication(number, "03000000075");
  assert.match(prompt.reply, /0332 6237178/);
  assert.deepEqual(prompt.interactive.action.buttons.map(button => button.reply.title), ["Yes", "No"]);
  assert.equal((await handleApplication(number, "invalid")).interactive.type, "button");

  const context = { verified: true, receivedAt: "2026-11-15T16:00:00.000Z", sender: number };
  assert.equal((await handleApplication(number, "No", { ...context, verified: false })).interactive.type, "button");
  assert.equal(consentRows.length, 0);
  const next = await handleApplication(number, "application_contact_no", context);
  assert.match(next.reply, /CNIC/);
  assert.deepEqual(consentRows, [["FCS-TEST", "Franchise", "03000000075", "NO", context.receivedAt, "WhatsApp bot", "application-contact-v1", number]]);
  assert.equal(await handleApplication(number, "application_contact_no", context), null);

  for (let step = 3; step < 12; step++) {
    assert.equal((await handleApplication(number, "answer " + step)).completed, false);
  }
  await assert.rejects(handleApplication(number, "final comments"), /Sheets unavailable/);
  fail = false;
  const result = await handleApplication(number, "final comments");
  assert.equal(result.completed, true);
  assert.equal(result.data.comments, "final comments");
  assert.equal(saved.length, 1);
  assert.equal(saved[0][1], consentRows[0][0]);
});
