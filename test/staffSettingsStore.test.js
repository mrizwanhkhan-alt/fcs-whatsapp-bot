"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

test("staff settings persist, reload after cache expiry, and stay editable", async () => {
  const storePath = require.resolve("../staffSettingsStore");
  const sheetsPath = require.resolve("../googleSheets");
  const configPath = require.resolve("../config");
  const originalSheets = require.cache[sheetsPath];
  const originalConfig = require.cache[configPath];
  const originalStore = require.cache[storePath];
  let rows = [];
  const fake = {
    spreadsheets: {
      get: async () => ({ data: { sheets: [{ properties: { title: "FCS_Staff_Settings" } }] } }),
      values: {
        get: async () => ({ data: { values: rows.slice(1).map(r => [...r]) } }),
        update: async ({ requestBody }) => { rows = requestBody.values.map(r => [...r]); return {}; }
      }
    }
  };
  require.cache[sheetsPath] = { id: sheetsPath, filename: sheetsPath, loaded: true, exports: { sheets: fake } };
  require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: { GOOGLE_SHEET_ID: "test-sheet" } };
  delete require.cache[storePath];
  try {
    const store = require("../staffSettingsStore");
    const initial = { calling: true, recording: false, active: true, startsAt: "2026-01-01", expiresAt: "2099-12-31" };
    await store.saveSettings("agent01", initial);
    assert.deepEqual(store.cachedSettings().get("agent01"), initial);
    assert.deepEqual((await store.listSettings()).get("agent01"), initial);
    const edited = { ...initial, calling: false, active: false };
    await store.saveSettings("agent01", edited);
    assert.deepEqual((await store.listSettings()).get("agent01"), edited);
    assert.equal(rows.length, 2);
    await assert.rejects(store.saveSettings("agent01", { ...edited, recording: true }), { status: 400 });
    delete require.cache[storePath];
    const afterRestart = require("../staffSettingsStore");
    assert.deepEqual((await afterRestart.refreshSettings()).get("agent01"), edited);
  } finally {
    if (originalSheets) require.cache[sheetsPath] = originalSheets; else delete require.cache[sheetsPath];
    if (originalConfig) require.cache[configPath] = originalConfig; else delete require.cache[configPath];
    if (originalStore) require.cache[storePath] = originalStore; else delete require.cache[storePath];
  }
});
