"use strict";

const byId = id => document.getElementById(id);
const loginForm = byId("loginForm");
const compose = byId("composeForm");
const password = byId("password");
const number = byId("number");
const type = byId("type");
const message = byId("message");
const template = byId("template");
const templateFields = byId("templateFields");
const file = byId("file");
const caption = byId("caption");
const consent = byId("consent");
const pageStatus = byId("status");
const windowStatus = byId("windowStatus");
const logout = byId("logout");
let csrf;
let staffLoginMode = false;
let templates = [];
let deliveryPoll = 0;

async function watchDelivery(id) {
  const poll = ++deliveryPoll;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (poll !== deliveryPoll || !csrf) return;
    try {
      const result = await request(`delivery?id=${encodeURIComponent(id)}`);
      if (poll !== deliveryPoll) return;
      const suffix = result.errorCode ? ` (Meta error ${result.errorCode})` : "";
      feedback(`WhatsApp status: ${result.status}${suffix}`, result.status === "failed");
      if (["delivered", "read", "failed"].includes(result.status)) return;
    } catch {
      if (poll === deliveryPoll) feedback("Delivery status unavailable; check Meta logs before retrying.", true);
      return;
    }
  }
  if (poll === deliveryPoll) feedback("Delivery not confirmed yet. Check Meta logs before retrying.", true);
}


function feedback(text = "", error = false, element = pageStatus) {
  element.textContent = text;
  element.dataset.error = String(error);
}

