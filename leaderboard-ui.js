export function createLeaderboardUI({api,formatScore,open,close}) {
  const $=id=>document.getElementById(id);
  let result=null,eligible=true,epoch=0,requestId=0;
  $('rankName').value=api.name();
  function setResult(score,{allowed=true}={}) {
    result=score;eligible=allowed;epoch++;
    $('registerRank').disabled=!allowed||!api.configured();
    $('registerRank').textContent='この記録をランキングに登録';
    $('rankName').disabled=!allowed;
    $('rankStatus').textContent=!allowed?'テストプレイの記録は登録できません。':
      api.configured()?'表示名を確認して、登録ボタンを押してください。':'オンラインランキングは準備中です。自己ベストはこの端末に保存されます。';
  }
  $('rankForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!eligible||result===null||$('registerRank').disabled)return;
    const version=epoch,score=result,name=$('rankName').value;
    $('registerRank').disabled=true;$('registerRank').textContent='登録中…';
    $('rankStatus').textContent='記録を送信しています…';
    try {
      const record=await api.submitBest(score,name);
      if(version!==epoch)return;
      $('rankName').value=record.name;
      $('rankStatus').textContent='登録しました。公開中の自己ベスト：'+formatScore(record.score);
      $('registerRank').textContent='登録済み（表示名を変更して再登録できます）';
    } catch(error) {
      if(version!==epoch)return;
      console.info('ASOBEAT leaderboard:',error.code||error.message);
      $('rankStatus').textContent=api.publicError(error);$('registerRank').textContent='再試行';
    } finally {
      if(version===epoch)$('registerRank').disabled=!api.configured();
    }
  });
  async function refresh() {
    const request=++requestId;
    $('rankingNote').textContent='ランキングを読み込んでいます…';
    $('rankingList').replaceChildren();$('rankingReload').disabled=true;
    try {
      const records=await api.loadTop();
      if(request!==requestId)return;
      $('rankingNote').textContent=records.length?'自己ベスト順。表示名は他のプレイヤーにも公開されます。':'まだ記録がありません。最初の記録を登録しよう！';
      let rank=0,previous=null;
      records.forEach((record,index)=>{
        if(record.score!==previous)rank=index+1;
        previous=record.score;
        const row=document.createElement('div');row.className='rank-item'+(record.isMe?' rank-me':'');row.setAttribute('role','listitem');
        const position=document.createElement('strong'),name=document.createElement('span'),score=document.createElement('b');
        position.textContent=rank+'位';name.textContent=record.name+(record.isMe?'（あなた）':'');score.textContent=formatScore(record.score);
        row.append(position,name,score);$('rankingList').append(row);
      });
    } catch(error) {
      if(request!==requestId)return;
      console.info('ASOBEAT leaderboard:',error.code||error.message);
      $('rankingNote').textContent=api.publicError(error);
    } finally {
      if(request===requestId)$('rankingReload').disabled=false;
    }
  }
  $('rankingReload').addEventListener('click',refresh);
  $('rankingBack').addEventListener('click',()=>{requestId++;close()});
  return {setResult,open:()=>{open();void refresh()},refresh};
}
