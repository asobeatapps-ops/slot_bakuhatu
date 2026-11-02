import {firebaseConfigured,submitBest,loadTop,updateDisplayName,flushPending} from './ranking.js';
const $=id=>document.getElementById(id), SYMBOLS=['7','BAR','🔔','🍒','🍉'], PERIOD=800, STEP=160, LIMIT=15000, JUST=5;
const TITLES=[[10,'ただの爆発好き'],[100,'ご近所迷惑'],[500,'屋根より高いスロット'],[1000,'雲に謝れ'],[3000,'飛びすぎ注意報'],[5000,'天空の無職'],[8000,'地球から出禁'],[10000,'空気がないんだが'],[25000,'宇宙に不法侵入'],[50000,'NASA困惑'],[100000,'宇宙でもパチスロ'],[200000,'地球を置いてきた'],[400000,'月にパチ屋を建てる男'],[700000,'宇宙の問題児'],[1000000,'神すら目押しで超えた']];
const getTitle=h=>h===0?'何しに来たん？':TITLES.reduce((a,x)=>h>=x[0]?x[1]:a,TITLES[0][1]);
const localBest=()=>Number(localStorage.getItem('slotBest')||0);
let sound=localStorage.getItem('slotSound')!=='off',audioCtx=null,screen='titleScreen',state=null,raf=0,flightRaf=0,lastFrame=0;
let lastResult=null,backFromRank='titleScreen',finishTimer=0,explosionRaf=0;
function tone(freq,duration,type='sine',volume=.12,delay=0){if(!sound)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),t=audioCtx.currentTime+delay;osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain).connect(audioCtx.destination);osc.start(t);osc.stop(t+duration+.02)}catch{}}
function sfx(name){if(name==='stop')tone(240,.1,'square',.09);if(name==='just'){tone(780,.3,'triangle',.14);tone(1180,.2,'sine',.1,.08)}if(name==='boom'){tone(100,.8,'sawtooth',.2);tone(56,.7,'triangle',.18)}if(name==='bonus'){[660,880,1100,1440].forEach((n,i)=>tone(n,.18,'triangle',.12,i*.12))}if(name==='result')tone(660,.2,'triangle',.12)}
function show(id){screen=id;document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id===id));}
function refreshBest(){$('titleBest').textContent=localStorage.getItem('slotHasBest')?localBest().toLocaleString()+'m':'—';$('hudBest').textContent=localBest().toLocaleString()+'m'}
function init(){refreshBest();$('soundBtn').textContent=sound?'♪ ON':'♪ OFF';$('playerName').value=localStorage.getItem('slotName')||'';flushPending().catch(()=>{});show('titleScreen')}
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
  $('flightSub').textContent=result.height===0?'何しに来たん？':'ぶっ飛べ！！';
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
    $('flightSub').textContent=atApex?'落下中！！':result.height===0?'何しに来たん？':'ぶっ飛べ！！';
    drawFlight(ctx,canvas,ascent,height,result.height,result.is777,falling,atApex);
    if(elapsed<duration)flightRaf=requestAnimationFrame(frame);
    else showResult(result);
  }
  flightRaf=requestAnimationFrame(frame);
}
function drawFlight(ctx,canvas,p,h,total,gold,falling=0,atApex=false){
  const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth,hh=canvas.clientHeight;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(hh*dpr)){
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(hh*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const sky=h<1000?['#6bc7ff','#d5f5ff']:h<10000?['#2365ba','#98d7fa']:['#090824','#19113e'];
  const gr=ctx.createLinearGradient(0,0,0,hh);gr.addColorStop(0,sky[0]);gr.addColorStop(1,sky[1]);
  ctx.fillStyle=gr;ctx.fillRect(0,0,w,hh);
  // During the one-second fall, scenery and camera are frozen at the apex.
  const sceneMotion=atApex?1:p;
  if(h>=10000){
    ctx.fillStyle='#ffffffbb';for(let i=0;i<70;i++){
      const x=(i*113.7)%w,y=(i*67.9+sceneMotion*220)%hh;ctx.fillRect(x,y,1.8,1.8);
    }
  }else{
    ctx.fillStyle='#ffffff99';for(let i=0;i<8;i++){
      const x=(i*93+20)%w,y=((i*125+sceneMotion*850)%(hh+150))-70;
      ctx.beginPath();ctx.ellipse(x,y,50,18,0,0,Math.PI*2);ctx.fill();
    }
  }
  if(h<1000){ctx.fillStyle='#55586c';for(let i=0;i<14;i++){
    const x=i*w/13,base=hh-((i*41)%110);ctx.fillRect(x,base,w/14,hh-base);
  }}
  // y = y0 + 1/2*a*t^2: smooth gravitational acceleration from zero velocity.
  // The camera stays still; only the slot machine descends.
  const y0=total===0?hh*.72:hh*.62;
  const y=y0+(atApex?falling*falling*hh*.70:Math.sin(p*25)*6);
  ctx.save();ctx.translate(w/2,y);
  ctx.rotate(atApex?falling*falling*.42:Math.sin(p*28)*.07);
  ctx.fillStyle='#2c204b';ctx.fillRect(-58,-43,116,89);
  ctx.fillStyle=gold?'#ffd75b':'#ff5c77';ctx.fillRect(-54,-47,108,83);
  ctx.fillStyle='#fff';ctx.fillRect(-42,-29,84,51);
  ctx.font='bold 32px system-ui';ctx.textAlign='center';ctx.fillStyle='#ef3148';ctx.fillText('777',0,9);ctx.restore();
  if(!atApex&&p<.16){const r=30+p*800;ctx.strokeStyle=gold?'#ffdb56':'#ff9b46';ctx.lineWidth=9*(1-p/.16);ctx.beginPath();ctx.arc(w/2,y,r,0,Math.PI*2);ctx.stroke()}
  if(total>0&&!atApex){ctx.strokeStyle='#ffffff80';ctx.lineWidth=3;for(let i=0;i<14;i++){
    const x=(i*79)%w;ctx.beginPath();ctx.moveTo(x,((i*91+p*1200)%hh));ctx.lineTo(x,((i*91+p*1200)%hh)+50);ctx.stroke();
  }}
}
async function showResult(result){show('resultScreen');$('resultHeadline').textContent=result.is777?'BIG BONUS!':result.height===0?'何しに来たん？':'爆発成功！';$('resultHeight').textContent=result.height.toLocaleString();$('resultTitle').textContent=getTitle(result.height);$('resultDetail').textContent=result.height===0?'STOP操作なし！爆発したけど飛ばなかった。':result.allJust?'3本すべてJUST！伝説の100万m！':`777：${result.is777?'成立！':'不成立'} ／ JUST：${result.errors.filter(e=>e<=JUST).length}本`;refreshBest();sfx('result');$('rankStatus').textContent='ランキングを更新中…';$('shareXBtn').disabled=false;try{const r=await submitBest(result.height,getTitle(result.height));if(screen==='resultScreen')$('rankStatus').textContent=r.message}catch{if(screen==='resultScreen')$('rankStatus').textContent='通信できません。記録を保存し、次回起動時に再送します。'}}
const SNAP_MS=180, EXPLOSION_MS=1000;
// An explosion takes over the entire game viewport for one full second.
const explosionLayer=document.createElement('canvas');
explosionLayer.id='explosionLayer';explosionLayer.setAttribute('aria-label','全画面爆発演出');
document.getElementById('app').appendChild(explosionLayer);
function beginExplosion(result){
  show('flightScreen');explosionLayer.classList.add('visible');
  sfx('boom');if(result.is777)sfx('bonus');
  const begin=performance.now(),ctx=explosionLayer.getContext('2d');
  function frame(now){
    const p=Math.min(1,(now-begin)/EXPLOSION_MS),w=explosionLayer.clientWidth,h=explosionLayer.clientHeight;
    const dpr=Math.min(devicePixelRatio||1,2);
    if(explosionLayer.width!==Math.round(w*dpr)||explosionLayer.height!==Math.round(h*dpr)){
      explosionLayer.width=Math.round(w*dpr);explosionLayer.height=Math.round(h*dpr);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const cx=w/2,cy=h*.45,shake=(1-p)*15;
    ctx.save();ctx.translate(Math.sin(p*153)*shake,Math.cos(p*193)*shake);
    ctx.fillStyle=result.is777?'#2b0d03':'#200a1b';ctx.fillRect(-20,-20,w+40,h+40);
    const radius=Math.max(w,h)*(0.25+p*1.5);
    const glow=ctx.createRadialGradient(cx,cy,5,cx,cy,radius);
    glow.addColorStop(0,'#fffef0');glow.addColorStop(.14,result.is777?'#fff5a3':'#fff1d1');
    glow.addColorStop(.42,result.is777?'#ffbd18':'#ff7e16');
    glow.addColorStop(.72,'#ed2414');glow.addColorStop(1,'#3c0915');
    ctx.fillStyle=glow;ctx.fillRect(-20,-20,w+40,h+40);
    for(let i=0;i<110;i++){
      const a=i*2.3999632297,dist=(.12+p*1.4)*Math.max(w,h)*(0.15+(i%17)/17);
      const x=cx+Math.cos(a)*dist,y=cy+Math.sin(a)*dist;
      ctx.strokeStyle=i%3===0?'#fff9d0':i%3===1?'#ffb32b':'#ff4627';
      ctx.lineWidth=2+(i%5);ctx.beginPath();ctx.moveTo(x,y);
      ctx.lineTo(x+Math.cos(a)*(12+25*p),y+Math.sin(a)*(12+25*p));ctx.stroke();
    }
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='#ff4b00';ctx.shadowBlur=30;
    ctx.font=`1000 ${Math.min(w*.17,72)}px system-ui`;
    ctx.lineWidth=7;ctx.strokeStyle='#8b1700';ctx.strokeText('大爆発!!',cx,cy,w*.95);
    ctx.fillStyle='#fff7b6';ctx.fillText('大爆発!!',cx,cy,w*.95);
    ctx.restore();
    if(p<1){explosionRaf=requestAnimationFrame(frame)}else{
      explosionLayer.classList.remove('visible');
      // BIG BONUS banner appears AFTER the full-screen explosion, on the ascent scene.
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
async function showRank(from){backFromRank=from;show('rankingScreen');$('rankingList').textContent='読み込み中…';$('rankingNote').textContent=firebaseConfigured()?'オンラインランキング':'Firebase未設定：ローカル記録のみ利用できます。';try{const list=await loadTop();$('rankingList').replaceChildren();if(!list.length){$('rankingList').textContent='ランキング記録はまだありません。';return}list.forEach((x,i)=>{const row=document.createElement('div');row.className='rank-item';const pos=document.createElement('strong'),name=document.createElement('span'),height=document.createElement('b');pos.textContent=String(i+1);name.textContent=x.name||'匿名プレイヤー';height.textContent=Number(x.bestHeight).toLocaleString()+'m';row.append(pos,name,height);$('rankingList').append(row)})}catch{$('rankingList').textContent='ランキングを取得できませんでした。'}}
$('titleRankBtn').onclick=()=>showRank('titleScreen');$('resultRankBtn').onclick=()=>showRank('resultScreen');$('rankBackBtn').onclick=()=>show(backFromRank);$('saveNameBtn').onclick=async()=>{const name=$('playerName').value.trim().slice(0,16)||'匿名プレイヤー';localStorage.setItem('slotName',name);$('rankingNote').textContent='名前を保存しました。';try{await updateDisplayName(name)}catch{};showRank(backFromRank)};
init();