async function request(path, payload, attachment) {
  const options = { cache: "no-store", credentials: "same-origin" };
  if (payload) {
    options.method = "POST";
    options.headers = {
      "X-Admin-Request": (path === "login" || path === "staff-login") ? "login" : csrf,
      "Content-Type": attachment ? "application/octet-stream" : "application/json"
    };
    const json = JSON.stringify(payload);
    options.body = json;
    if (attachment) {
      const metadata = new TextEncoder().encode(json);
      options.headers["X-Admin-Metadata-Length"] = String(metadata.length);
      options.body = new Blob([metadata, attachment]);
    }
  }
  const response = await fetch(`/admin/${path}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && path !== "login") showSession({ signedIn: false });
    throw new Error(result.error || "Request failed. Try again.");
  }
  return result;
}

const callingFrame = byId("callingFrame");
const callingLink = byId("callingLink");
let callingSizeObserver;
let callingStatusObserver;

function showCallingAlert(incoming) {
  callingLink.dataset.incoming = String(incoming);
  callingLink.textContent = incoming ? "Incoming call" : "Calling";
}

callingFrame.addEventListener("load", () => {
  callingSizeObserver?.disconnect();
  callingStatusObserver?.disconnect();
  const panel = callingFrame.contentDocument?.querySelector(".panel");
  const incoming = callingFrame.contentDocument?.getElementById("incoming");
  if (!panel || !incoming) return;

  callingSizeObserver = new ResizeObserver(() => {
    callingFrame.style.height = `${Math.ceil(panel.getBoundingClientRect().bottom + 32)}px`;
  });
  callingSizeObserver.observe(panel);
  callingStatusObserver = new MutationObserver(() => showCallingAlert(!incoming.hidden));
  callingStatusObserver.observe(incoming, { attributes: true, attributeFilter: ["hidden"] });
  showCallingAlert(!incoming.hidden);
});

function showSession(session) {
  deliveryPoll++;
  csrf = session.csrf;
  templates = session.templates || [];
  const isAdmin = Boolean(session.signedIn && (!session.role || session.role === "super_admin"));
  byId("loginPanel").hidden = session.signedIn || staffLoginMode;
  byId("staffLoginPanel").hidden = session.signedIn || !staffLoginMode;
  const roleInfo = {
    business_center: ["City Business Center Dashboard", "Manage visibility of applications, customers and reports for your assigned city or cities.", "Business Center Customer Search", "Business Center City Report", "Business Center Applications"],
    franchise: ["Franchise Dashboard", "View franchise applications and customers only within your assigned city or cities.", "Franchise Customer Search", "Franchise City Report", "Franchise Applications"],
    communicator: ["Communicator Dashboard", "Search assigned customers and review follow-up stages. Messaging and calling require separate authorization.", "Customer Follow-up Search", "Customer Follow-up Report", "Assigned Applications"]
  };
  const info = roleInfo[session.role] || ["Staff Workspace", "Read-only territory access.", "Territory Customer Search", "Territory Report", "Territory Applications"];
  byId("staffWorkspaceTitle").textContent = info[0];
  byId("staffWorkspaceDescription").textContent = info[1];
  byId("staffCustomerTitle").textContent = info[2];
  byId("staffReportTitle").textContent = info[3];
  byId("staffApplicationsTitle").textContent = info[4];
  byId("staffHome").hidden = !session.signedIn || isAdmin;
  for (const id of ["staffCustomerPanel", "staffReportsPanel", "staffApplicationsPanel"]) byId(id).hidden = !session.signedIn || isAdmin;
  byId("territoryLabel").textContent = session.territory ? `Assigned territory: ${session.territory.province} — ${session.territory.cities.join(", ")}` : "";
  byId("staffGreeting").textContent = session.signedIn && !isAdmin
    ? `Signed in as ${session.staffId || "staff"} (${String(session.role).replaceAll("_", " ")})`
    : "";
  byId("composePanel").hidden = !isAdmin;
  byId("roleOverview").hidden = !isAdmin;
  logout.hidden = !session.signedIn;
  byId("workspaceNav").hidden = !isAdmin;
  byId("callingPanel").hidden = !isAdmin;
  byId("reportsPanel").hidden = !isAdmin;
  byId("customerPanel").hidden = !isAdmin;
  byId("applicationsPanel").hidden = !isAdmin;
  if (!session.signedIn) { byId("customerResult").replaceChildren(); byId("customerStatus").textContent = ""; }
  if (isAdmin) { void loadProvinceCityReport(); void loadApplications(); }
  if (session.signedIn && !isAdmin) { void loadStaffReport(); void loadStaffApplications(); }
  else byId("reportResults").replaceChildren();
  if (isAdmin && !callingFrame.hasAttribute("src")) {
    callingFrame.src = "/admin/calling-panel";
  } else if (!isAdmin) {
    callingFrame.removeAttribute("src");
    showCallingAlert(false);
  }
  password.value = "";
  template.replaceChildren(new Option(
    templates.length ? "Choose a template" : "No approved templates configured", ""
  ));
  for (const item of templates) template.add(new Option(`${item.name} (${item.language})`, item.key));
  compose.reset();
  feedback("", false, windowStatus);
  updateFields();
}

function updateFields() {
  const isTemplate = type.value === "template";
  const isMedia = type.value === "media";
  const choice = templates.find(item => item.key === template.value);
  const fileType = isMedia ? "attachment" : isTemplate ? choice?.header : "";
  byId("textField").hidden = isTemplate || isMedia;
  byId("templateField").hidden = !isTemplate;
  templateFields.hidden = !isTemplate;
  byId("captionField").hidden = !isMedia;
  byId("consentField").hidden = !isTemplate;
  byId("fileField").hidden = !fileType;
  message.required = !isTemplate && !isMedia;
  template.required = isTemplate;
  consent.required = isTemplate;
  file.required = Boolean(fileType);
  file.value = "";
  file.accept = {
    image: ".jpg,.jpeg,.png",
    document: ".pdf",
    attachment: ".jpg,.jpeg,.png,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
  }[fileType] || "";
  byId("fileHint").textContent = {
    image: "JPG or PNG, up to 5 MB.",
    document: "PDF, up to 20 MB.",
    attachment: "JPG or PNG up to 5 MB. PDF, TXT, Word, Excel or PowerPoint up to 20 MB."
  }[fileType] || "";

  templateFields.replaceChildren();
  if (!isTemplate || !choice) return;
  for (let index = 0; index < choice.bodyParameters; index++) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    label.textContent = `Template field ${index + 1}`;
    input.required = true;
    input.maxLength = 1024;
    label.append(input);
    templateFields.append(label);
  }
}

async function run(button, action, errorElement = pageStatus) {
  button.disabled = true;
  feedback("", false, errorElement);
  try {
    await action();
  } catch (error) {
    feedback(error.message, true, csrf ? errorElement : pageStatus);
  } finally {
    button.disabled = false;
  }
}

byId("showStaffLogin").addEventListener("click", () => {
  staffLoginMode = true;
  byId("loginPanel").hidden = true;
  byId("staffLoginPanel").hidden = false;
  byId("staffId").focus();
});
byId("showAdminLogin").addEventListener("click", () => {
  staffLoginMode = false;
  byId("staffLoginPanel").hidden = true;
  byId("loginPanel").hidden = false;
  password.focus();
});
byId("staffLoginForm").addEventListener("submit", event => {
  event.preventDefault();
  run(event.submitter, async () => {
    const payload = { id: byId("staffId").value.trim(), password: byId("staffPassword").value };
    byId("staffPassword").value = "";
    await request("staff-login", payload);
    showSession(await request("session"));
  });
});

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  run(event.submitter, async () => {
    const payload = { password: password.value };
    password.value = "";
    await request("login", payload);
    showSession(await request("session"));
    number.focus();
  });
});

logout.addEventListener("click", () => run(logout, async () => {
  showSession(await request("logout", {}));
  password.focus();
}));

type.addEventListener("change", updateFields);
template.addEventListener("change", updateFields);
number.addEventListener("input", () => feedback("", false, windowStatus));

const checkWindow = byId("checkWindow");
checkWindow.addEventListener("click", () => {
  if (!number.reportValidity()) return;
  run(checkWindow, async () => {
    const checkedNumber = number.value;
    const result = await request("window", { number: checkedNumber });
    if (number.value !== checkedNumber) return;
    feedback(result.expires
      ? `Window open until ${new Date(result.expires).toLocaleString()} (your time).`
      : "No verified window. Use an approved template or wait for a customer reply.", false, windowStatus);
  }, windowStatus);
});

compose.addEventListener("submit", event => {
  event.preventDefault();
  run(event.submitter, async () => {
    const payload = { number: number.value, type: type.value };
    const selectedFile = file.required ? file.files[0] : null;
    if (selectedFile) {
      const limit = /\.(jpe?g|png)$/i.test(selectedFile.name) ? 5 : 20;
      if (!selectedFile.size || selectedFile.size > limit * 1024 * 1024) {
        throw new Error(`Select a nonempty file up to ${limit} MB.`);
      }
      payload.filename = selectedFile.name;
    }
    if (type.value === "text") payload.text = message.value;
    if (type.value === "media") payload.caption = caption.value;
    if (type.value === "template") {
      payload.template = template.value;
      payload.optIn = consent.checked;
      payload.parameters = Array.from(templateFields.querySelectorAll("input"), input => input.value);
    }
    const fields = Array.from(compose.elements).filter(element => element !== event.submitter && !element.disabled);
    fields.forEach(element => { element.disabled = true; });
    try {
      const sent = await request("send", payload, selectedFile);
      message.value = "";
      caption.value = "";
      consent.checked = false;
      updateFields();
      feedback("WhatsApp accepted the message; checking delivery status...");
      if (sent.messageId) void watchDelivery(sent.messageId);
    } finally {
      fields.forEach(element => { element.disabled = false; });
    }
  });
});

async function loadProvinceCityReport() {
  const status = byId("reportStatus");
  const root = byId("reportResults");
  status.textContent = "Loading city report…";
  try {
    const result = await request("province-city-report");
    if (!csrf) return;
    root.replaceChildren();
    for (const province of result.provinces || []) {
      const outer = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${province.province} — ${province.total} applications, ${province.cities.length} cities`;
      outer.append(summary);
      for (const city of province.cities) {
        const inner = document.createElement("details");
        const heading = document.createElement("summary");
        heading.textContent = `${city.city} — ${city.total} applications`;
        inner.append(heading);
        for (const [stage, count] of Object.entries(city.stages)) {
          const line = document.createElement("p");
          line.textContent = `${stage}: ${count}`;
          inner.append(line);
        }
        outer.append(inner);
      }
      root.append(outer);
    }
    status.textContent = `Updated ${new Date(result.updatedAt).toLocaleString()} — ${(result.provinces || []).length} provinces/regions`;
  } catch (error) {
    status.textContent = `Report unavailable: ${error.message}`;
  }
}
byId("refreshReport").addEventListener("click", loadProvinceCityReport);

