"use strict";

/** Role-aware navigation and server-side authorization primitives.
 * This module does not grant API access by itself: every protected route
 * must call canAccess before returning data or performing an action.
 */
const ROLE_FEATURES = Object.freeze({
  admin: ["network","branches","franchises","communicators","calling","messaging","attachments","campaigns","callLogs","messageLogs","customers","subscriptions","staff","territories","reports","costs","audit","backups"],
  business_center: ["franchises","communicators","calling","messaging","attachments","callLogs","messageLogs","customers","staff","territories","reports","subscriptionStatus"],
  franchise: ["communicators","calling","messaging","attachments","callLogs","messageLogs","customers","staff","territories","reports","subscriptionStatus"],
  communicator: ["calling","messaging","attachments","callLogs","messageLogs","customers","territories","reports"]
});
const ALL_FEATURES = Object.freeze([...new Set(Object.values(ROLE_FEATURES).flat())]);
function normalizeRole(role) {
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "business_center" || role === "business-center") return "business_center";
  if (role === "franchise") return "franchise";
  if (["communicator","head_office_communicator","freelance_communicator","work_from_home_communicator","staff"].includes(role)) return "communicator";
  return null;
}
function dashboardFeatures(identity, subscription = {}) {
  const role = normalizeRole(identity?.role);
  if (!role) return [];
  const active = role === "admin" || (subscription.active === true && (!subscription.expiresAt || Date.parse(subscription.expiresAt) > Date.now()));
  return ROLE_FEATURES[role].map(id => ({ id, visible: true, locked: !active }));
}
function canAccess(identity, feature, subscription) {
  return dashboardFeatures(identity, subscription).some(item => item.id === feature && !item.locked);
}
/** Explicit reporting hierarchy, including direct-to-head-office franchises. */
function withinScope(actor, record) {
  if (!actor || !record) return false;
  const role = normalizeRole(actor.role);
  if (role === "admin") return true;
  if (role === "business_center") {
    // Only records explicitly linked to this Business Center are visible.
    // A franchise communicator must carry its parent Business Center ID
    // (resolved by the trusted backend, never accepted from client input).
    return Boolean(actor.branchId && (record.businessCenterId === actor.branchId || (record.branchId === actor.branchId && record.type !== "franchise_communicator")));
  }
  if (role === "franchise") return Boolean(actor.branchId && (record.franchiseId === actor.branchId || record.branchId === actor.branchId));
  if (role === "communicator") return Boolean(actor.id && (record.communicatorId === actor.id || record.id === actor.id));
  return false;
}
/** Trusted customer ownership: missing or conflicting assignments fail closed.
 * Assignment IDs must come from authenticated server-side records.
 */
function canAccessCustomer(actor, customer) {
  if (!actor || !customer || typeof customer !== "object") return false;
  const role = normalizeRole(actor.role);
  if (!role) return false;
  if (role === "admin") return true;
  if (role === "communicator") {
    return Boolean(actor.id && customer.communicatorId === actor.id);
  }
  if (role === "franchise") {
    return Boolean(actor.branchId && customer.franchiseId === actor.branchId);
  }
  if (role === "business_center") {
    return Boolean(actor.branchId && customer.businessCenterId === actor.branchId);
  }
  return false;
}
function filterAuthorizedCustomers(actor, customers) {
  return Array.isArray(customers) ? customers.filter(customer => canAccessCustomer(actor, customer)) : [];
}
/** Territory matching never grants customer ownership by itself. */
function inAssignedTerritory(actor, customer) {
  if (!actor || !customer || !Array.isArray(actor.territories)) return false;
  const norm = value => typeof value === "string" ? value.trim().toLocaleLowerCase("en") : "";
  const province = norm(customer.province);
  const city = norm(customer.city);
  const area = norm(customer.area);
  if (!province || !city) return false;
  return normalizeTerritories(actor.territories).some(t =>
    norm(t.province) === province && norm(t.city) === city &&
    (!t.area || (area && norm(t.area) === area)));
}
function canMessageCustomer(actor, customer, subscription) {
  if (!canAccess(actor, "messaging", subscription)) return false;
  if (!canAccessCustomer(actor, customer)) return false;
  if (normalizeRole(actor.role) === "communicator") return inAssignedTerritory(actor, customer);
  return true;
}
function normalizeTerritories(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(t => t && typeof t === "object" && typeof t.province === "string" && typeof t.city === "string")
    .map(t => ({ province: t.province.trim(), city: t.city.trim(), area: typeof t.area === "string" ? t.area.trim() : "" }))
    .filter(t => t.province && t.city);
}
module.exports = { ALL_FEATURES, ROLE_FEATURES, normalizeRole, dashboardFeatures, canAccess, withinScope, normalizeTerritories, canAccessCustomer, filterAuthorizedCustomers, inAssignedTerritory, canMessageCustomer };
