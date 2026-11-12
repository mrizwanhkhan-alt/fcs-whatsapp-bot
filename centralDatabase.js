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
ALTER TABLE fcs_branches ADD COLUMN IF NOT EXISTS branch_type VARCHAR(20) NOT NULL DEFAULT 'franchise';
ALTER TABLE fcs_branches ADD COLUMN IF NOT EXISTS parent_business_center_id VARCHAR(32) REFERENCES fcs_branches(id);
ALTER TABLE fcs_branches DROP CONSTRAINT IF EXISTS fcs_branches_type_check;
ALTER TABLE fcs_branches ADD CONSTRAINT fcs_branches_type_check CHECK(branch_type IN ('business_center','franchise'));
ALTER TABLE fcs_branches DROP CONSTRAINT IF EXISTS fcs_branches_parent_check;
ALTER TABLE fcs_branches ADD CONSTRAINT fcs_branches_parent_check CHECK(
 (branch_type='business_center' AND parent_business_center_id IS NULL) OR
 (branch_type='franchise' AND (parent_business_center_id IS NULL OR parent_business_center_id<>id))
);
CREATE TABLE IF NOT EXISTS fcs_staff (
 id VARCHAR(32) PRIMARY KEY, branch_id VARCHAR(32) NOT NULL REFERENCES fcs_branches(id),
 role VARCHAR(16) NOT NULL CHECK(role IN ('viewer','operator')),
 password_hash TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fcs_staff_branch_idx ON fcs_staff(branch_id);
CREATE TABLE IF NOT EXISTS fcs_customers (
 id VARCHAR(64) PRIMARY KEY,
 phone VARCHAR(32) NOT NULL,
 province VARCHAR(100) NOT NULL DEFAULT '',
 city VARCHAR(100) NOT NULL DEFAULT '',
 area VARCHAR(100) NOT NULL DEFAULT '',
 business_center_id VARCHAR(32) REFERENCES fcs_branches(id),
 franchise_id VARCHAR(32) REFERENCES fcs_branches(id),
 communicator_id VARCHAR(32),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fcs_customers_center_idx ON fcs_customers(business_center_id);
CREATE INDEX IF NOT EXISTS fcs_customers_franchise_idx ON fcs_customers(franchise_id);
CREATE INDEX IF NOT EXISTS fcs_customers_communicator_idx ON fcs_customers(communicator_id);
ALTER TABLE fcs_branches ADD COLUMN IF NOT EXISTS province VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE fcs_branches ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(16) NOT NULL DEFAULT 'free';
ALTER TABLE fcs_branches DROP CONSTRAINT IF EXISTS fcs_subscription_status_check;
ALTER TABLE fcs_branches ADD CONSTRAINT fcs_subscription_status_check CHECK (subscription_status IN ('free','active','expired'));`);
}
async function branchList(){
 const result=await database().query("SELECT b.id,b.city,b.location,b.province,b.branch_type,b.parent_business_center_id,b.subscription_status,COUNT(s.id)::int AS staff_count FROM fcs_branches b LEFT JOIN fcs_staff s ON s.branch_id=b.id AND s.active=true GROUP BY b.id ORDER BY b.city,b.id");
 return result.rows;
}
async function createBranch({id,city,location,province="",branchType="franchise",parentBusinessCenterId=null}){
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(id)||typeof city!=="string"||!city.trim()||city.length>100||typeof location!=="string"||!location.trim()||location.length>200)throw new Error("Invalid branch");
 if(typeof province!=="string"||province.length>100)throw new Error("Invalid province");
 if(!["business_center","franchise"].includes(branchType))throw new Error("Invalid branch type");
 if(branchType==="business_center"&&parentBusinessCenterId!==null)throw new Error("Business center cannot have a parent");
 if(parentBusinessCenterId!==null)await verifyParent(database(),parentBusinessCenterId,city);
 await database().query("INSERT INTO fcs_branches(id,city,location,province,branch_type,parent_business_center_id) VALUES($1,$2,$3,$4,$5,$6)",[id,city.trim(),location.trim(),province.trim(),branchType,parentBusinessCenterId]);
}
async function editBranch({id,location,province}){
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(id)||typeof location!=="string"||!location.trim()||location.length>200||typeof province!=="string"||province.length>100)throw new Error("Invalid branch edit");
 const result=await database().query("UPDATE fcs_branches SET location=$2,province=$3 WHERE id=$1 RETURNING id",[id,location.trim(),province.trim()]);
 if(!result.rowCount)throw new Error("Branch not found");
 return result.rows[0];
}
async function verifyParent(client,parentId,city){
 const result=await client.query("SELECT id,city,branch_type FROM fcs_branches WHERE id=$1",[parentId]);
 if(!result.rowCount||result.rows[0].branch_type!=="business_center"||result.rows[0].city.trim().toLowerCase()!==city.trim().toLowerCase())throw new Error("Parent must be a business center in the same city");
}
async function transferFranchise(franchiseId,parentBusinessCenterId=null){
 if(typeof franchiseId!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(franchiseId)||parentBusinessCenterId!==null&&(typeof parentBusinessCenterId!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(parentBusinessCenterId)))throw new Error("Invalid branch ID");
 const client=await database().connect();
 try{
  await client.query("BEGIN");
  const result=await client.query("SELECT id,city,branch_type FROM fcs_branches WHERE id=$1 FOR UPDATE",[franchiseId]);
  if(!result.rowCount||result.rows[0].branch_type!=="franchise")throw new Error("Franchise not found");
  if(parentBusinessCenterId!==null)await verifyParent(client,parentBusinessCenterId,result.rows[0].city);
  await client.query("UPDATE fcs_branches SET parent_business_center_id=$1 WHERE id=$2",[parentBusinessCenterId,franchiseId]);
  await client.query("COMMIT");
 }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
async function setSubscription(id,status){
 if(typeof id!=="string"||!/^[A-Za-z0-9_-]{2,32}$/.test(id)||!["free","active","expired"].includes(status))throw new Error("Invalid subscription");
 const result=await database().query("UPDATE fcs_branches SET subscription_status=$2 WHERE id=$1 RETURNING id,subscription_status",[id,status]);
 if(!result.rowCount)throw new Error("Branch not found");
 return result.rows[0];
}
async function subscriptionForBranch(id){
 const result=await database().query("SELECT subscription_status FROM fcs_branches WHERE id=$1",[id]);
 return result.rows[0]?.subscription_status || null;
}
async function staffList(){
 const result=await database().query("SELECT id,role,branch_id FROM fcs_staff WHERE active=true ORDER BY branch_id,id");
 return result.rows;
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

async function customersForIdentity(identity) {
 const role=identity?.role;
 const id=identity?.id;
 const branchId=identity?.branchId;
 let query="SELECT id,phone,province,city,area,business_center_id AS \"businessCenterId\",franchise_id AS \"franchiseId\",communicator_id AS \"communicatorId\" FROM fcs_customers";
 let params=[];
 if(role==="admin") {
   query+=" ORDER BY id LIMIT 500";
 } else if(role==="communicator" && typeof id==="string" && id) {
   query+=" WHERE communicator_id=$1 ORDER BY id LIMIT 500";params=[id];
 } else if(role==="franchise" && typeof branchId==="string" && branchId) {
   query+=" WHERE franchise_id=$1 ORDER BY id LIMIT 500";params=[branchId];
 } else if(role==="business_center" && typeof branchId==="string" && branchId) {
   query+=" WHERE business_center_id=$1 ORDER BY id LIMIT 500";params=[branchId];
 } else {
   return [];
 }
 return (await database().query(query,params)).rows;
}
module.exports={customersForIdentity,database,initializeDatabase,branchList,createBranch,editBranch,transferFranchise,addStaff,setSubscription,subscriptionForBranch,staffList};
