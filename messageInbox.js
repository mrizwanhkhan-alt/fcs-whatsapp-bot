"use strict";
// Durable message claims with bounded retry and expiring worker leases.
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
  })().catch(e=>{ready=null;throw e;});
  await ready;
}
async function claim(id) {
  if (!id) throw new Error("Missing Meta message ID");
  await setup();
  const {rows} = await pool.query(`INSERT INTO fcs_message_inbox(message_id,lease_until,attempts)
    VALUES ($1,now()+interval '5 minutes',1)
    ON CONFLICT(message_id) DO UPDATE SET
      claimed_at=now(), lease_until=now()+interval '5 minutes',
      attempts=fcs_message_inbox.attempts+1
    WHERE fcs_message_inbox.completed_at IS NULL
      AND (fcs_message_inbox.lease_until IS NULL OR fcs_message_inbox.lease_until < now())
      AND (fcs_message_inbox.next_retry_at IS NULL OR fcs_message_inbox.next_retry_at <= now())
      AND fcs_message_inbox.attempts < 10
    RETURNING message_id,attempts`,[String(id)]);
  return rows.length===1;
}
async function complete(id) {
  await setup();
  await pool.query(`UPDATE fcs_message_inbox SET completed_at=now(),lease_until=NULL,
    next_retry_at=NULL,last_error=NULL WHERE message_id=$1 AND completed_at IS NULL`,[String(id)]);
}
async function fail(id,error) {
  await setup();
  await pool.query(`UPDATE fcs_message_inbox SET lease_until=NULL,
    next_retry_at=now()+interval '30 seconds',last_error=$2
    WHERE message_id=$1 AND completed_at IS NULL`,[String(id),String(error?.message||error)]);
}
module.exports={enabled:!!pool,claim,complete,fail};
