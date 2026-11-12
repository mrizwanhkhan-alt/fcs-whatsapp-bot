"use strict";
function branches(){
 let rows;
 try{rows=JSON.parse(process.env.FCS_BRANCHES||"[]");}catch{return [];}
 if(!Array.isArray(rows))return [];
 const seen=new Set();
 return rows.filter(b=>{
  if(!b||typeof b.id!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(b.id)||seen.has(b.id)||
   typeof b.city!=="string"||!b.city.trim()||b.city.length>100||
   typeof b.location!=="string"||!b.location.trim()||b.location.length>200)return false;
  seen.add(b.id);return true;
 }).map(({id,city,location})=>({id,city,location}));
}
function branchSummary(staff){
 const list=branches();
 return list.map(b=>({...b,staffCount:staff.filter(s=>s.branchId===b.id).length,staffLimit:4}));
}
module.exports={branches,branchSummary};
