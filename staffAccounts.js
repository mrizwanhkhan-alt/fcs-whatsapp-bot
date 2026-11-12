"use strict";
const crypto=require("node:crypto");
function staffDirectory(){
 let entries;
 try{entries=JSON.parse(process.env.ADMIN_STAFF_ACCOUNTS||"[]");}catch{return [];}
 if(!Array.isArray(entries)||entries.length>100)return [];
 const seen=new Set();
 return entries.filter(e=>{
  if(!e||typeof e.id!=="string"||!/^[a-zA-Z0-9_-]{3,32}$/.test(e.id)||seen.has(e.id)||
   typeof e.hash!=="string"||!/^([a-f0-9]{32}):([a-f0-9]{128})$/.test(e.hash)||
   !["viewer","operator"].includes(e.role))return false;
  seen.add(e.id);return true;
 }).map(e=>({id:e.id,role:e.role,hash:e.hash}));
}
function safeStaffList(){return staffDirectory().map(({id,role})=>({id,role}));}
async function authenticateStaff(id,password){
 if(typeof id!=="string"||typeof password!=="string"||password.length>256)return null;
 const staff=staffDirectory().find(e=>e.id===id);
 if(!staff)return null;
 const [salt,hash]=staff.hash.split(":");
 const digest=await new Promise((resolve,reject)=>crypto.scrypt(password,Buffer.from(salt,"hex"),64,(error,bytes)=>error?reject(error):resolve(bytes)));
 return crypto.timingSafeEqual(digest,Buffer.from(hash,"hex"))?{id:staff.id,role:staff.role}:null;
}
module.exports={safeStaffList,authenticateStaff};
