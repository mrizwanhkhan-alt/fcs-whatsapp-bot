"use strict";
(() => {
  const panels = {
    admin: {title:"Super Admin",features:[["Country Network Explorer","networkExplorerPanel"],["Business Centers & Franchises","branchesPanel"],["Staff & Communicators","staffIdsPanel"],["WhatsApp Calling","callingPanel"],["WhatsApp Messaging","composePanel"],["Subscriptions","subscriptionPanel"],["Reports","reportsPanel"],["Message Activity","messageActivityPanel"],["Security Audit","securityAuditPanel"]]},
    business_center:{title:"Business Center",features:[["My Network","networkExplorerPanel"],["Subscription Status","subscriptionPanel"],["Calling","callingPanel"],["Messaging","composePanel"],["Staff Management","staffIdsPanel"],["Reports","reportsPanel"]]},
    franchise:{title:"Franchise",features:[["My Network","networkExplorerPanel"],["Subscription Status","subscriptionPanel"],["Calling","callingPanel"],["Messaging","composePanel"],["Staff Management","staffIdsPanel"],["Reports","reportsPanel"]]},
    communicator:{title:"Communicator",features:[["Assigned Territory",null],["Calling","callingPanel"],["Messaging","composePanel"],["Customer Follow-up",null],["My Activity",null]]}
  };
  function roleOf(identity) {
    const r=identity?.role;
    if(r==="admin"||r==="super_admin")return "admin";
    if(r==="business_center"||r==="business-center")return "business_center";
    if(r==="franchise")return "franchise";
    return "communicator";
  }
  function render(session) {
    const root=document.getElementById("roleWorkspace");
    if(!root)return;
    root.hidden=!session?.signedIn;
    if(!session?.signedIn){root.replaceChildren();return;}
    const role=roleOf(session.identity);
    const config=panels[role];
    root.replaceChildren();
    const heading=document.createElement("h1");heading.textContent=config.title+" Dashboard";
    const note=document.createElement("p");
    note.className="hint";
    note.textContent="Your signed-in role determines access. Unavailable modules remain visible and locked; this view never grants permissions.";
    const grid=document.createElement("div");grid.className="role-feature-grid";
    for(const [label,id] of config.features){
      const target=id&&document.getElementById(id);
      const available=Boolean(target&&!target.hidden);
      const tile=document.createElement(available?"a":"div");
      tile.className="role-feature-tile"+(available?"":" locked");
      tile.textContent=label;
      if(available){tile.href="#"+id;tile.setAttribute("aria-label","Open "+label);}
      else {tile.setAttribute("aria-disabled","true");tile.title="Not available for this account";}
      const state=document.createElement("small");
      state.textContent=available?"Open":"Locked";
      tile.append(state);grid.append(tile);
    }
    root.append(heading,note,grid);
  }
  window.renderRoleWorkspace=render;
})();
