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
  if (!ready) ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS fcs_call_events (
      event_key text PRIMARY KEY, call_id text NOT NULL, payload jsonb NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
      attempts integer NOT NULL DEFAULT 0, last_error text, quarantined_at timestamptz, next_retry_at timestamptz
    )`);
    await pool.query("ALTER TABLE fcs_call_events ADD COLUMN IF NOT EXISTS last_error text");
    await pool.query("ALTER TABLE fcs_call_events ADD COLUMN IF NOT EXISTS quarantined_at timestamptz");
    await pool.query("ALTER TABLE fcs_call_events ADD COLUMN IF NOT EXISTS next_retry_at timestamptz");
  })().catch(error => { ready = null; throw error; });
  await ready;
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
    // New caller metadata can unblock an earlier quarantined termination.
    const ids = [...new Set(events.filter(e => e.from || e.from_user_id).map(e => String(e.id)))];
    if (ids.length) await client.query(`UPDATE fcs_call_events SET quarantined_at=NULL,attempts=0,next_retry_at=NULL
      WHERE call_id=ANY($1::text[]) AND processed_at IS NULL AND quarantined_at IS NOT NULL`,[ids]);
    await client.query("COMMIT");
  } catch(e) {await client.query("ROLLBACK");throw e;}
  finally {client.release();}
}
async function replay(handler, limit = 100) {
  await setup();
  const {rows} = await pool.query(`SELECT event_key FROM fcs_call_events
    WHERE processed_at IS NULL AND quarantined_at IS NULL AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY CASE
      WHEN payload->>'event'='connect' AND payload->'session'->>'sdp_type'='offer' THEN 0
      WHEN payload->>'status'='ACCEPTED' THEN 1
      WHEN payload->>'event'='terminate' OR payload->>'status' IN ('REJECTED','FAILED') THEN 3
      ELSE 2 END,received_at,event_key LIMIT $1`,[limit]);
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
        await client.query("UPDATE fcs_call_events SET processed_at=now(),attempts=attempts+1,last_error=NULL,next_retry_at=NULL WHERE event_key=$1",[row.event_key]);
        processed++;
      } catch(error) {
        const attempts=Number(row.attempts)+1;
        await client.query(`UPDATE fcs_call_events SET attempts=$2,last_error=$3,
          quarantined_at=CASE WHEN $2 >= 5 THEN now() ELSE NULL END,
          next_retry_at=CASE WHEN $2 >= 5 THEN NULL ELSE now()+make_interval(secs => LEAST(300,POWER(2,$2)::int)) END WHERE event_key=$1`,
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
