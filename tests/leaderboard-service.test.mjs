import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeaderboard} from '../leaderboard-service.js';

const config={apiKey:'test',authDomain:'demo.test',projectId:'demo-slot',appId:'test-app'};
function client(cloud,uid,{storage=new Map(),maxScore=1000000,timeoutMs=1000,scoreAllowed=()=>true}={}) {
  const state={offline:false,writes:0,advance:11000,guarded:true,denyWrites:false,attempts:0};
  const auth={currentUser:null,authStateReady:async()=>{}};
  const sdk={getApps:()=>[],initializeApp:()=>({}),getAuth:()=>auth,getFirestore:()=>({}),
    signInAnonymously:async()=>{auth.currentUser={uid};return {user:{uid}}},
    doc:(_,collection,id)=>({collection,id}),serverTimestamp:()=>({time:cloud.clock,toMillis(){return this.time}}),
    getDoc:async ref=>{if(!state.guarded)throw Object.assign(new Error('old rules'),{code:'permission-denied'});return {exists:()=>cloud.locks.has(ref.id),data:()=>cloud.locks.get(ref.id)};},
    runTransaction:async(_,fn)=>{
      if(state.offline)throw Object.assign(new Error('offline'),{code:'unavailable'});
      state.attempts++;cloud.clock+=state.advance;
      const writes=[];const table=ref=>ref.collection==='leaderboard'?cloud.rows:cloud.locks;
      const result=await fn({get:async ref=>({exists:()=>table(ref).has(ref.id),data:()=>table(ref).get(ref.id)}),set:(ref,value)=>writes.push([ref,value])});
      if(state.denyWrites)throw Object.assign(new Error('denied'),{code:'permission-denied'});
      for(const [ref,value]of writes){if(ref.collection==='leaderboard')state.writes++;table(ref).set(ref.id,value);}
      return result;
    },collection:()=>({}),orderBy:()=>({}),limit:()=>({}),query:()=>({}),
    getDocs:async()=>{
      if(state.offline)throw Object.assign(new Error('offline'),{code:'unavailable'});
      return {docs:[...cloud.rows].sort((a,b)=>b[1].score-a[1].score||a[1].achievedAt.time-b[1].achievedAt.time).slice(0,100).map(([id,value])=>({id,data:()=>value}))};
    }};
  const local={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  return {api:createLeaderboard({config,gameId:'slot',maxScore,loadSDK:async()=>sdk,storage:local,timeoutMs,scoreAllowed,now:()=>cloud.clock}),state,storage};
}
const cloud=()=>({rows:new Map(),locks:new Map(),clock:0});

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

test('server lock cooldown preserves pending best and allows no-op without writes',async()=>{
  const db=cloud(),a=client(db,'alice');a.state.advance=0;
  await a.api.submitBest(100,'Alice');
  await a.api.submitBest(50,'Alice');assert.equal(a.state.writes,1);
  await assert.rejects(a.api.submitBest(200,'Alice'),e=>e.code==='ranking/rate-limited'&&e.queued===true&&/10秒/.test(a.api.publicError(e)));
  assert.equal(db.rows.get('alice').score,100);assert.equal(a.state.writes,1);
  db.clock+=10000;await a.api.submitBest(50,'Alice');assert.equal(db.rows.get('alice').score,200);
  assert.equal(a.state.writes,2);
});
test('a denied guarded write never retries an unguarded transaction',async()=>{
  const a=client(cloud(),'alice');a.state.denyWrites=true;
  await assert.rejects(a.api.submitBest(10,'Alice'),e=>e.code==='permission-denied');
  assert.equal(a.state.attempts,1);assert.equal(a.state.writes,0);
});
test('old rules remain compatible until guarded rules are deployed',async()=>{
  const db=cloud(),a=client(db,'alice');a.state.guarded=false;
  await a.api.submitBest(10,'Alice');assert.equal(db.rows.get('alice').score,10);assert.equal(db.locks.size,0);
  a.state.guarded=true;await a.api.submitBest(20,'Alice');assert.equal(db.rows.get('alice').score,20);assert.equal(db.locks.size,1);
});
test('names exclude control and invisible direction characters without splitting emoji',async()=>{
  const db=cloud(),a=client(db,'alice');await a.api.submitBest(10,' \u202e\u200b'+'😀'.repeat(17)+'\n ');
  assert.equal(db.rows.get('alice').name,'😀'.repeat(8));
});
test('slot validates the mathematical score gap while preserving genuine maximum',async()=>{
  const allowed=score=>score===0||(score>=10&&(score<=938793||score===1000000));
  const a=client(cloud(),'alice',{scoreAllowed:allowed});
  for(const score of [1,9,938794,999999])assert.equal(a.api.validScore(score),false);
  for(const score of [0,10,938793,1000000])assert.equal(a.api.validScore(score),true);
  assert.equal(Math.round(1000000*(1-5/240)**3),938793);
});

test('actual slot calculation always fits the allowed score ranges',()=>{
  const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  const code=source.match(/^function (phase|delta7|symbolIndex|calculate)\(.*$/gm).join('\n');
  const context={PERIOD:800,STEP:160,JUST:5,state:null};runInNewContext(code,context);
  let seed=1234567;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const times=[0,5,5.00000001,79.999,80,400,795,800,15000];
  for(let i=0;i<20000;i++){
    context.state={manual:i%4,stops:Array.from({length:3},()=>({t:i<times.length?times[i]:random()*15000}))};
    const score=context.calculate().height;
    assert.ok(score===0||(score>=10&&(score<=938793||score===1000000)),'legitimate score rejected: '+score);
  }
});
