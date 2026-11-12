"use strict";
const {Pool}=require("pg");
let pool;
function database(){
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is not configured");
 if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,ssl:process.env.PGSSL==="true"?{rejectUnauthorized:true}:undefined});
 return pool;
}
async function initializeDatabase(){
 await database().query(`CREATE TABLE IF NOT EXISTS fcs_branches (
 id VARCHAR(32) PRIMARY KEY, city VARCHAR(100) NOT NULL, location VARCHAR(200) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fcs_staff (
 id VARCHAR(32) PRIMARY KEY, branch_id VARCHAR(32) NOT NULL REFERENCES fcs_branches(id),
 role VARCHAR(16) NOT NULL CHECK(role IN ('viewer','operator')),
 password_hash TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fcs_staff_branch_idx ON fcs_staff(branch_id);`);
}
async function branchList(){
 const result=await database().query("SELECT b.id,b.city,b.location,COUNT(s.id)::int AS staff_count FROM fcs_branches b LEFT JOIN fcs_staff s ON s.branch_id=b.id AND s.active=true GROUP BY b.id ORDER BY b.city,b.id");
 return result.rows;
}
async function createBranch({id,city,location}){
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(id)||typeof city!=="string"||!city.trim()||city.length>100||typeof location!=="string"||!location.trim()||location.length>200)throw new Error("Invalid branch");
 await database().query("INSERT INTO fcs_branches(id,city,location) VALUES($1,$2,$3)",[id,city.trim(),location.trim()]);
}
async function addStaff({id,branchId,role,passwordHash}){
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{3,32}$/.test(id)||typeof branchId!=="string"||!["viewer","operator"].includes(role)||typeof passwordHash!=="string"||!/^([a-f0-9]{32}):([a-f0-9]{128})$/.test(passwordHash))throw new Error("Invalid staff");
 const client=await database().connect();
 try{
  await client.query("BEGIN");
  const branch=await client.query("SELECT id FROM fcs_branches WHERE id=$1 FOR UPDATE",[branchId]);
  if(!branch.rowCount)throw new Error("Branch not found");
  const count=await client.query("SELECT COUNT(*)::int AS total FROM fcs_staff WHERE branch_id=$1 AND active=true",[branchId]);
  if(count.rows[0].total>=4)throw new Error("Branch staff limit reached");
  await client.query("INSERT INTO fcs_staff(id,branch_id,role,password_hash) VALUES($1,$2,$3,$4)",[id,branchId,role,passwordHash]);
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
module.exports={database,initializeDatabase,branchList,createBranch,addStaff};
