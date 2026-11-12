"use strict";

// Server-side territory matching. Missing or malformed scope grants no access.
function norm(value) {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}
function territoryOf(entry) {
  if (!entry || !entry.territory || typeof entry.territory !== "object" ||
      Array.isArray(entry.territory)) return null;
  const { province, cities } = entry.territory;
  if (typeof province !== "string" || !norm(province) || province.length > 100 ||
      !Array.isArray(cities) || !cities.length || cities.length > 100 ||
      cities.some(city => typeof city !== "string" || !norm(city) || city.length > 100)) return null;
  return { province: province.trim(), cities: [...new Set(cities.map(city => city.trim()))] };
}
function allowed(row, territory) {
  return Boolean(territory && Array.isArray(row) &&
    norm(row[8]) === norm(territory.province) &&
    territory.cities.some(city => norm(city) === norm(row[9])));
}
function filterRows(rows, territory) {
  if (!Array.isArray(rows)) throw new TypeError("Expected spreadsheet rows");
  return [rows[0] || [], ...rows.slice(1).filter(row => allowed(row, territory))];
}
module.exports = { territoryOf, filterRows };
