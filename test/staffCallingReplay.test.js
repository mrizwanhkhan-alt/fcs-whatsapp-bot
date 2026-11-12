"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const { promisify } = require("node:util");

const postgresUrl = process.env.FCS_TEST_DATABASE_URL;
const start = 1762941600;
const number = "923000000000";
const iso = seconds => new Date(seconds * 1000).toISOString();
const offer = id => ({ id, event: "connect", session: { sdp_type: "offer" }, from: number, timestamp: start });
const answer = id => ({ id, status: "ACCEPTED", timestamp: start + 5 });
const terminate = id => ({ id, event: "terminate", timestamp: start + 65 });
const rows = [];
let outage = false;
let journal;
let client;
let schema;
let apply;
let store;

function installFixture(path, exports) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

before(async () => {
  // The explicit test URL is scoped to a fresh schema. Application DATABASE_URL is never reused.
  delete process.env.DATABASE_URL;
  if (postgresUrl) {
    const { Client } = require("pg");
    schema = "calling_test_" + randomUUID().replaceAll("-", "");
    const scoped = new URL(postgresUrl);
    scoped.searchParams.set("options", "-c search_path=" + schema);
    client = new Client({ connectionString: scoped.toString() });
    await client.connect();
    await client.query(`CREATE SCHEMA ${schema}`);
    process.env.DATABASE_URL = scoped.toString();
    process.env.DATABASE_SSL = "disable";
  }
  installFixture("../config", { GOOGLE_SHEET_ID: "regression-test-sheet" });
  installFixture("../googleSheets", { sheets: { spreadsheets: {
    get: async () => ({ data: { sheets: [{ properties: { title: "FCS_Call_History" } }] } }),
    values: {
      get: async () => ({ data: { values: rows.map(row => [...row]) } }),
      append: async ({ requestBody }) => {
        if (outage) throw new Error("simulated Sheets outage");
        rows.push(...requestBody.values);
      }
    }
  } } });
  journal = require("../callTransactionalJournal");
  ({ replaySingleHistoryEvent: apply } = require("../callHistoryReplay"));
  store = require("../callHistoryStore");
});

after(async () => {
  if (!client) return;
  try {
    if (schema) await client.query(`DROP SCHEMA ${schema} CASCADE`);
  } finally {
    await client.end();
  }
});

async function assertCompleted(id) {
  const row = (await store.listHistory({ superAdmin: true })).find(item => item.id === id);
  assert.equal(row?.state, "ended");
  assert.equal(row.startedAt, iso(start));
  assert.equal(row.answeredAt, iso(start + 5));
  assert.equal(row.endedAt, iso(start + 65));
  assert.equal(row.durationSeconds, 60);
}

for (const order of ["IAT", "ITA", "AIT", "ATI", "TIA", "TAI"]) {
  test(`history preserves Meta timestamps and 60 seconds across separate replay batches: ${order}`, async () => {
    const id = "wacid.order-" + order;
    const events = { I: offer(id), A: { ...answer(id), from: number }, T: { ...terminate(id), from: number } };
    for (const letter of order) await apply(events[letter]);
    await assertCompleted(id);
    const before = rows.length;
    for (const letter of order) await apply(events[letter]);
    assert.equal(rows.length, before, "redelivery should not append history");
  });
}

test("a stale ringing event and a delayed offer cannot regress accepted history", async () => {
  const id = "wacid.late-offer";
  await apply({ ...answer(id), from: number });
  await apply({ id, status: "RINGING", timestamp: start + 1 });
  await apply(offer(id));
  const saved = await store.getById(id);
  assert.equal(saved.state, "accepted");
  assert.equal(saved.startedAt, iso(start));
  assert.equal(saved.answeredAt, iso(start + 5));
});

test("late history enrichment preserves staff access and the terminal state", async () => {
  const id = "wacid.staff-history";
  await store.appendEvent({ id, number, state: "ended", staffId: "agent-a",
    owner: "session-a", direction: "incoming", startedAt: iso(start), endedAt: iso(start + 65) });
  await apply(answer(id));
  await assertCompleted(id);
  assert.equal((await store.listHistory({ staffId: "agent-a" })).find(row => row.id === id)?.staffId, "agent-a");
  assert.ok(!(await store.listHistory({ staffId: "agent-b" })).some(row => row.id === id));
});

