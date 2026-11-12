"use strict";
// Transactional event inbox and replay cursor. Requires PostgreSQL DATABASE_URL.
// Unique event keys and FOR UPDATE SKIP LOCKED work across Render instances.
const { Pool } = require("pg");
const crypto = require("node:crypto");
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "disable" ? false : {rejectUnauthorized: true},
  max: 5
}) : null;
// Idle connection failures must not terminate the Node process.
if (pool) pool.on("error", error => console.error("PostgreSQL idle connection error:", error.message));
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k,canonical(v[k])]));
  return v;
}
function keyFor(event) {
  return crypto.createHash("sha256").update(JSON.stringify(canonical(event))).digest("hex");
}
let ready;
async function setup() {
  if (!pool) throw new Error("DATABASE_URL is required for transactional call journal");
  if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS fcs_call_events (
    event_key text PRIMARY KEY, call_id text NOT NULL, payload jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0, last_error text, quarantined_at timestamptz
  )`).catch(e => {ready=null;throw e;});
  await ready;
  await pool.query("ALTER TABLE fcs_call_events ADD COLUMN IF NOT EXISTS last_error text");
  await pool.query("ALTER TABLE fcs_call_events ADD COLUMN IF NOT EXISTS quarantined_at timestamptz");
}
async function save(events) {
  if (!events.length) return;
  await setup();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const event of events) {
      await client.query(`INSERT INTO fcs_call_events(event_key,call_id,payload)
        VALUES ($1,$2,$3::jsonb) ON CONFLICT (event_key) DO NOTHING`,
        [keyFor(event),String(event.id),JSON.stringify(event)]);
    }
    await client.query("COMMIT");
  } catch(e) {await client.query("ROLLBACK");throw e;}
  finally {client.release();}
}
async function replay(handler, limit = 100) {
  await setup();
  const {rows} = await pool.query(`SELECT event_key FROM fcs_call_events
    WHERE processed_at IS NULL AND quarantined_at IS NULL
    ORDER BY received_at,event_key LIMIT $1`,[limit]);
  let processed=0;
  for (const candidate of rows) {
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const locked=await client.query(`SELECT event_key,payload,attempts FROM fcs_call_events
        WHERE event_key=$1 AND processed_at IS NULL AND quarantined_at IS NULL
        FOR UPDATE SKIP LOCKED`,[candidate.event_key]);
      if (!locked.rows.length) {await client.query("COMMIT");continue;}
      const row=locked.rows[0];
      try {
        await handler(row.payload);
        await client.query("UPDATE fcs_call_events SET processed_at=now(),attempts=attempts+1,last_error=NULL WHERE event_key=$1",[row.event_key]);
        processed++;
      } catch(error) {
        const attempts=Number(row.attempts)+1;
        await client.query(`UPDATE fcs_call_events SET attempts=$2,last_error=$3,
          quarantined_at=CASE WHEN $2 >= 5 THEN now() ELSE NULL END WHERE event_key=$1`,
          [row.event_key,attempts,String(error.message).slice(0,500)]);
        console.error("Call event replay failed:",row.event_key,error.message);
      }
      await client.query("COMMIT");
    } catch(error) {
      await client.query("ROLLBACK").catch(()=>{});
      throw error;
    } finally {client.release();}
  }
  return processed;
}
module.exports={enabled:!!pool,save,replay,keyFor};
