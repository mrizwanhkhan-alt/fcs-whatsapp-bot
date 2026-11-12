"use strict";
// Aggregate application engagement stages without changing sheet data.
function customerStatusReport(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Expected spreadsheet rows");
  const stages = new Map();
  let total = 0;
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row) || !row.some(value => String(value ?? "").trim())) continue;
    total++;
    const stage = String(row[17] ?? "").trim() || "Not contacted";
    const key = stage.toLocaleLowerCase("en");
    const existing = stages.get(key);
    if (existing) existing.count++;
    else stages.set(key, { stage, count: 1 });
  }
  return { total, stages: [...stages.values()].sort((a,b) => b.count-a.count || a.stage.localeCompare(b.stage)) };
}
module.exports = { customerStatusReport };