async function loadApplications() {
  const status = byId("applicationsStatus");
  const root = byId("applicationsResults");
  status.textContent = "Loading application records…";
  try {
    const result = await request("application-records");
    if (!csrf) return;
    root.replaceChildren();
    for (const record of result.records || []) {
      const line = document.createElement("p");
      line.textContent = `Row ${record.rowNumber} — ${record.province || "Unspecified"} / ${record.city || "Unspecified"} — ${record.stage}`;
      root.append(line);
    }
    status.textContent = `Showing ${(result.records || []).length} of ${result.total} application records.`;
  } catch (error) {
    status.textContent = "Applications unavailable: " + error.message;
  }
}
byId("refreshApplications").addEventListener("click", loadApplications);

byId("customerForm").addEventListener("submit", event => {
  event.preventDefault();
  const button = event.submitter;
  run(button, async () => {
    const phone = byId("customerPhone").value.trim();
    const result = await request("customer-lookup?phone=" + encodeURIComponent(phone));
    const root = byId("customerResult");
    root.replaceChildren();
    if (phone !== byId("customerPhone").value.trim()) return;
    if (!result.found) {
      feedback("No matching customer application found.", false, byId("customerStatus"));
      return;
    }
    feedback("Matching application found.", false, byId("customerStatus"));
    for (const [label, value] of [
      ["Sheet row", result.customer.rowNumber],
      ["Province", result.customer.province],
      ["City", result.customer.city],
      ["Engagement stage", result.customer.engagementStage],
      ["Last engagement", result.customer.lastEngagement],
      ["Next follow-up", result.customer.nextFollowUp]
    ]) {
      const line = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      line.append(strong, document.createTextNode(String(value || "—")));
      root.append(line);
    }
  }, byId("customerStatus"));
});

