"use strict";
// Rebuild missing history rows from the durable verified webhook inbox.
// This does not restore old live calls to the incoming-call panel.
const { getById, appendEvent } = require("./callHistoryStore");
const { getSavedEvents } = require("./callWebhookInbox");
const terminalStates = new Set(["ended", "rejected", "failed"]);
function stateOf(event) {
  if (event.status === "REJECTED") return "rejected";
  if (event.status === "FAILED") return "failed";
  if (event.event === "terminate") return "ended";
  if (event.status === "ACCEPTED") return "accepted";
  if (event.status === "RINGING") return "ringing";
  if (event.event === "connect" && event.session?.sdp_type === "offer") return "incoming";
  return null;
}
function eventTime(event) {
  const seconds = Number(event.timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}
async function replayPendingHistory() {
  const events = await getSavedEvents();
  const grouped = new Map();
  for (const event of events) {
    if (!event?.id || !stateOf(event)) continue;
    if (!grouped.has(event.id)) grouped.set(event.id, []);
    grouped.get(event.id).push(event);
  }
  for (const [id, entries] of grouped) {
    // Preserve chronological nonterminal transitions, then make termination final.
    entries.sort((a,b) => Number(terminalStates.has(stateOf(a))) - Number(terminalStates.has(stateOf(b))) ||
      (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    let saved = await getById(id);
    // A terminal row is authoritative; never replay older transient states over it.
    if (saved && terminalStates.has(saved.state)) continue;
    for (const event of entries) {
      const state = stateOf(event);
      if (saved && terminalStates.has(saved.state)) break;
      const number = saved?.number || event.from || event.from_user_id;
      if (!number) continue;
      const time = eventTime(event) || saved?.startedAt || new Date().toISOString();
      const entry = {
        id, number, staffId: saved?.staffId || null, owner: saved?.owner || null,
        direction: saved?.direction || (state === "incoming" ? "incoming" : "outgoing"),
        startedAt: saved?.startedAt || time,
        answeredAt: saved?.answeredAt || (state === "accepted" ? time : null),
        endedAt: saved?.endedAt || (terminalStates.has(state) ? time : null),
        state
      };
      await appendEvent(entry);
      saved = entry;
    }
  }
}
module.exports = { replayPendingHistory };
