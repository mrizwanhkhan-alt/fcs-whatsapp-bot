"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {customerStatusReport}=require("../customerStatusReport");
test("counts engagement stages and uncontacted applications",()=>{
 const row=stage=>{const r=Array(20).fill("");r[0]="A";r[17]=stage;return r;};
 assert.deepEqual(customerStatusReport([["header"],row("Called"),row("Called"),row("")]),{total:3,stages:[{stage:"Called",count:2},{stage:"Not contacted",count:1}]});
});
test("skips blank rows and rejects invalid input",()=>{
 assert.equal(customerStatusReport([[],[],["x"]]).total,1);
 assert.throws(()=>customerStatusReport(null),TypeError);
});
