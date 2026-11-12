"use strict";

// Pure reporting helper: no network calls, writes, or WhatsApp sends.
// Franchise_Applications columns: I=province, J=city, R=engagement stage.
function provinceCityReport(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Expected spreadsheet rows");
  const provinces = new Map();
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row) || !row.some(v => String(v ?? "").trim())) continue;
    const province = String(row[8] ?? "").trim() || "Unspecified";
    const city = String(row[9] ?? "").trim() || "Unspecified";
    const stage = String(row[17] ?? "").trim() || "Not contacted";
    const pk = province.toLocaleLowerCase("en");
    const ck = city.toLocaleLowerCase("en");
    if (!provinces.has(pk)) provinces.set(pk, { name: province, total: 0, cities: new Map() });
    const p = provinces.get(pk);
    if (!p.cities.has(ck)) p.cities.set(ck, { name: city, total: 0, stages: {} });
    const c = p.cities.get(ck);
    p.total++;
    c.total++;
    c.stages[stage] = (c.stages[stage] || 0) + 1;
  }
  return [...provinces.values()].map(p => ({
    province: p.name,
    total: p.total,
    cities: [...p.cities.values()].map(c => ({
      city: c.name, total: c.total, stages: c.stages
    })).sort((a, b) => a.city.localeCompare(b.city))
  })).sort((a, b) => a.province.localeCompare(b.province));
}

module.exports = { provinceCityReport };
