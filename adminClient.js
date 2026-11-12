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
      "X-Admin-Request": path === "login" ? "login" : csrf,
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
  byId("loginPanel").hidden = session.signedIn;
  const role = session.identity?.role || "admin";
  const canWrite = session.signedIn && role !== "viewer";
  const isAdmin = session.signedIn && role === "admin";
  byId("composePanel").hidden = !canWrite;
  logout.hidden = !session.signedIn;
  byId("workspaceNav").hidden = !session.signedIn;
  byId("callingPanel").hidden = !session.signedIn;
  byId("reportsPanel").hidden = !session.signedIn;
  byId("statusReportPanel").hidden = !session.signedIn;
  byId("messageActivityPanel").hidden = !session.signedIn;
  byId("engagementPanel").hidden = !canWrite;
  byId("costMonitoringPanel").hidden = !session.signedIn;
  byId("backupPanel").hidden = !isAdmin;
  byId("callingLogsPanel").hidden = !session.signedIn;
  byId("staffIdsPanel").hidden = !isAdmin;
  byId("branchesPanel").hidden = !isAdmin;
  byId("securityAuditPanel").hidden = !isAdmin;
  if (session.signedIn) void loadMessageActivity();
  if (session.signedIn) void loadCustomerStatusReport();
  byId("customerPanel").hidden = !session.signedIn;
  if (session.signedIn) void loadProvinceCityReport();
  else byId("reportResults").replaceChildren();
  if (session.signedIn && !callingFrame.hasAttribute("src")) {
    callingFrame.src = "/admin/calling-panel";
  } else if (!session.signedIn) {
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

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  run(event.submitter, async () => {
    const payload = { password: password.value, staffId: byId("staffId").value.trim() };
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

request("session").then(session => {
  showSession(session);
  feedback();
}).catch(() => feedback("The dashboard could not load. Refresh to try again.", true));

byId("customerLookupForm").addEventListener("submit", async event => {
  event.preventDefault();
  const status = byId("customerLookupStatus");
  const root = byId("customerLookupResult");
  root.replaceChildren();
  status.textContent = "Searching…";
  try {
    const phone = byId("customerPhone").value.trim();
    const result = await request(`customer-lookup?phone=${encodeURIComponent(phone)}`);
    if (!result.customer) { status.textContent = "No matching application found."; return; }
    status.textContent = "Customer application found.";
    for (const [label, value] of Object.entries(result.customer)) {
      const line = document.createElement("p");
      line.textContent = `${label}: ${value || "—"}`;
      root.append(line);
    }
  } catch (error) { status.textContent = `Lookup failed: ${error.message}`; }
});

async function loadCustomerStatusReport() {
 const summary=byId("customerStatusSummary"),root=byId("customerStatusResults");
 summary.textContent="Loading customer statuses…";root.replaceChildren();
 try {const result=await request("customer-status-report");
  summary.textContent=`Total applications: ${result.total} — Updated ${new Date(result.updatedAt).toLocaleString()}`;
  for(const item of result.stages){const line=document.createElement("p");line.textContent=`${item.stage}: ${item.count}`;root.append(line);}
 } catch(error){summary.textContent=`Status report unavailable: ${error.message}`;}
}
byId("refreshStatusReport").addEventListener("click",loadCustomerStatusReport);

async function loadMessageActivity(){
 const status=byId("messageActivityStatus"),root=byId("messageActivityResults");
 status.textContent="Loading recent activity…";root.replaceChildren();
 try {const result=await request("message-activity");
  status.textContent=`${result.messages.length} recent message records`;
  for(const entry of result.messages){const line=document.createElement("p");line.textContent=`${entry.number} — ${entry.status} — ${entry.updatedAt || ""}`;root.append(line);}
 } catch(error){status.textContent=`Activity unavailable: ${error.message}`;}
}
byId("refreshMessageActivity").addEventListener("click",loadMessageActivity);

byId("engagementForm").addEventListener("submit",async event=>{
 event.preventDefault();const status=byId("engagementStatus");status.textContent="Saving…";
 try{const result=await request("customer-engagement",{rowNumber:Number(byId("engagementRow").value),stage:byId("engagementStage").value.trim(),nextDate:byId("engagementDate").value});
 status.textContent=result.saved?"Engagement saved.":"Save not confirmed.";
 if(result.saved){void loadCustomerStatusReport();void loadProvinceCityReport();}
 }catch(error){status.textContent=`Save failed: ${error.message}`;}
});
async function loadSecurityAudit(){
 const status=byId("auditStatus"),root=byId("auditResults");status.textContent="Loading audit…";root.replaceChildren();
 try{const result=await request("security-audit");status.textContent=`${result.events.length} recent audit events`;
 for(const entry of result.events){const p=document.createElement("p");p.textContent=`${entry.at} — ${entry.action} — ${entry.outcome} — ${entry.details}`;root.append(p);}
 }catch(error){status.textContent=`Audit unavailable: ${error.message}`;}
}
byId("refreshAudit").addEventListener("click",loadSecurityAudit);

async function loadCostMonitoring(){
 const status=byId("costMonitoringStatus"),root=byId("costMonitoringResults");status.textContent="Loading usage…";root.replaceChildren();
 try{const data=await request("cost-monitoring");status.textContent=`Tracked messages: ${data.trackedMessages}. Actual Meta charges unavailable.`;
 for(const [name,count] of Object.entries(data.counts)){const p=document.createElement("p");p.textContent=`${name}: ${count}`;root.append(p);}
 const note=document.createElement("p");note.textContent=data.note;root.append(note);
 }catch(error){status.textContent=`Usage unavailable: ${error.message}`;}
}
byId("refreshCostMonitoring").addEventListener("click",loadCostMonitoring);

byId("downloadBackup").addEventListener("click",async()=>{
 const status=byId("backupStatus");status.textContent="Preparing backup…";
 try{const data=await request("backup-export");
  if(data.format!=="FCS-Applications-Backup-v1"||!Array.isArray(data.rows))throw new Error("Invalid backup response");
  const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;
  a.download=`fcs-applications-${new Date().toISOString().slice(0,10)}.json`;
  document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  status.textContent=`Backup prepared: ${data.rows.length} sheet rows. Store securely.`;
 }catch(error){status.textContent=`Backup failed: ${error.message}`;}
});

async function loadCallingLogs(){
 const status=byId("callingLogsStatus"),root=byId("callingLogsResults");status.textContent="Loading calls…";root.replaceChildren();
 try{const data=await request("calling-logs");status.textContent=`${data.calls.length} recent call records`;
 for(const call of data.calls){const p=document.createElement("p");p.textContent=`${call.updatedAt} — ${call.direction} — ${call.number} — ${call.state}`;root.append(p);}
 }catch(error){status.textContent=`Calling logs unavailable: ${error.message}`;}
}
byId("refreshCallingLogs").addEventListener("click",loadCallingLogs);

async function loadStaffIds(){
 const status=byId("staffIdsStatus"),root=byId("staffIdsResults");status.textContent="Loading staff…";root.replaceChildren();
 try{const data=await request("staff-ids");status.textContent=`${data.staff.length} configured staff IDs`;
 for(const staff of data.staff){const p=document.createElement("p");p.textContent=`${staff.id} — ${staff.role}`;root.append(p);}
 }catch(error){status.textContent=`Staff list unavailable: ${error.message}`;}
}
byId("refreshStaffIds").addEventListener("click",loadStaffIds);

async function loadBranches(){
 const status=byId("branchesStatus"),root=byId("branchesResults");status.textContent="Loading branches…";root.replaceChildren();
 try{const data=await request("branches");status.textContent=`${data.branches.length} configured branches`;
 for(const branch of data.branches){const p=document.createElement("p");p.textContent=`${branch.id} — ${branch.city}, ${branch.location} — Staff ${branch.staffCount}/${branch.staffLimit}`;root.append(p);}
 }catch(error){status.textContent=`Branches unavailable: ${error.message}`;}
}
byId("refreshBranches").addEventListener("click",loadBranches);