async function loadStaffReport() {
  const root = byId("staffReportResults");
  const status = byId("staffReportStatus");
  root.replaceChildren();
  try {
    const data = await request("province-city-report");
    for (const province of data.provinces || []) {
      for (const city of province.cities || []) {
        const p = document.createElement("p");
        p.textContent = `${province.province} / ${city.city}: ${city.total} applications`;
        root.append(p);
      }
    }
    status.textContent = "Territory report loaded.";
  } catch (error) { status.textContent = error.message; }
}
async function loadStaffApplications() {
  const root = byId("staffApplicationsResults");
  const status = byId("staffApplicationsStatus");
  root.replaceChildren();
  try {
    const data = await request("application-records");
    for (const record of data.records || []) {
      const p = document.createElement("p");
      p.textContent = `Row ${record.rowNumber}: ${record.province} / ${record.city} — ${record.stage}`;
      root.append(p);
    }
    status.textContent = `Showing ${data.records.length} of ${data.total} territory applications.`;
  } catch (error) { status.textContent = error.message; }
}
byId("staffRefreshReport").addEventListener("click", loadStaffReport);
byId("staffRefreshApplications").addEventListener("click", loadStaffApplications);
byId("staffCustomerForm").addEventListener("submit", event => {
  event.preventDefault();
  run(event.submitter, async () => {
    const data = await request("customer-lookup?phone=" + encodeURIComponent(byId("staffCustomerPhone").value.trim()));
    const root = byId("staffCustomerResults");
    root.replaceChildren();
    const status = byId("staffCustomerStatus");
    status.textContent = data.found ? "Customer found in assigned territory." : "No customer found in assigned territory.";
    if (data.found) for (const [key, value] of Object.entries(data.customer)) {
      const p = document.createElement("p");
      p.textContent = `${key}: ${value || "—"}`;
      root.append(p);
    }
  }, byId("staffCustomerStatus"));
});

function highlightNavigation() {
  for (const link of byId("workspaceNav").querySelectorAll('a[href^="#"]')) {
    if (link.getAttribute("href") === location.hash) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", highlightNavigation);
highlightNavigation();

request("session").then(session => {
  showSession(session);
  feedback();
}).catch(() => feedback("The dashboard could not load. Refresh to try again.", true));
