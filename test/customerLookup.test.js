"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalized,findCustomer}=require("../customerLookup");
test("Pakistan local and international numbers match",()=>{assert.equal(normalized("0300-1234567"),normalized("+92 300 1234567"));assert.equal(normalized("00923001234567"),normalized("+923001234567"));});
test("find latest matching customer and location",()=>{const row=Array(20).fill("");row[5]="03001234567";row[8]="Punjab";row[9]="Lahore";row[17]="Contacted";const found=findCustomer([[],row],"+923001234567");assert.equal(found.city,"Lahore");assert.equal(found.rowNumber,2);});
test("unknown customer and invalid rows",()=>{assert.equal(findCustomer([[],[]],"03001234567"),null);assert.throws(()=>findCustomer(null,"1"),TypeError);});