test("PostgreSQL replay checkpoints, retries after Sheets outage and recovers quarantined terminal events", { skip: !postgresUrl }, async () => {
  const quarantined = "wacid.quarantined";
  const ordinary = "wacid.ordinary";
  await journal.save([terminate(quarantined), offer(ordinary), answer(ordinary), terminate(ordinary)]);
  outage = true;
  try {
    assert.equal(await journal.replay(apply), 0);
  } finally {
    outage = false;
  }
  const get = async id => (await client.query("SELECT * FROM fcs_call_events WHERE call_id = $1", [id])).rows;
  const releaseRetries = () => client.query("UPDATE fcs_call_events SET next_retry_at = now() - interval '1 second' WHERE processed_at IS NULL");
  assert.ok((await get(ordinary)).every(row => row.attempts === 1 && row.next_retry_at && !row.processed_at));
  for (let attempt = 1; attempt < 5; attempt++) {
    await releaseRetries();
    await journal.replay(apply);
  }
  assert.ok((await get(quarantined))[0].quarantined_at);
  assert.ok((await get(ordinary)).every(row => row.processed_at));
  await assertCompleted(ordinary);
  await journal.save([offer(quarantined)]);
  assert.equal(await journal.replay(apply), 2);
  assert.equal((await get(quarantined)).find(row => row.payload.event === "terminate").quarantined_at, null);
  assert.equal((await store.getById(quarantined)).state, "ended");
  delete require.cache[require.resolve("../callTransactionalJournal")];
  assert.equal(await require("../callTransactionalJournal").replay(apply), 0);
});

