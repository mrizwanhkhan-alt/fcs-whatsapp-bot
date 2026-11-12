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
  if (role === "business_center") return Boolean(actor.branchId && (record.businessCenterId === actor.branchId || record.branchId === actor.branchId));
  if (role === "franchise") return Boolean(actor.branchId && (record.franchiseId === actor.branchId || record.branchId === actor.branchId));
  if (role === "communicator") return Boolean(actor.id && (record.communicatorId === actor.id || record.id === actor.id));
  return false;
}
function normalizeTerritories(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(t => t && typeof t === "object" && typeof t.province === "string" && typeof t.city === "string")
    .map(t => ({ province: t.province.trim(), city: t.city.trim(), area: typeof t.area === "string" ? t.area.trim() : "" }))
    .filter(t => t.province && t.city);
}
module.exports = { ALL_FEATURES, ROLE_FEATURES, normalizeRole, dashboardFeatures, canAccess, withinScope, normalizeTerritories };
