import assert from "node:assert/strict";
import test from "node:test";
import {changeVenue,initialVenue,liveRound,roundStart,roundMs} from "../app/venue-control.ts";

test("主持交接、本人签到、轮换和提前结束互不越权",()=>{
  const start="2026-11-23T10:00:00Z",now=roundStart(start,1);
  const meetings=[{round:1,room:1,lead:"a",partner:"b"},{round:2,room:1,lead:"a",partner:"c"}];
  let state=initialVenue();
  const run=(action,member,extra={})=>{state=changeVenue({state,start,now,meetings,action,member,admin:false,round:1,...extra})};
  assert.throws(()=>run("rooms","a"));
  for(const member of ["a","b","c"])run("checkin",member,{text:member});
  assert.throws(()=>run("ready","a"));
  run("slide",undefined,{admin:true,text:"开场说明"});
  run("rooms",undefined,{admin:true});
  assert.throws(()=>run("ready","c"));
  run("ready","a");assert.throws(()=>run("finish","a"));
  run("ready","b");assert.throws(()=>run("finish","b"));
  run("finish","a");assert.equal(state.finished["1-1"],true);
  assert.throws(()=>run("ready","a"));
  assert.equal(liveRound(start,now+roundMs),0);
  run("ready","c",{now:roundStart(start,2),round:2});
  assert.throws(()=>run("ready","a",{now:roundStart(start,2),round:1}));
  run("close",undefined,{admin:true});assert.throws(()=>run("rooms",undefined,{admin:true}));
});
