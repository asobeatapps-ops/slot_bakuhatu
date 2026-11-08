import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeaderboard} from '../leaderboard-service.js';

const config={apiKey:'test',authDomain:'demo.test',projectId:'demo-slot',appId:'test-app'};
function client(cloud,uid,{storage=new Map(),maxScore=1000000,timeoutMs=1000}={}) {
  const state={offline:false,writes:0};
  const auth={currentUser:null,authStateReady:async()=>{}};
  const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    signInAnonymously:async()=>{auth.currentUser={uid};return {user:{uid}}},
    doc:(_,__,id)=>id,serverTimestamp:()=>({time:++cloud.clock}),
    runTransaction:async(_,fn)=>{
      if(state.offline)throw Object.assign(new Error('offline'),{code:'unavailable'});
      return fn({get:async id=>({exists:()=>cloud.rows.has(id),data:()=>cloud.rows.get(id)}),set:(id,value)=>{state.writes++;cloud.rows.set(id,value)}});
    },collection:()=>({}),orderBy:()=>({}),limit:()=>({}),query:()=>({}),
    getDocs:async()=>{
      if(state.offline)throw Object.assign(new Error('offline'),{code:'unavailable'});
      return {docs:[...cloud.rows].sort((a,b)=>b[1].score-a[1].score||a[1].achievedAt.time-b[1].achievedAt.time).slice(0,100).map(([id,value])=>({id,data:()=>value}))};
    }};
  const local={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  return {api:createLeaderboard({config,gameId:'slot',maxScore,loadSDK:async()=>sdk,storage:local,timeoutMs}),state,storage};
}
const cloud=()=>({rows:new Map(),clock:0});

test('two users share a ranking; each keeps one best; name changes retain tie time',async()=>{
  const db=cloud(),a=client(db,'alice'),b=client(db,'bob');
  await a.api.submitBest(100,'Alice');await b.api.submitBest(200,'Bob');
  assert.deepEqual((await a.api.loadTop()).map(x=>x.name),['Bob','Alice']);
  const original=db.rows.get('alice').achievedAt;
  await a.api.submitBest(50,'Alice 2');
  assert.equal(db.rows.get('alice').score,100);assert.deepEqual(db.rows.get('alice').achievedAt,original);
  await a.api.submitBest(100,'Alice 3');assert.deepEqual(db.rows.get('alice').achievedAt,original);
  await a.api.submitBest(300,'Alice 4');assert.equal(db.rows.get('alice').score,300);
  assert.equal((await a.api.loadTop())[0].isMe,true);assert.equal(db.rows.size,2);
});
test('offline explicit submissions remain queued and a later lower score does not replace them',async()=>{
  const db=cloud(),a=client(db,'alice');a.state.offline=true;
  await assert.rejects(a.api.submitBest(800,'Alice'),error=>error.queued===true);
  assert.equal(db.rows.size,0);a.state.offline=false;
  await a.api.submitBest(100,'Alice');assert.equal(db.rows.get('alice').score,800);
  assert.equal([...a.storage.keys()].some(x=>x.endsWith(':pending')),false);
});
test('invalid scores cannot be sent; zero is valid; duplicate clicks share an operation',async()=>{
  const db=cloud(),a=client(db,'alice');
  for(const score of [-1,NaN,Infinity,1.5,1000001])await assert.rejects(a.api.submitBest(score,'A'));
  const [first,second]=await Promise.all([a.api.submitBest(0,''),a.api.submitBest(0,'')]);
  assert.equal(first.score,0);assert.equal(second.score,0);assert.equal(a.state.writes,1);
  assert.equal(db.rows.get('alice').name,'匿名プレイヤー');
});
test('projects do not share records; gohan keeps integer hundredths of seconds',async()=>{
  const db1=cloud(),db2=cloud(),slot=client(db1,'same'),gohan=client(db2,'same',{maxScore:8640000});
  await slot.api.submitBest(1000000,'S');await gohan.api.submitBest(1234,'G');
  assert.equal((await slot.api.loadTop())[0].score,1000000);
  assert.equal((await gohan.api.loadTop())[0].score,1234);
  await assert.rejects(gohan.api.submitBest(8640001,'G'));
});
test('unconfigured clients never initialize Firebase or claim registration succeeded',async()=>{
  let loaded=false;
  const api=createLeaderboard({config:{},gameId:'test',maxScore:1,loadSDK:async()=>{loaded=true},storage:null});
  assert.equal(api.configured(),false);await assert.rejects(api.loadTop());await assert.rejects(api.submitBest(0,'a'));
  assert.equal(loaded,false);
});
test('loading has a timeout instead of leaving an infinite spinner',async()=>{
  const api=createLeaderboard({config,gameId:'test',maxScore:1,loadSDK:()=>new Promise(()=>{}),storage:null,timeoutMs:5});
  await assert.rejects(api.loadTop(),error=>error.code==='ranking/timeout');
});
