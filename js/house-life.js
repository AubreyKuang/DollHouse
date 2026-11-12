function countHouseDay(kind, label) {
  const counters = (G.daily[kind] ||= {});
  const count=Object.hasOwn(counters,label)?counters[label]:0;
  Object.defineProperty(counters,label,{value:count+1,enumerable:true,writable:true,configurable:true});
}

function houseRelations(){
  return Object.fromEntries(Object.entries(G.rel).map(([key,value])=>[key,value.f]));
}

function finishHouseDay() {
  const lines = [`第 ${G.day} 天 · ${WEEKDAYS[weekday(G.day)]}`];
  const labels = { social:'社交', meal:'用餐', study:'书桌', audience:'钢琴围观', partners:'游戏伙伴', groom:'整理仪容' };
  for (const [kind,title] of Object.entries(labels)) {
    const top = Object.entries(G.daily[kind] || {}).sort((a,b)=>b[1]-a[1])[0];
    if (top) lines.push(`${title}　${top[0]} · ${top[1]} 次`);
  }
  const now=houseRelations();
  for(const [key,friendship] of Object.entries(now)){
    const delta=friendship-(G.dayRelations[key]??friendship);
    if(Math.abs(delta)<8)continue;
    const people=key.split('|').map(id=>G.dolls.find(person=>person.pid===id)?.name);
    if(people.every(Boolean))lines.push(`关系变化　${people.join('与')}：友好 ${delta>0?'+':''}${Math.round(delta)}`);
  }
  G.dayRelations=now;
  for (const entry of G.log.filter(entry=>entry.d===G.day).slice(-8)) lines.push(entry.text);
  if (lines.length===1) lines.push('今天小屋里很安静。');
  G.paper.push(lines.join('\n'));
  if (G.paper.length>30) G.paper.shift();
  G.daily={};
  if (document.getElementById('paperAuto')?.checked) showHousePaper();
}

function showHousePaper() {
  const dialog=document.getElementById('paperDialog');
  document.getElementById('paperText').textContent=G.paper.slice(-7).reverse().join('\n\n')||'今晚结束后会生成第一份日报。';
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
