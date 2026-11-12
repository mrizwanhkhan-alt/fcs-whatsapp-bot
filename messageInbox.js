"use strict";
// Durable message claims with expiring worker leases. Never silently discard an unfinished message after a fixed retry count.
const { Pool } = require("pg");
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "disable" ? false : {rejectUnauthorized:true}, max:3
}) : null;
if (pool) pool.on("error", e => console.error("Message inbox PostgreSQL error:",e.message));
let ready;
async function setup() {
  if (!pool) throw new Error("DATABASE_URL required for durable message claims");
  if (!ready) ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS fcs_message_inbox (
      message_id text PRIMARY KEY, claimed_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz, last_error text
    )`);
    await pool.query("ALTER TABLE fcs_message_inbox ADD COLUMN IF NOT EXISTS lease_until timestamptz");
    await pool.query("ALTER TABLE fcs_message_inbox ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0");
    await pool.query("ALTER TABLE fcs_message_inbox ADD COLUMN IF NOT EXISTS next_retry_at timestamptz");
    await pool.query("ALTER TABLE fcs_message_inbox ADD COLUMN IF NOT EXISTS payload jsonb");
  })().catch(e=>{ready=null;throw e;});
  await ready;
}
async function claim(id, payload) {
  if (!id) throw new Error("Missing Meta message ID");
  await setup();
  const {rows} = await pool.query(`INSERT INTO fcs_message_inbox(message_id,lease_until,attempts,payload)
    VALUES ($1,now()+interval '5 minutes',1,$2::jsonb)
    ON CONFLICT(message_id) DO UPDATE SET
      claimed_at=now(), lease_until=now()+interval '5 minutes',
      payload=COALESCE(fcs_message_inbox.payload, EXCLUDED.payload),
      attempts=fcs_message_inbox.attempts+1
    WHERE fcs_message_inbox.completed_at IS NULL
      AND (fcs_message_inbox.lease_until IS NULL OR fcs_message_inbox.lease_until < now())
      AND (fcs_message_inbox.next_retry_at IS NULL OR fcs_message_inbox.next_retry_at <= now())

    RETURNING message_id,attempts`,[String(id),JSON.stringify(payload || null)]);
  if (rows.length) return { attempt: rows[0].attempts };
  const result = await pool.query(
    "SELECT completed_at, attempts FROM fcs_message_inbox WHERE message_id = $1", [String(id)]);
  const existing = result.rows[0];
  return { retry: !existing?.completed_at };
}
async function complete(id, attempt) {
  await setup();
  const result = await pool.query(`UPDATE fcs_message_inbox SET completed_at=now(),lease_until=NULL,
    next_retry_at=NULL,last_error=NULL WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL`,
    [String(id), attempt]);
  return result.rowCount === 1;
}
async function fail(id, attempt, error) {
  await setup();
  const result = await pool.query(`UPDATE fcs_message_inbox SET lease_until=NULL,
    next_retry_at=now()+interval '30 seconds',last_error=$3
    WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL`,
    [String(id), attempt, String(error?.message || error).slice(0, 500)]);
  return result.rowCount === 1;
}
async function pending(limit=30) {
  await setup();
  const {rows}=await pool.query(`SELECT message_id,payload FROM fcs_message_inbox
    WHERE completed_at IS NULL AND payload IS NOT NULL
    AND (lease_until IS NULL OR lease_until < now())
    AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY claimed_at LIMIT $1`,[limit]);
  return rows;
}
module.exports = { enabled: !!pool, claim, complete, fail, pending };
