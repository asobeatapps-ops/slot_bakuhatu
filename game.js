import {leaderboard} from './ranking.js';
import {createLeaderboardUI} from './leaderboard-ui.js';
const $=id=>document.getElementById(id), SYMBOLS=['7','BAR','🔔','🍒','🍉'], PERIOD=800, STEP=160, LIMIT=15000, JUST=5;
const TITLES=[[10,'ただの爆発好き'],[100,'ご近所迷惑'],[500,'屋根より高いスロット'],[1000,'雲に謝れ'],[3000,'飛びすぎ注意報'],[5000,'天空の無職'],[8000,'地球から出禁'],[10000,'空気がないんだが'],[25000,'宇宙に不法侵入'],[50000,'NASA困惑'],[100000,'宇宙でもパチスロ'],[200000,'地球を置いてきた'],[400000,'月にパチ屋を建てる男'],[700000,'宇宙の問題児'],[1000000,'神すら目押しで超えた']];
const getTitle=h=>h===0?'何しに来たん？':TITLES.reduce((a,x)=>h>=x[0]?x[1]:a,TITLES[0][1]);
const localBest=()=>Number(localStorage.getItem('slotBest')||0);
let sound=localStorage.getItem('slotSound')!=='off',audioCtx=null,screen='titleScreen',state=null,raf=0,flightRaf=0,lastFrame=0;
let lastResult=null,backFromRank='titleScreen',finishTimer=0,explosionRaf=0;
const rankUI=createLeaderboardUI({api:leaderboard,formatScore:score=>score.toLocaleString('ja-JP')+'m',open:()=>show('rankingScreen'),close:()=>show(backFromRank)});
function tone(freq,duration,type='sine',volume=.12,delay=0){if(!sound)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=audioCtx.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain).connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.02)}catch{}}
function sfx(name){if(name==='stop')tone(240,.1,'square',.09);if(name==='just'){tone(780,.3,'triangle',.14);tone(1180,.2,'sine',.1,.08)}if(name==='boom'){tone(100,.8,'sawtooth',.2);tone(56,.7,'triangle',.18)}if(name==='bonus'){[660,880,1100,1440].forEach((n,i)=>tone(n,.18,'triangle',.12,i*.12))}if(name==='result')tone(660,.2,'triangle',.12)}
function show(id){screen=id;document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));}
function refreshBest(){$('titleBest').textContent=localStorage.getItem('slotHasBest')?localBest().toLocaleString()+'m':'—';$('hudBest').textContent=localBest().toLocaleString()+'m'}
function init(){refreshBest();$('soundBtn').textContent=sound?'♪ ON':'♪ OFF';show('titleScreen')}
function phase(t){return ((t%PERIOD)+PERIOD)%PERIOD}
function delta7(t){const p=phase(t);return Math.min(p,PERIOD-p)}
function symbolIndex(t){const p=phase(t);return Math.floor((p+STEP/2)/STEP)%5}
function start(){document.getElementById('bigBanner').classList.remove('visible');explosionLayer.classList.remove('visible');clearTimeout(finishTimer);cancelAnimationFrame(explosionRaf);cancelAnimationFrame(raf);cancelAnimationFrame(flightRaf);state={elapsed:0,stops:[null,null,null],manual:0,last:performance.now(),paused:false,ended:false,settling:false};show('gameScreen');$('gameCaption').textContent='7を狙え！';$('justRow').innerHTML='<span>—</span><span>—</span><span>—</span>';document.querySelectorAll('.stop').forEach(b=>b.disabled=false);$('timeLeft').textContent='15.00';refreshBest();renderReels();raf=requestAnimationFrame(tick)}
function tick(now){if(screen!=='gameScreen'||!state||state.ended)return;if(state.paused){state.last=now;return}state.elapsed=Math.min(LIMIT,state.elapsed+Math.max(0,now-state.last));state.last=now;$('timeLeft').textContent=((LIMIT-state.elapsed)/1000).toFixed(2);document.querySelector('.timer').classList.toggle('urgent',state.elapsed>12000);renderReels();if(state.elapsed>=LIMIT){for(let i=0;i<3;i++)if(state.stops[i]===null)state.stops[i]={t:state.elapsed,auto:true,visualStart:now};finish();return}raf=requestAnimationFrame(tick)}
function stop(i){if(!state||state.ended||state.paused||screen!=='gameScreen'||state.stops[i]!==null)return;const now=performance.now();state.elapsed=Math.min(LIMIT,state.elapsed+Math.max(0,now-state.last));state.last=now;if(state.elapsed>=LIMIT){for(let j=0;j<3;j++)if(state.stops[j]===null)state.stops[j]={t:LIMIT,auto:true,visualStart:now};finish();return}const t=state.elapsed,e=delta7(t),isJust=e<=JUST&&symbolIndex(t)===0;state.stops[i]={t,auto:false,visualStart:now};state.manual++;document.querySelector(`.stop[data-reel="${i}"]`).disabled=true;$('justRow').children[i].textContent=isJust?'JUST!':'STOP';$('gameCaption').textContent=isJust?'JUST!!':'止めろ！';sfx(isJust?'just':'stop');renderReels();if(state.stops.every(Boolean))finish()}
function calculate(){if(state.manual===0)return {height:0,is777:false,allJust:false,errors:[0,0,0]};const errors=state.stops.map(x=>delta7(x.t));const is777=state.stops.every(x=>symbolIndex(x.t)===0);const allJust=is777&&errors.every(e=>e<=JUST);const q=errors.map(e=>Math.max(0,1-e/80)).reduce((a,b)=>a+b,0)/3;const height=allJust?1000000:Math.max(10,Math.round((is777?1000000:10000)*q**3));return {height,is777,allJust,errors}}
function finish(){
  if(!state||state.ended)return;
  state.ended=true;state.settling=true;cancelAnimationFrame(raf);
  document.querySelectorAll('.stop').forEach(b=>b.disabled=true);
  // Score is determined by the original touch timestamp, NOT by the reel's visual snap.
  lastResult=calculate();const h=lastResult.height;
  if(!localStorage.getItem('slotHasBest')||h>localBest()){localStorage.setItem('slotBest',String(h));localStorage.setItem('slotHasBest','1')}
  const waitUntil=Math.max(...state.stops.map(x=>x.visualStart+SNAP_MS));
  function settle(now){if(screen!=='gameScreen'||!state?.settling)return;renderReels(now);if(now<waitUntil){raf=requestAnimationFrame(settle);return}state.settling=false;beginExplosion(lastResult)}
  raf=requestAnimationFrame(settle);
}
// Flight lasts five seconds. At the apex the camera stops following the machine;
// the machine then falls under a constant downward acceleration for one second.
const ASCENT_MS=5000, FALL_MS=1000;
function beginFlight(result){
  show('flightScreen');
  $('bonusLabel').textContent=result.is777?'BIG BONUS!':result.height===0?'BOOM!':'爆発！！';
  const begin=performance.now(),canvas=$('flightCanvas'),ctx=canvas.getContext('2d');
  const duration=result.height===0?250:ASCENT_MS+FALL_MS;
  function frame(now){
    if(screen!=='flightScreen')return;
    const elapsed=Math.min(duration,now-begin);
    const ascent=Math.min(1,elapsed/ASCENT_MS);
    const ease=1-Math.pow(1-ascent,2);
    const atApex=result.height>0&&elapsed>=ASCENT_MS;
    const falling=atApex?Math.min(1,(elapsed-ASCENT_MS)/FALL_MS):0;
    document.getElementById('bigBanner').classList.toggle('visible',result.is777&&elapsed<2250);
    // Keep the altitude HUD at the achieved maximum while the camera is fixed.
    const height=atApex?result.height:Math.round(result.height*ease);
    $('flightHeight').textContent=height.toLocaleString()+'m';
    drawFlight(ctx,canvas,ascent,height,result.height,result.is777,falling,atApex);
    if(elapsed<duration)flightRaf=requestAnimationFrame(frame);
    else showResult(result);
  }
  flightRaf=requestAnimationFrame(frame);
}
// Altitude-driven fly-bys. All objects are background scenery, never collision
// targets; they do not modify scoring, camera motion, or the five-second ascent.
const FLYBYS=[
  {kind:'birds',alt:180,x:.23,size:1.1},{kind:'birds',alt:520,x:.76,size:.85},
  {kind:'plane',alt:2400,x:.66,size:1},{kind:'plane',alt:6900,x:.27,size:.75},
  {kind:'satellite',alt:15500,x:.73,size:1},{kind:'satellite',alt:47000,x:.24,size:.75},
  {kind:'planet',alt:110000,x:.78,size:1,color:'#dc8261'},
  {kind:'planet',alt:310000,x:.22,size:1.25,color:'#8fb4ff'},
  {kind:'planet',alt:690000,x:.72,size:1.45,color:'#d6a7ef'}
];
function drawFlybys(ctx,w,hh,altitude,total,apex){
  if(total<=0)return;
  const time=apex?1:altitude/Math.max(1,total);
  for(let i=0;i<FLYBYS.length;i++){
    const o=FLYBYS[i];if(total<o.alt*.72)continue;
    // A world-space window: objects rush from ahead of the slot to below it.
    const range=Math.max(450,o.alt*.52);
    const offset=(altitude-o.alt)/range;
    if(Math.abs(offset)>1.3)continue;
    const y=hh*.58+offset*hh*.77;
    const x=w*o.x+Math.sin(i*4.13)*w*.06;
    const proximity=Math.max(0,1-Math.abs(offset)*.72);
    const scale=o.size*(.42+proximity*.75);
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    if(o.kind==='birds'){
      ctx.strokeStyle='#172b3c';ctx.lineWidth=3.5;ctx.lineCap='round';
      for(let b=0;b<4;b++){
        const bx=(b-1.5)*25,by=Math.sin(b*2.2+i)*12;
        const flap=Math.sin(time*100+b*1.8)*5;
        ctx.beginPath();ctx.moveTo(bx-13,by-3+flap);ctx.quadraticCurveTo(bx-6,by-10,bx,by);
        ctx.quadraticCurveTo(bx+6,by-10,bx+13,by-3-flap);ctx.stroke();
      }
    }else if(o.kind==='plane'){
      ctx.rotate(-.16);ctx.shadowColor='#d5f5ff';ctx.shadowBlur=14;
      ctx.fillStyle='#e9f3fa';ctx.beginPath();ctx.moveTo(-67,0);ctx.lineTo(66,-4);
      ctx.lineTo(75,0);ctx.lineTo(65,5);ctx.lineTo(-67,6);ctx.closePath();ctx.fill();
      ctx.fillStyle='#b7d9f0';ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(21,-31);
      ctx.lineTo(34,-31);ctx.lineTo(20,1);ctx.lineTo(29,30);ctx.lineTo(16,30);ctx.closePath();ctx.fill();
      ctx.fillStyle='#e34f59';ctx.fillRect(-55,-15,19,16);
      ctx.fillStyle='#2e5776';for(let j=0;j<7;j++)ctx.fillRect(-24+j*10,-3,4,3);
    }else if(o.kind==='satellite'){
      ctx.rotate(.25+time*4);ctx.shadowColor='#b5e9ff';ctx.shadowBlur=15;
      ctx.fillStyle='#3c78bd';ctx.fillRect(-64,-17,48,34);ctx.fillRect(16,-17,48,34);
      ctx.strokeStyle='#8cd7ff';ctx.lineWidth=2;
      for(let q=-60;q<64;q+=12){ctx.beginPath();ctx.moveTo(q,-17);ctx.lineTo(q,17);ctx.stroke()}
      ctx.fillStyle='#d4dce5';ctx.fillRect(-15,-20,30,40);
      ctx.fillStyle='#f8b856';ctx.fillRect(-10,-13,20,26);
      ctx.strokeStyle='#e9f5ff';ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(10,-37);ctx.stroke();
      ctx.beginPath();ctx.arc(11,-39,7,0,Math.PI*2);ctx.stroke();
    }else{
      const r=48;ctx.shadowColor=o.color;ctx.shadowBlur=32;
      const grad=ctx.createRadialGradient(-17,-18,2,0,0,r);
      grad.addColorStop(0,'#fff4da');grad.addColorStop(.22,o.color);grad.addColorStop(1,'#141d42');
      ctx.fillStyle=grad;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
      ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=5;
      ctx.beginPath();ctx.ellipse(0,0,r*1.7,r*.36,-.25,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,.20)';ctx.beginPath();ctx.ellipse(-13,-10,18,7,.3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    // A trailing streak emphasizes that the player has overtaken the object.
    if(!apex&&offset>0&&offset<.9){
      ctx.strokeStyle=`rgba(196,236,255,${(1-offset)*.32})`;
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-25*scale);ctx.lineTo(x,y-80*scale);ctx.stroke();
    }
  }
}
// Camera-space rendering: the city recedes in perspective instead of remaining
// pinned to the viewport. All effects are visual only; scoring is unchanged.
function drawFlight(ctx,canvas,p,h,total,gold,falling=0,atApex=false){
  const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,hh=canvas.clientHeight;
  if(!w||!hh)return;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(hh*dpr)){
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(hh*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const progress=atApex?1:p,flight=total>0&&!atApex;
  const sky=h<1000?['#58b6f7','#e2f8ff']:h<10000?['#1654a7','#8cc4f5']:['#05071c','#201348'];
  const bg=ctx.createLinearGradient(0,0,0,hh);bg.addColorStop(0,sky[0]);bg.addColorStop(1,sky[1]);
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,hh);
  // Vignette adds cinematic depth.
  const vignette=ctx.createRadialGradient(w*.5,hh*.47,w*.06,w*.5,hh*.47,hh*.8);
  vignette.addColorStop(0,'#00000000');vignette.addColorStop(1,'#01000eaa');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,w,hh);
  const cityEnd=Math.min(1,progress*4.5);
  // A complete city layer scales and drops towards the horizon as the camera climbs.
  if(total===0||cityEnd<1){
    const scale=total===0?1:Math.pow(1-cityEnd,2.5);
    const ground=hh*(.88+cityEnd*.42);
    ctx.save();ctx.translate(w*.5,ground);ctx.scale(Math.max(.001,scale),Math.max(.001,scale));
    ctx.fillStyle='#252b46';ctx.fillRect(-w*1.2,-8,w*2.4,hh*.65);
    for(let i=0;i<27;i++){
      const bw=w/15, x=(i-13.5)*bw, bh=80+((i*53+17)%190);
      ctx.fillStyle=i%3===0?'#283349':i%3===1?'#3c405c':'#20273c';
      ctx.fillRect(x,-bh,bw*.93,bh);
      ctx.fillStyle='#ffe7a177';
      for(let yy=12;yy<bh-8;yy+=19)for(let xx=5;xx<bw*.9;xx+=13){
        if((i*13+yy+xx)%5<3)ctx.fillRect(x+xx,-bh+yy,4,7);
      }
    }
    ctx.restore();
  }
  // Independent near and far cloud layers: fast movement, scaling and perspective.
  if(total>0){
    for(let layer=0;layer<3;layer++){
      const speed=[2.1,4.6,8.5][layer],size=[25,47,85][layer];
      for(let i=0;i<16;i++){
        const seed=i*73.83+layer*119.13;
        const x=((seed*3.17)% (w+200))-100;
        const y=((seed*1.71+progress*hh*speed)%(hh+size*3))-size*1.5;
        const alpha=h>=10000?.045:h>=1000?.16:.27;
        ctx.fillStyle=`rgba(242,251,255,${alpha})`;
        ctx.beginPath();ctx.ellipse(x,y,size*(1+layer*.15),size*.3,0,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.ellipse(x-size*.38,y-size*.10,size*.6,size*.3,0,0,Math.PI*2);ctx.fill();
      }
    }
  }
  if(h>=6000){
    const starOpacity=Math.min(1,(h-6000)/4000);
    for(let i=0;i<120;i++){
      const x=(i*137.17+41)%w,y=(i*97.23+17+progress*hh*.9)%hh;
      ctx.fillStyle=`rgba(255,255,255,${starOpacity*(.35+(i%4)*.16)})`;
      const r=i%11===0?2:1;ctx.fillRect(x,y,r,r);
    }
  }
  drawFlybys(ctx,w,hh,h,total,atApex);
  const cx=w/2,baseY=total===0?hh*.72:hh*.58;
  const machineY=baseY+(atApex?falling*falling*hh*.77:Math.sin(progress*30)*5);
  // Large converging high-speed streaks; freeze at the apex, none during fall.
  if(flight){
    const intensity=.35+.65*Math.sin(Math.PI*progress*.85);
    ctx.save();ctx.globalCompositeOperation='screen';
    for(let i=0;i<76;i++){
      const a=i*2.3999632297+Math.sin(i*23)*.08;
      const dist=25+((i*67+progress*3200)%Math.max(60,hh*.9));
      const stretch=24+dist*.65;
      const x=cx+Math.cos(a)*dist*.68,y=machineY+Math.sin(a)*dist*1.3;
      const x2=cx+Math.cos(a)*(dist+stretch)*.68,y2=machineY+Math.sin(a)*(dist+stretch)*1.3;
      ctx.strokeStyle=`rgba(${gold?'255,216,96':'178,235,255'},${(.16+(i%5)*.08)*intensity})`;
      ctx.lineWidth=1+(i%4)*.65;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();
    }
    // Repeated shock rings make the ascent feel violent without changing its duration.
    for(let i=0;i<3;i++){
      const t=(progress*8+i/3)%1,rr=24+t*w*.95;
      ctx.strokeStyle=`rgba(255,${gold?'207,72':'245,245'},${(1-t)*.40})`;
      ctx.lineWidth=(1-t)*10;ctx.beginPath();ctx.ellipse(cx,machineY,rr,rr*.4,0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();ctx.translate(cx,machineY);
  const shake=flight?(1-progress)*3:0;
  ctx.translate(Math.sin(progress*135)*shake,Math.cos(progress*171)*shake);
  ctx.rotate(atApex?falling*falling*.42:Math.sin(progress*29)*.075);
  if(flight){
    const tail=ctx.createLinearGradient(0,20,0,190);
    tail.addColorStop(0,gold?'#ffd857b0':'#ffb057c0');tail.addColorStop(1,'#ff581900');
    ctx.fillStyle=tail;ctx.beginPath();ctx.moveTo(-32,25);ctx.lineTo(-11,200);ctx.lineTo(12,200);ctx.lineTo(32,25);ctx.fill();
  }
  ctx.shadowColor=gold?'#ffe168':'#ff4d61';ctx.shadowBlur=flight?28:7;
  ctx.fillStyle='#171428';ctx.fillRect(-62,-45,124,98);
  ctx.fillStyle=gold?'#ffd75b':'#ff5c77';ctx.fillRect(-56,-49,112,87);
  ctx.fillStyle='#fff';ctx.fillRect(-44,-30,88,53);
  ctx.shadowBlur=0;ctx.font='bold 31px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ed2852';ctx.fillText('777',0,-1);
  ctx.fillStyle='#ffc96e';ctx.fillRect(-39,30,78,7);ctx.restore();
  ctx.fillStyle=vignette;ctx.fillRect(0,0,w,hh);
}
function showResult(result){show('resultScreen');$('resultHeadline').textContent=result.is777?'BIG BONUS!':result.height===0?'何しに来たん？':'爆発成功！';$('resultHeight').textContent=result.height.toLocaleString();$('resultTitle').textContent=getTitle(result.height);$('resultDetail').textContent=result.height===0?'STOP操作なし！爆発したけど飛ばなかった。':result.allJust?'3本すべてJUST！伝説の100万m！':`777：${result.is777?'成立！':'不成立'} ／ JUST：${result.errors.filter(e=>e<=JUST).length}本`;refreshBest();sfx('result');$('shareXBtn').disabled=false;rankUI.setResult(result.height);}
const SNAP_MS=180, EXPLOSION_MS=1000;
// An explosion takes over the entire game viewport for one full second.
const explosionLayer=document.createElement('canvas');
explosionLayer.id='explosionLayer';explosionLayer.setAttribute('aria-label','全画面爆発演出');
document.getElementById('app').appendChild(explosionLayer);
function beginExplosion(result){
  show('flightScreen');explosionLayer.classList.add('visible');
  sfx('boom');if(result.is777)sfx('bonus');
  const begin=performance.now(),ctx=explosionLayer.getContext('2d');
  const rand=i=>{const x=Math.sin(i*127.1+78.233)*43758.5453;return x-Math.floor(x)};
  // Multi-layer fireballs, billowing smoke, sparks, debris and a pressure wave.
  function frame(now){
    if(screen!=='flightScreen'){explosionLayer.classList.remove('visible');return}
    const p=Math.min(1,(now-begin)/EXPLOSION_MS),w=explosionLayer.clientWidth,h=explosionLayer.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,2);
    if(explosionLayer.width!==Math.round(w*dpr)||explosionLayer.height!==Math.round(h*dpr)){
      explosionLayer.width=Math.round(w*dpr);explosionLayer.height=Math.round(h*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cx=w/2,cy=h*.46,R=Math.max(w,h);
    const shake=(1-p)*19;
    ctx.save();ctx.translate(Math.sin(p*192)*shake,Math.cos(p*253)*shake);
    ctx.fillStyle='#09070e';ctx.fillRect(-25,-25,w+50,h+50);
    // Dark smoke behind the hot expanding fireball.
    for(let i=0;i<95;i++){
      const a=i*2.3999632297+rand(i)*.9;
      const r=R*(.02+p*(.23+rand(i+91)*.72));
      const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;
      const size=R*(.035+rand(i+12)*.12)*(1+p*.6);
      const g=ctx.createRadialGradient(x,y,0,x,y,size);
      g.addColorStop(0,`rgba(72,53,53,${.5*(1-p*.4)})`);
      g.addColorStop(.6,`rgba(37,32,38,${.55*(1-p*.3)})`);g.addColorStop(1,'#17131b00');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
    }
    // Irregular flame tongues and molten core; avoid a flat single gradient.
    ctx.globalCompositeOperation='screen';
    for(let i=0;i<80;i++){
      const a=i*2.3999632297+rand(i+7)*.55;
      const spread=R*(.05+p*(.08+rand(i+50)*.8));
      const x=cx+Math.cos(a)*spread,y=cy+Math.sin(a)*spread;
      const size=R*(.02+rand(i+5)*.10)*(1+p*.5);
      const hot=rand(i+15)>.56;
      const g=ctx.createRadialGradient(x,y,0,x,y,size);
      g.addColorStop(0,hot?'rgba(255,255,220,.96)':'rgba(255,185,38,.92)');
      g.addColorStop(.42,hot?'rgba(255,174,23,.84)':'rgba(245,69,15,.83)');
      g.addColorStop(1,'rgba(151,20,9,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
    }
    const coreR=R*(.14+.22*Math.min(1,p*2.3));
    const core=ctx.createRadialGradient(cx,cy,0,cx,cy,coreR);
    core.addColorStop(0,p<.25?'#ffffff':'#fff4bb');
    core.addColorStop(.27,'#fff4a6');core.addColorStop(.58,'#ffac20b8');core.addColorStop(1,'#ff330000');
    ctx.fillStyle=core;ctx.fillRect(-25,-25,w+50,h+50);
    // Supersonic expanding ring and dense directional spark trails.
    const ring=R*(.07+p*1.1);
    ctx.strokeStyle=`rgba(255,236,180,${(1-p)*.95})`;ctx.lineWidth=(1-p)*19+1;
    ctx.beginPath();ctx.arc(cx,cy,ring,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<200;i++){
      const a=i*2.3999632297,rad=R*(.05+p*(.18+rand(i+66)*1.4));
      const x=cx+Math.cos(a)*rad,y=cy+Math.sin(a)*rad;
      const length=(8+rand(i+24)*55)*(1+p*1.4);
      ctx.strokeStyle=i%4===0?'#fff9c4':i%4===1?'#ffd15c':i%4===2?'#ff7b26':'#ff3e1b';
      ctx.lineWidth=.8+rand(i+36)*3.5;ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+Math.cos(a)*length,y+Math.sin(a)*length);ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
    // The full-screen blast remains visible for the entire requested second.
    if(p<.18){ctx.fillStyle=`rgba(255,255,245,${(.18-p)*2.5})`;ctx.fillRect(-25,-25,w+50,h+50)}
    ctx.restore();
    if(p<1){explosionRaf=requestAnimationFrame(frame)}else{
      explosionLayer.classList.remove('visible');
      document.getElementById('bigBanner').classList.toggle('visible',result.is777);
      beginFlight(result);
    }
  }
  explosionRaf=requestAnimationFrame(frame);
}
const reelCanvas=$('reels'),rctx=reelCanvas.getContext('2d');
function renderReels(now=performance.now()){
  if(!state)return;
  const dpr=Math.min(devicePixelRatio||1,2),w=reelCanvas.clientWidth,h=reelCanvas.clientHeight;
  if(!w||!h)return;
  if(reelCanvas.width!==Math.round(w*dpr)||reelCanvas.height!==Math.round(h*dpr)){
    reelCanvas.width=Math.round(w*dpr);reelCanvas.height=Math.round(h*dpr);
  }
  rctx.setTransform(dpr,0,0,dpr,0,0);rctx.clearRect(0,0,w,h);
  const cw=w/3,sy=h/3;
  for(let i=0;i<3;i++){
    const stop=state.stops[i];let t=stop?.t??state.elapsed;
    if(stop){
      const p=phase(stop.t),center=Math.floor((p+STEP/2)/STEP),target=center*STEP;
      // Fast easing to the closest symbol. Score remains tied to stop.t.
      const k=Math.min(1,Math.max(0,(now-stop.visualStart)/SNAP_MS));
      const smooth=1-Math.pow(1-k,3);
      const adjustment=((target-p+PERIOD+PERIOD/2)%PERIOD)-PERIOD/2;
      t=stop.t+adjustment*smooth;
    }
    // Symbols visually travel TOP -> BOTTOM as time advances.
    const position=phase(t)/STEP,nearest=Math.round(position),offset=position-nearest;
    for(let j=-2;j<=2;j++){
      const idx=((nearest-j)%5+5)%5,y=h/2+(j+offset)*sy;
      const symbol=SYMBOLS[idx];
      rctx.font=symbol==='7'?`1000 ${Math.floor(sy*.65)}px system-ui`:symbol==='BAR'?`1000 ${Math.floor(sy*.34)}px system-ui`:`${Math.floor(sy*.60)}px system-ui, Apple Color Emoji, Segoe UI Emoji`;
      rctx.textAlign='center';rctx.textBaseline='middle';
      rctx.fillStyle=symbol==='7'?'#ed2852':symbol==='BAR'?'#25283b':'#44547b';
      rctx.fillText(symbol,cw*(i+.5),y,cw*.92);
    }
    rctx.fillStyle='#443a6655';rctx.fillRect(i*cw,0,1,h);
  }
  rctx.strokeStyle='#f7b23e';rctx.lineWidth=3;rctx.strokeRect(1,h/2-sy/2,w-2,sy);
  const grad=rctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'#ffffffd8');grad.addColorStop(.25,'#ffffff00');
  grad.addColorStop(.75,'#ffffff00');grad.addColorStop(1,'#ffffffd8');
  rctx.fillStyle=grad;rctx.fillRect(0,0,w,h);
}
function pause(){if(state&&!state.ended&&screen==='gameScreen'&&!state.paused){state.elapsed=Math.min(LIMIT,state.elapsed+Math.max(0,performance.now()-state.last));state.paused=true;cancelAnimationFrame(raf)}}function resume(){if(state&&!state.ended&&screen==='gameScreen'&&state.paused){state.paused=false;state.last=performance.now();if(state.elapsed>=LIMIT){for(let i=0;i<3;i++)if(state.stops[i]===null)state.stops[i]={t:LIMIT,auto:true,visualStart:performance.now()};finish()}else raf=requestAnimationFrame(tick)}}
document.addEventListener('visibilitychange',()=>document.hidden?pause():resume());window.addEventListener('blur',pause);window.addEventListener('focus',resume);
$('startBtn').onclick=start;$('retryBtn').onclick=start;
$('shareXBtn').onclick=()=>{
  if(!lastResult)return;
  const h=lastResult.height.toLocaleString('ja-JP');
  const title=getTitle(lastResult.height);
  const message=`『スロットを爆発せよ！』で${h}m飛ばした！\n称号：${title}\n\n#スロット爆発 #ゲーム開発 #gamedev`;
  const url=new URL('https://twitter.com/intent/tweet');
  url.searchParams.set('text',message);
  url.searchParams.set('url','https://asobeatapps-ops.github.io/slot_bakuhatu/');
  window.open(url.toString(),'_blank','noopener,noreferrer');
};document.querySelectorAll('.stop').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();stop(Number(b.dataset.reel))}));$('homeBtn').onclick=()=>{show('titleScreen');refreshBest()};$('soundBtn').onclick=()=>{sound=!sound;localStorage.setItem('slotSound',sound?'on':'off');$('soundBtn').textContent=sound?'♪ ON':'♪ OFF'};
function showRank(from){backFromRank=from;rankUI.open()}
$('titleRankBtn').onclick=()=>showRank('titleScreen');$('resultRankBtn').onclick=()=>showRank('resultScreen');
init();
