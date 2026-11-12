"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");

test("call history survives module restart, deduplicates webhooks, scopes staff and calculates duration", async () => {
  const sheet = [];
  const titles = new Set();
  const sheets = { spreadsheets: {
    get: async () => ({ data: { sheets: [...titles].map(title => ({ properties: { title } })) } }),
    batchUpdate: async () => { titles.add("FCS_Call_History"); },
    values: {
      get: async ({range}) => ({ data: { values: range.endsWith("A2:J") ? sheet.slice(1) : sheet } }),
      update: async ({requestBody}) => { sheet[0] = requestBody.values[0]; },
      append: async ({requestBody}) => { sheet.push(requestBody.values[0]); }
    }
  }};
  const googlePath = require.resolve("../googleSheets");
  const configPath = require.resolve("../config");
  const storePath = require.resolve("../callHistoryStore");
  const oldGoogle = require.cache[googlePath], oldConfig = require.cache[configPath], oldStore = require.cache[storePath];
  try {
    require.cache[googlePath] = { id: googlePath, filename: googlePath, loaded: true, exports: { sheets } };
    require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: { GOOGLE_SHEET_ID: "test-sheet" } };
    delete require.cache[storePath];
    let store = require("../callHistoryStore");
    const event = { id: "call-1", staffId: "staffA", owner: "session-1", number: "923001234567",
      direction: "outgoing", state: "ended", startedAt: "2026-11-12T10:00:00.000Z",
      answeredAt: "2026-11-12T10:00:05.000Z", endedAt: "2026-11-12T10:01:05.000Z" };
    await store.appendEvent(event);
    await store.appendEvent(event);
    assert.equal(sheet.length, 2);
    delete require.cache[storePath];
    store = require("../callHistoryStore");
    await store.appendEvent(event);
    assert.equal(sheet.length, 2, "duplicate webhook after restart must not append");
    const own = await store.listHistory({ staffId: "staffA" });
    assert.equal(own.length, 1);
    assert.equal(own[0].durationSeconds, 60);
    assert.equal((await store.listHistory({ staffId: "staffB" })).length, 0);
    assert.equal((await store.listHistory({ superAdmin: true })).length, 1);
  } finally {
    if (oldGoogle) require.cache[googlePath] = oldGoogle; else delete require.cache[googlePath];
    if (oldConfig) require.cache[configPath] = oldConfig; else delete require.cache[configPath];
    if (oldStore) require.cache[storePath] = oldStore; else delete require.cache[storePath];
  }
});
