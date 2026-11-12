"use strict";

// Read-only customer lookup for Franchise_Applications (A:T).
// Phone: F (index 5); province: I (8); city: J (9); stage: R (17).
function digits(value) { return String(value ?? "").replace(/\D/g, ""); }
function variants(value) {
  const n = digits(value);
  if (!n) return [];
  const set = new Set([n]);
  if (n.startsWith("0092")) set.add(n.slice(2));
  if (n.startsWith("92") && n.length === 12) set.add("0" + n.slice(2));
  if (n.startsWith("0") && n.length === 11) set.add("92" + n.slice(1));
  return [...set];
}
function findCustomer(rows, phone) {
  if (!Array.isArray(rows)) throw new TypeError("Expected application rows");
  const target = new Set(variants(phone));
  if (!target.size) return null;
  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    if (variants(row[5]).some(n => target.has(n))) {
      return {
        rowNumber: i + 1,
        province: String(row[8] ?? "").trim(),
        city: String(row[9] ?? "").trim(),
        engagementStage: String(row[17] ?? "").trim() || "Not contacted",
        lastEngagement: String(row[18] ?? "").trim(),
        nextFollowUp: String(row[19] ?? "").trim()
      };
    }
  }
  return null;
}
module.exports = { findCustomer };
