"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const originalLoad = Module._load;
const oldUrl = process.env.DATABASE_URL;
const calls=[];
class FakePool {
  on() {}
  async query(sql, params=[]) {
    calls.push({sql,params});
    if (/INSERT INTO fcs_message_inbox/.test(sql)) return {rows:[{message_id:params[0],attempts:1}]};
    if (/SELECT message_id,payload/.test(sql)) return {rows:[{message_id:"wamid.1",payload:{id:"wamid.1",from:"923000000000",type:"text",text:{body:"hi"}}}]};
    return {rows:[],rowCount:1};
  }
}
let inbox;
try {
  process.env.DATABASE_URL="postgres://fake/test";
  Module._load=function(request,parent,isMain) {
    if (request==="pg" && parent?.filename?.endsWith("/messageInbox.js")) return {Pool:FakePool};
    return originalLoad.apply(this,arguments);
  };
  delete require.cache[require.resolve("../messageInbox")];
  inbox=require("../messageInbox");
} finally {
  Module._load=originalLoad;
  if (oldUrl===undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL=oldUrl;
}
test("message inbox persists payload for recovery and claims atomically",async()=>{
  const payload={id:"wamid.1",from:"923000000000",type:"text"};
  assert.equal((await inbox.claim(payload.id,payload)).attempt,1);
  const insert=calls.find(x=>/INSERT INTO fcs_message_inbox/.test(x.sql));
  assert.equal(JSON.parse(insert.params[1]).id,payload.id);
  assert.match(insert.sql,/ON CONFLICT/);
  assert.match(insert.sql,/lease_until/);
});
test("independent recovery can read pending persisted messages",async()=>{
  const pending=await inbox.pending(10);
  assert.equal(pending[0].payload.id,"wamid.1");
  assert.ok(calls.some(x=>/completed_at IS NULL AND payload IS NOT NULL/.test(x.sql)));
});
test("stale worker cannot complete or fail another worker claim",async()=>{
  await inbox.complete("wamid.1",1);
  await inbox.fail("wamid.1",1,new Error("failure"));
  const mutations=calls.filter(x=>/UPDATE fcs_message_inbox SET/.test(x.sql));
  assert.equal(mutations.length,2);
  assert.ok(mutations.every(x=>/attempts=\$2/.test(x.sql)));
});
