"use strict";
// Durable Meta message claims across workers/restarts. PostgreSQL required.
const { Pool } = require("pg");
const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: true },
  max: 3
}) : null;
if (pool) pool.on("error", e => console.error("Message inbox PostgreSQL error:", e.message));
let ready;
async function setup() {
  if (!pool) throw new Error("DATABASE_URL required for durable message claims");
  if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS fcs_message_inbox (
    message_id text PRIMARY KEY, claimed_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz, last_error text
  )`).catch(e => { ready = null; throw e; });
  await ready;
}
async function claim(id) {
  if (!id) throw new Error("Missing Meta message ID");
  await setup();
  const {rowCount} = await pool.query(`INSERT INTO fcs_message_inbox(message_id)
    VALUES ($1) ON CONFLICT DO NOTHING`,[String(id)]);
  return rowCount === 1;
}
async function complete(id) {
  await pool.query("UPDATE fcs_message_inbox SET completed_at=now(),last_error=NULL WHERE message_id=$1",[String(id)]);
}
async function fail(id,error) {
  await pool.query("UPDATE fcs_message_inbox SET last_error=$2 WHERE message_id=$1",[String(id),String(error?.message||error)]);
}
module.exports={enabled:!!pool,claim,complete,fail};
