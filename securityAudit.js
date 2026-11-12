"use strict";
const crypto=require("node:crypto");
const MAX=500;
const entries=[];
function recordAudit(action,outcome,details=""){
 const entry={id:crypto.randomUUID(),at:new Date().toISOString(),action:String(action).slice(0,64),outcome:String(outcome).slice(0,32),details:String(details).slice(0,160)};
 entries.push(entry);
 if(entries.length>MAX)entries.shift();
 return entry;
}
function recentAudit(limit=50){return entries.slice(-Math.max(1,Math.min(100,limit))).reverse();}
module.exports={recordAudit,recentAudit};
