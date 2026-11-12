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
  if(b.branchType!==undefined&&!["business_center","franchise"].includes(b.branchType))return false;
  if(b.parentBusinessCenterId!==undefined&&b.parentBusinessCenterId!==null&&typeof b.parentBusinessCenterId!=="string")return false;
  seen.add(b.id);return true;
 }).map(({id,city,location,branchType="franchise",parentBusinessCenterId=null})=>({id,city,location,branchType,parentBusinessCenterId}));
}
function branchSummary(staff){
 const list=branches();
 return list.map(b=>({...b,staffCount:staff.filter(s=>s.branchId===b.id).length,staffLimit:4,franchiseCount:b.branchType==="business_center"?list.filter(f=>f.branchType==="franchise"&&f.parentBusinessCenterId===b.id).length:undefined}));
}
module.exports={branches,branchSummary};
