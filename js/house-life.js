function formatSavedPaper(paper) {
  return paper.replace(/^第 (\d+) 天 · [^\n]+/, (_, cycle) => monthLabel(Number(cycle)));
}

function countHouseActivity(kind, label) {
  const counters = (G.daily[kind] ||= {});
  const count=Object.hasOwn(counters,label)?counters[label]:0;
  Object.defineProperty(counters,label,{value:count+1,enumerable:true,writable:true,configurable:true});
}

function houseRelations(){
  return Object.fromEntries(Object.entries(G.rel).map(([key,value])=>[key,value.f]));
}

function helpWithMeal(d, table) {
  const guest=table.users.find(person=>person!==d&&person.state==='act'&&person.needs.hunger<35);
  if(!guest)return;
  guest.needs.hunger=Math.min(100,guest.needs.hunger+10);
  const text=`${d.name} 给饿着的 ${guest.name} 分了一份晚饭`;
  NPCMemory.record(G,{type:'meal-help',time:absNow(),participants:[d.pid,guest.pid],outcome:'shared'},[
    {person:guest.pid,subject:d.pid,emotion:.85,impact:90,interpretation:`我饿着的时候，${d.name} 给我分了晚饭`},
    {person:d.pid,subject:guest.pid,emotion:.45,impact:55,interpretation:`我给 ${guest.name} 分了晚饭`}
  ]);
  addLog(`🍲 ${text}`);
}

function finishHouseMonth() {
  const lines = [monthLabel(G.day)];
  const labels = { social:'社交', meal:'用餐', study:'书桌', audience:'钢琴围观', partners:'游戏伙伴', groom:'整理仪容', chess:'棋友', routine:'住户日常' };
  for (const [kind,title] of Object.entries(labels)) {
    const top = Object.entries(G.daily[kind] || {}).sort((a,b)=>b[1]-a[1])[0];
    if (top) lines.push(`${title}　${top[0]} · ${top[1]} 次`);
  }
  const now=houseRelations();
  for(const [key,friendship] of Object.entries(now)){
    const delta=friendship-(G.dayRelations[key]??friendship);
    if(!Number.isFinite(delta)||Math.abs(delta)<8)continue;
    const people=key.split('|').map(id=>G.dolls.find(person=>person.pid===id)?.name);
    if(people.every(Boolean))lines.push(`关系变化　${people.join('与')}：友好 ${delta>0?'+':''}${Math.round(delta)}`);
  }
  G.dayRelations=now;
  for (const entry of G.log.filter(entry=>entry.d===G.day).slice(-8)) lines.push(entry.text);
  const residents=G.dolls.filter(d=>d.state!=='away');
  if(residents.length>=2&&residents.every(d=>d.heart==='fickle')&&G.log.some(e=>e.d===G.day&&/表白|暧昧|分手/.test(e.text)))lines.push('小屋趣闻　花心室友们本月把日子过成了恋综。');
  if(residents.length>=2&&residents.every(d=>d.mbti?.startsWith('I'))&&!Object.keys(G.daily.social||{}).length)lines.push('小屋趣闻　内向的室友们本月各忙各的，小屋格外安静。');
  if (lines.length===1) lines.push('本月小屋里很安静。');
  G.paper.push(lines.join('\n'));
  if (G.paper.length>30) G.paper.shift();
  G.daily={};
  updateHousePaperButton();
  if (document.getElementById('paperAuto')?.checked) showHousePaper();
}

function updateHousePaperButton(){
  const button=document.getElementById('dailyPaper');
  if(button)button.textContent=G.paper.length?`📰 小屋月报 · ${G.paper.length}`:'📰 小屋月报';
}

function showHousePaper() {
  const dialog=document.getElementById('paperDialog');
  document.getElementById('paperText').textContent=G.paper.slice().reverse().join('\n\n')||`${monthLabel(G.day)}的月报将在下月 00:00 生成。可以用顶部的 ⏩ 快进，之后随时从「小屋月报」回看。`;
  document.getElementById('paperCopy').disabled=!G.paper.length;
  if (!dialog.open) dialog.showModal();
}

function shareHouseNews(speaker, listener) {
  if (rel(speaker,listener).f<45) return;
  const now=absNow();
  const heard=NPCMemory.recall(G,listener.pid);
  const source=NPCMemory.recall(G,speaker.pid).find(entry=>
    entry.channel==='witness'&&now-entry.time>=360&&entry.subject!==listener.pid&&
    !heard.some(memory=>memory.sources.some(id=>id===entry.sources[0]||G.npcMemory.events[id]?.original===entry.sources[0])));
  if(!source)return;
  const misunderstood=Math.random()<.25;
  NPCMemory.record(G,{type:'rumor',time:now,participants:[speaker.pid,listener.pid],original:source.sources[0],outcome:'retold'},[
    {person:listener.pid,subject:source.subject,channel:'hearsay',confidence:misunderstood?.35:.65,
      emotion:source.emotion,impact:65,interpretation:misunderstood?'听说有人闹得很厉害，但详情我也不确定。':`听${speaker.name}说：${source.interpretation}`}
  ]);
  addLog(`💬 ${speaker.name} 向 ${listener.name} 说起了一件旧事`);
}
