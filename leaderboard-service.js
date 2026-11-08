// Shared browser client. Firebase projects and browser identities are separate per game.
async function loadFirebase() {
  const modules = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
  ]);
  return Object.assign({}, ...modules);
}

export function createLeaderboard({config, gameId, maxScore, loadSDK=loadFirebase,
  storage, timeoutMs=12000}) {
  try { storage ??= globalThis.localStorage; } catch {}
  const prefix=`asobeat-ranking:${config.projectId || 'unconfigured'}:${gameId}:`;
  let ready, signingIn, submitting;
  const configured=()=>['apiKey','authDomain','projectId','appId'].every(key=>typeof config[key]==='string'&&config[key].trim());
  const read=key=>{try{return JSON.parse(storage.getItem(prefix+key)||'null')}catch{return null}};
  const write=(key,value)=>{try{storage.setItem(prefix+key,JSON.stringify(value));return true}catch{return false}};
  const normalizeName=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,16)||'匿名プレイヤー';
  const validScore=score=>Number.isSafeInteger(score)&&score>=0&&score<=maxScore;
  const name=()=>normalizeName(read('name'));
  function deadline(promise) {
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('通信がタイムアウトしました。'),{code:'ranking/timeout'})),timeoutMs)})]).finally(()=>clearTimeout(timer));
  }
  async function services() {
    if(!configured())throw Object.assign(new Error('オンラインランキングは準備中です。'),{code:'ranking/unconfigured'});
    if(!ready)ready=(async()=>{
      const sdk=await loadSDK();
      const appName='asobeat-ranking-'+gameId;
      const app=sdk.getApps?.().find(app=>app.name===appName)||sdk.initializeApp(config,appName);
      const auth=sdk.getAuth(app),db=sdk.getFirestore(app);
      await auth.authStateReady();
      return {sdk,auth,db};
    })().catch(error=>{ready=null;throw error});
    return ready;
  }
  async function identify(s) {
    if(s.auth.currentUser)return s.auth.currentUser.uid;
    if(!signingIn)signingIn=s.sdk.signInAnonymously(s.auth).finally(()=>{signingIn=null});
    return (await signingIn).user.uid;
  }
  async function send(record) {
    const s=await services(),uid=await identify(s);
    const ref=s.sdk.doc(s.db,'leaderboard',uid);
    const result=await s.sdk.runTransaction(s.db,async transaction=>{
      const snapshot=await transaction.get(ref),previous=snapshot.exists()?snapshot.data():null;
      const improved=!previous||record.score>previous.score;
      const best=improved?record.score:previous.score;
      if(improved||previous.name!==record.name)transaction.set(ref,{
        name:record.name,score:best,
        achievedAt:improved?s.sdk.serverTimestamp():previous.achievedAt
      });
      return {uid,name:record.name,score:best,improved};
    },{maxAttempts:3});
    const pending=read('pending');
    if(pending?.id===record.id){try{storage.removeItem(prefix+'pending')}catch{}}
    return result;
  }
  async function submitBest(score,displayName) {
    if(!validScore(score))throw Object.assign(new Error('この記録は登録できません。'),{code:'ranking/invalid-score'});
    if(!configured())return deadline(services());
    if(submitting)return submitting;
    const previous=read('pending');
    const record={id:Date.now()+'-'+Math.random().toString(36).slice(2),
      score:previous&&validScore(previous.score)?Math.max(score,previous.score):score,
      name:normalizeName(displayName)};
    write('name',record.name);
    const queued=write('pending',record);
    submitting=deadline(send(record)).catch(error=>{error.queued=queued;throw error}).finally(()=>{submitting=null});
    return submitting;
  }
  async function loadTop() {
    return deadline((async()=>{
      const {sdk,db,auth}=await services();
      const snapshot=await sdk.getDocs(sdk.query(sdk.collection(db,'leaderboard'),
        sdk.orderBy('score','desc'),sdk.orderBy('achievedAt','asc'),sdk.limit(100)));
      return snapshot.docs.map(doc=>({...doc.data(),uid:doc.id,isMe:doc.id===auth.currentUser?.uid}))
        .filter(record=>validScore(record.score)&&typeof record.name==='string');
    })());
  }
  function publicError(error) {
    if(error?.code==='ranking/unconfigured')return 'オンラインランキングは準備中です。端末内の自己ベストは引き続き利用できます。';
    if(error?.code==='ranking/invalid-score')return error.message;
    if(/permission-denied|failed-precondition|operation-not-allowed|api-key|unauthorized-domain/.test(error?.code||''))return '現在ランキングを利用できません。しばらくしてから再試行してください。';
    return error?.queued?'通信できませんでした。送信待ちの記録をこのブラウザに保存しました。「再試行」で登録できます。':'通信できませんでした。ネット接続を確認して再試行してください。';
  }
  return {configured,submitBest,loadTop,publicError,name,validScore};
}
