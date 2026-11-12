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
    await pool.query("ALTER TABLE fcs_message_inbox ADD COLUMN IF NOT EXISTS reply_states jsonb NOT NULL DEFAULT '{}'");
    // Bound the durable recovery payload; attachments remain in Meta storage, not PostgreSQL.
    await pool.query("ALTER TABLE fcs_message_inbox ADD CONSTRAINT fcs_inbox_payload_2kb CHECK (payload IS NULL OR octet_length(payload::text) <= 2048)").catch(error => {
      if (error.code !== "42710") throw error;
    });
  })().catch(e=>{ready=null;throw e;});
  await ready;
}
async function claim(id, payload) {
  if (!id) throw new Error("Missing Meta message ID");
  const serialized = JSON.stringify(payload || null);
  if (Buffer.byteLength(serialized, "utf8") > 2048) {
    const error = new Error("Inbound message recovery metadata exceeds 2 KB; refusing database storage");
    error.code = "INBOX_PAYLOAD_TOO_LARGE";
    throw error;
  }
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

    RETURNING message_id,attempts`,[String(id),serialized]);
  if (rows.length) return { attempt: rows[0].attempts };
  const result = await pool.query(
    "SELECT completed_at, attempts, next_retry_at = 'infinity'::timestamptz AS parked FROM fcs_message_inbox WHERE message_id = $1", [String(id)]);
  const existing = result.rows[0];
  return { retry: !existing?.completed_at && !existing?.parked };
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
    next_retry_at=CASE WHEN $4 THEN 'infinity'::timestamptz ELSE now()+interval '30 seconds' END,last_error=$3
    WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL`,
    [String(id), attempt, String(error?.message || error).slice(0, 500), error?.code === "REPLY_OUTCOME_UNKNOWN"]);
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
function unknownReplyOutcome() {
  const error = new Error("Previous WhatsApp reply outcome is unknown and needs review");
  error.code = "REPLY_OUTCOME_UNKNOWN";
  return error;
}

async function assertRecoverable(id, attempt) {
  await setup();
  const result = await pool.query(`SELECT EXISTS (
      SELECT 1 FROM jsonb_each_text(reply_states) WHERE value='dispatching'
    ) AS uncertain FROM fcs_message_inbox
    WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL AND lease_until > now()`,
    [String(id), attempt]);
  if (!result.rowCount) throw new Error("Message reply lease expired");
  if (result.rows[0].uncertain) throw unknownReplyOutcome();
}

// Store the dispatch intent before contacting Meta. A worker must never
// repeat a reply whose outcome was lost between dispatch and acknowledgement.
async function beginReply(id, attempt, position) {
  await setup();
  const args = [String(id), attempt, String(position)];
  const update = await pool.query(`UPDATE fcs_message_inbox
    SET reply_states=jsonb_set(reply_states,ARRAY[$3::text],'"dispatching"'::jsonb)
    WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL
      AND lease_until > now() AND NOT (reply_states ? $3)
    RETURNING message_id`, args);
  if (update.rowCount) return "dispatching";
  const result = await pool.query(`SELECT reply_states->>$3 AS state FROM fcs_message_inbox
    WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL AND lease_until > now()`, args);
  if (!result.rowCount) throw new Error("Message reply lease expired");
  if (result.rows[0].state === "accepted") return "accepted";
  throw unknownReplyOutcome();
}

async function finishReply(id, attempt, position, accepted) {
  await setup();
  const result = await pool.query(`UPDATE fcs_message_inbox SET reply_states=CASE WHEN $4
    THEN jsonb_set(reply_states,ARRAY[$3::text],'"accepted"'::jsonb)
    ELSE reply_states - $3::text END
    WHERE message_id=$1 AND attempts=$2 AND completed_at IS NULL AND lease_until > now()
      AND reply_states->>$3='dispatching'`, [String(id), attempt, String(position), accepted]);
  if (!result.rowCount) throw new Error("Message reply lease expired");
}

module.exports = { enabled: !!pool, claim, complete, fail, pending, assertRecoverable, beginReply, finishReply };