test("two Node processes deduplicate PostgreSQL journal events and Sheets history writes", { skip: !postgresUrl }, async () => {
  const run = promisify(execFile);
  const script = `
    const fs = require("node:fs");
    const file = process.argv[1];
    const journal = require("./callTransactionalJournal");
    async function main() {
      await journal.save([{id:"shared-event", a:1, b:2}]);
      const fixture = (path, exports) => {
        const id = require.resolve(path);
        require.cache[id] = { id, filename:id, loaded:true, exports };
      };
      fixture("./config", { GOOGLE_SHEET_ID:"test" });
      fixture("./googleSheets", { sheets:{ spreadsheets:{
        get:async()=>({data:{sheets:[{properties:{title:"FCS_Call_History"}}]}}),
        values:{
          get:async()=>{
            const values = fs.existsSync(file) ? fs.readFileSync(file,"utf8").trim().split("\\n").map(JSON.parse) : [];
            await require("node:timers/promises").setTimeout(100);
            return {data:{values}};
          },
          append:async({requestBody})=>fs.appendFileSync(file, JSON.stringify(requestBody.values[0])+"\\n")
        }
      }}});
      await require("./callHistoryStore").appendEvent({id:"shared-history", number:"923000000000",state:"ended",direction:"incoming"});
    }
    main().then(()=>process.exit(0), error=>{console.error(error);process.exit(1)});
  `;
  const fs = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fcs-calling-test-"));
  try {
    const file = path.join(dir, "history.jsonl");
    await Promise.all([1, 2].map(() => run(process.execPath, ["-e", script, file], {
      cwd: path.resolve(__dirname, ".."), timeout: 10000
    })));
    assert.equal((await fs.readFile(file, "utf8")).trim().split("\n").length, 1);
    const result = await client.query("SELECT count(*)::int AS count FROM fcs_call_events WHERE call_id = 'shared-event'");
    assert.equal(result.rows[0].count, 1);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("message leases survive process restart, fence stale workers and retry failed replies", { skip: !postgresUrl }, async () => {
  const inbox = require("../messageInbox");
  const id = "wamid.lease-test";
  assert.deepEqual(await inbox.claim(id), { attempt: 1 });
  assert.deepEqual(await inbox.claim(id), { retry: true });
  await client.query("UPDATE fcs_message_inbox SET lease_until=now()-interval '1 second' WHERE message_id=$1", [id]);
  const run = promisify(execFile);
  const child = await run(process.execPath, ["-e", `
    require("./messageInbox").claim(process.argv[1]).then(value => {
      console.log(JSON.stringify(value));
      process.exit(0);
    }, error => { console.error(error); process.exit(1); });
  `, id], { cwd: require("node:path").resolve(__dirname, ".."), timeout: 10000 });
  assert.deepEqual(JSON.parse(child.stdout), { attempt: 2 });
  assert.equal(await inbox.complete(id, 1), false);
  assert.equal(await inbox.fail(id, 1, new Error("stale worker")), false);
  assert.equal(await inbox.fail(id, 2, new Error("simulated Graph outage")), true);
  assert.deepEqual(await inbox.claim(id), { retry: true });
  await client.query("UPDATE fcs_message_inbox SET next_retry_at=now()-interval '1 second' WHERE message_id=$1", [id]);
  assert.deepEqual(await inbox.claim(id), { attempt: 3 });
  assert.equal(await inbox.complete(id, 3), true);
  assert.deepEqual(await inbox.claim(id), { retry: false });
});

test("persisted messages can be recovered after ten failed attempts", { skip: !postgresUrl }, async () => {
  const inbox = require("../messageInbox");
  const id = "wamid.retry-budget";
  for (let attempt = 1; attempt <= 10; attempt++) {
    assert.deepEqual(await inbox.claim(id), { attempt });
    assert.equal(await inbox.fail(id, attempt, new Error("Graph unavailable")), true);
    await client.query("UPDATE fcs_message_inbox SET next_retry_at=now()-interval '1 second' WHERE message_id=$1", [id]);
  }
  assert.deepEqual(await inbox.claim(id), { attempt: 11 });
  const result = await client.query("SELECT completed_at,last_error FROM fcs_message_inbox WHERE message_id=$1", [id]);
  assert.deepEqual(result.rows[0], { completed_at: null, last_error: "Graph unavailable" });
});

test("application restart recovers without Meta redelivery and parks a crash-ambiguous reply", { skip: !postgresUrl }, async () => {
  const run = promisify(execFile);
  const fs = require("node:fs/promises");
  const path = require("node:path");
  const dir = await fs.mkdtemp(path.join(require("node:os").tmpdir(), "fcs-inbox-test-"));
  const sends = path.join(dir, "sends");
  const id = "wamid.restart-reply";
  const inbox = require("../messageInbox");
  const message = { id, from: "923000000000", type: "text", text: { body: "Hi" } };
  const expire = () => client.query(
    "UPDATE fcs_message_inbox SET lease_until=now()-interval '1 second' WHERE message_id=$1", [id]);
  const script = `
    const fs = require("node:fs");
    const https = require("node:https");
    const { EventEmitter } = require("node:events");
    const [file, mode, id] = process.argv.slice(1);
    https.request = (options, callback) => {
      if (options.hostname !== "graph.facebook.com") throw Error("Unexpected network request");
      const req = new EventEmitter();
      req.write = () => {};
      req.end = () => queueMicrotask(() => {
        fs.appendFileSync(file, "accepted\\n");
        if (mode === "crash") process.exit(73);
        const response = new EventEmitter();
        response.statusCode = 200;
        callback(response);
        response.emit("data", JSON.stringify({messages:[{id:"wamid.graph-reply"}]}));
        response.emit("end");
        req.emit("close");
      });
      return req;
    };
    require("./index");
    const {Client}=require("pg");
    const client=new Client({connectionString:process.env.DATABASE_URL});
    (async()=>{
      await client.connect();
      for(let i=0;i<100;i++){
        const {rows} = await client.query(
          "SELECT completed_at, last_error, next_retry_at = 'infinity'::timestamptz AS parked FROM fcs_message_inbox WHERE message_id=$1",[id]);
        if(rows[0]?.parked || rows[0]?.completed_at) {
          console.log(JSON.stringify(rows[0]));
          process.exit(0);
        }
        await require("node:timers/promises").setTimeout(25);
      }
      throw Error("Recovery did not reach a final state");
    })().catch(error=>{console.error(error);process.exit(1)});
  `;
  const options = { cwd: path.resolve(__dirname, ".."), timeout: 8000, env: {
    ...process.env, PORT: "0", PHONE_NUMBER_ID: "123", WHATSAPP_TOKEN: "test",
    META_APP_SECRET: "test", GOOGLE_SERVICE_ACCOUNT: "{}", OPENAI_API_KEY: "test",
    RENDER_EXTERNAL_URL: ""
  } };
  try {
    assert.deepEqual(await inbox.claim(id, message), { attempt: 1 });
    await expire();
    await assert.rejects(run(process.execPath, ["-e", script, sends, "crash", id], options),
      error => error.code === 73);
    await expire();
    const recovery = await run(process.execPath, ["-e", script, sends, "recover", id], options);
    assert.match(recovery.stdout, /"parked":true/);
    assert.deepEqual(await inbox.claim(id, message), { retry: false });
    assert.equal((await fs.readFile(sends, "utf8")).trim().split("\n").length, 1);

    const next = "wamid.restart-unsent";
    await inbox.claim(next, { ...message, id: next });
    await client.query("UPDATE fcs_message_inbox SET lease_until=now()-interval '1 second' WHERE message_id=$1", [next]);
    const unsent = await run(process.execPath, ["-e", script, sends, "recover", next], options);
    assert.match(unsent.stdout, /"completed_at":"[^"]+"/);
    assert.equal((await fs.readFile(sends, "utf8")).trim().split("\n").length, 2);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
