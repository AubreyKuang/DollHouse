function formatSavedPaper(paper) {
  if (typeof paper !== 'string') return paper;
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
  shareMeal(d, guest, '晚饭', 10);
}

function shareCookedMeal(cook) {
  if (cook.guest) return;
  const caring = cook.persona === 'foodie' || ['ISFJ', 'ESFJ', 'ENFJ', 'INFP'].includes(mb(cook));
  const hungry = residents().filter(person => person !== cook &&
    person.money < PRICES.snack && person.needs.hunger < 35 &&
    person.state !== 'away' && person.state !== 'lift' && !lying(person) &&
    !['meal', 'snack', 'cook', 'picnic'].includes(person.act?.type) &&
    canSee(cook, person) && canDisturb(cook, person) &&
    (caring || arePartners(cook, person) || rel(cook, person).f >= 50));
  hungry.sort((a, b) => a.needs.hunger - b.needs.hunger);
  const guest = hungry[0];
  if (!guest) return;
  shareMeal(cook, guest, '刚做好的饭', 28);
  say(cook, '多做了一份，趁热吃吧。');
  say(guest, '谢谢你，我正饿着呢。');
}

function shareMeal(host, guest, food, gain) {
  guest.needs.hunger = Math.min(100, guest.needs.hunger + gain);
  NPCMemory.record(G, { type: 'meal-help', time: absNow(), participants: [host.pid, guest.pid], outcome: 'shared' }, [
    { person: guest.pid, subject: host.pid, emotion: .85, impact: 90, interpretation: `我饿着的时候，${host.name} 给我分了${food}` },
    { person: host.pid, subject: guest.pid, emotion: .45, impact: 55, interpretation: `我给 ${guest.name} 分了${food}` }
  ]);
  addLog(`🍲 ${host.name} 给饿着的 ${guest.name} 分了一份${food}`);
  if (typeof addTrust === 'function') addTrust(guest, host, 10);
}

const PAPER_EVENTS = [
  [/晚归后吃完了.+留的饭|当面谢谢.+留下的饭/, '回家有盏灯', '🕯', 79],
  [/在家一起吃顿饭|在家围坐讲故事|在家开了一场小小音乐会/, '小屋时光', '🏡', 81],
  [/分手|变心/, '关系转折', '💔', 105],
  [/撞见|闹翻/, '关系转折', '💢', 100],
  [/在一起了/, '感情动态', '💕', 95],
  [/表白|偷偷暧昧/, '感情动态', '💗', 90],
  [/搬进来|入住申请|搬走了/, '新面孔', '🏡', 82],
  [/成了.*搭子|成为挚友/, '新交情', '🤝', 76],
  [/又下雨了.+书房/, '两人的小传统', '🫖', 85],
  [/一起做成了.+花架/, '一起做的小物', '🪴', 83],
  [/有了自己的.+角|习惯给彼此留个位置/, '小屋里的习惯', '📖', 64],
  [/生日/, '小屋庆祝', '🎂', 72],
  [/野餐搬进|撑伞|雨里继续野餐|野餐重新开场|收起野餐篮|安静的书房聊熟/, '雨天插曲', '🌧', 74],
  [/邻居.*(面包|螺丝刀|回赠|约.+家里|吃完一顿饭)/, '邻里往来', '🍞', 65],
  [/派对|邀请.+来玩|参加院子野餐/, '串门聚会', '🎉', 68],
  [/迎了迎刚回家的/, '回家聊聊', '🏠', 48],
  [/给饿着的|帮忙付了|终于去找了份工作|画卖出去了/, '生活片段', '🌷', 63],
  [/碰面时.+尴尬|谈起了那段感情/, '相处余波', '😶', 69],
  [/听成了|吵了一架/, '小屋插曲', '💬', 58],
  [/一起荡秋千|一起拼拼图|一起在院子里野餐|一起吃饭|下了一局棋|弹起了钢琴/, '一起玩', '🎵', 54],
];

function paperLogStory(text) {
  const match = PAPER_EVENTS.find(([pattern]) => pattern.test(text));
  if (!match) return null;
  const [, label, icon, score] = match;
  return { label, icon, score, text: text.replace(/^\s*[^\p{L}\p{N}]+/u, '').trim() };
}

function paperCast(text) {
  // Prefer the longest name at each position, so 小桃 is not counted again as 桃.
  const people = [...new Map([...(G.community?.friends || []), ...G.dolls].map(d => [d.pid, d])).values()]
    .filter(d => d.name && d.look).sort((a, b) => b.name.length - a.name.length);
  const names = [...new Set(people.map(d => d.name))];
  const cast = [];
  for (let i = 0; i < text.length && cast.length < 3; i++) {
    const name = names.find(n => text.startsWith(n, i));
    if (!name) continue;
    const matches = people.filter(d => d.name === name);
    if (matches.length === 1 && !cast.some(d => d.name === name)) cast.push({ name, look: { ...matches[0].look } });
    i += name.length - 1;
  }
  return cast;
}

// Only a resolved player introduction can seed a follow-up. Matching names or
// later activity logs alone never establish a link.
function recordPaperMeeting(a, b, kind, outcome) {
  const pair = `${a.name}和${b.name}`;
  const action = { chat: '聊了起来', joke: '开起了玩笑', hug: '抱了抱对方', kiss: '亲了亲对方', argue: '吵了一架', flirt: '聊起了彼此的心意' }[kind];
  const result = {
    together: ['感情动态', '💕', `${pair}确认了恋人关系。`, 110],
    breakup: ['关系转折', '💔', `${pair}分手了。`, 114],
    rejected: ['感情动态', '💌', `${a.name}的表白没被${b.name}接受。`, 96],
    argued: ['小屋插曲', '💢', `${pair}被拉到一起后，吵了一架。`, 66],
  }[outcome];
  const moments = (G.paperMoments ||= []);
  for (const old of moments) if (old.ids.includes(a.pid) && old.ids.includes(b.pid)) old.pending = false;
  const steps = [`你把${a.name}拖到了${b.name}身边。`, `${pair}${action}。`];
  if (result && outcome !== 'argued') steps.push(result[2]);
  moments.push({
    ids: [a.pid, b.pid], people: [a, b].map(d => ({ name: d.name, look: { ...d.look } })),
    month: G.day, until: absNow() + 180, pending: outcome !== 'rejected' && outcome !== 'argued' && outcome !== 'breakup',
    steps, result,
  });
  if (moments.length > 24) moments.shift();
}

const PAPER_SHARED_USES = new Set(['swing', 'puzzle', 'picnic', 'chess']);
const paperMomentPending = moment => moment.pending && moment.month === G.day && absNow() <= moment.until;

function paperFollowup(d, f) {
  if (!PAPER_SHARED_USES.has(FURNITURE[f.id].use) || !f.users.length) return null;
  return G.paperMoments?.findLast(moment => paperMomentPending(moment) && moment.ids.includes(d.pid) &&
    f.users.some(other => other !== d && other.state === 'act' && other.act?.furn === f && moment.ids.includes(other.pid))) || null;
}

function completePaperFollowup(d, f) {
  const moment = d.act.paperMoment;
  if (!moment || paperFollowup(d, f) !== moment) return;
  const pair = moment.people.map(person => person.name).join('和');
  const activity = ACT_NAMES[d.act.type];
  moment.steps.push(`${pair}后来又一起${activity}。`);
  moment.result ||= ['一起玩', '✨', `被你拉到一起后，${pair}又相约${activity}。`, 84];
  moment.pending = false;
}

function selectPaperStories(candidates) {
  const stories = [];
  for (const story of candidates.sort((a, b) => b.score - a.score)) {
    if (stories.some(s => s.label === story.label || s.text === story.text)) continue;
    const { score, ...content } = story;
    stories.push(content);
    if (stories.length === 3) break;
  }
  return stories.length ? stories : [{ label: '', icon: '🌙', text: '小屋平静地过了一个月。' }];
}

function paperIssue(saved) {
  if (typeof saved !== 'string') return saved;
  const [month, ...lines] = formatSavedPaper(saved).split('\n');
  const candidates = [];
  for (const line of lines) {
    if (line.startsWith('头条　')) candidates.push({ label: '头条', icon: '📰', score: 105, text: line.slice(3) });
    else if (line.startsWith('【特别版】')) candidates.push({ label: '特别版', icon: '✨', score: 80, text: line.slice(5) });
    else if (/^(新发现|小屋趣闻|集体用餐)　/.test(line)) {
      const [label, text] = line.split('　', 2);
      candidates.push({ label, icon: '✨', score: 40, text });
    } else if (!line.includes('　')) {
      const story = paperLogStory(line);
      if (story) candidates.push(story);
    }
  }
  return { month, stories: selectPaperStories(candidates).map(story => ({ ...story, people: paperCast(story.text) })) };
}

function finishHouseMonth(deferPaper = false) {
  const monthLog = G.log.filter(entry => entry.d === G.day);
  const candidates = monthLog.slice().reverse().map(e => paperLogStory(e.text)).filter(Boolean);
  const residents = G.dolls.filter(d => !d.guest && d.state !== 'away');
  if (residents.length >= 2 && residents.every(d => d.heart === 'fickle') && monthLog.some(e => /表白|暧昧|分手/.test(e.text))) {
    candidates.push({ label: '特别版', icon: '💌', score: 61, text: '恋综现场：这屋的花心室友又有新剧情了。' });
  } else if (residents.length >= 2 && residents.every(d => d.mbti?.startsWith('I')) && !Object.keys(G.daily.social || {}).length) {
    candidates.push({ label: '特别版', icon: '📚', score: 61, text: '各自安好：内向的室友们本月各忙各的。' });
  }
  if (typeof housePaperExtras === 'function') candidates.push(...housePaperExtras());
  for (const moment of G.paperMoments || []) {
    if (moment.month !== G.day || !moment.result) continue;
    const [label, icon, text, score] = moment.result;
    candidates.push({ label, icon, text, score, people: moment.people, steps: [...moment.steps] });
  }
  G.paperMoments = [];
  G.dayRelations = houseRelations();
  const stories = selectPaperStories(candidates).map(story => ({ ...story, people: story.people || paperCast(story.text) }));
  G.paper.push({ month: monthLabel(G.day), stories });
  if (G.paper.length > 30) G.paper.shift();
  G.daily = {};
  updateHousePaperButton();
  // 月报不要打断正在进行的操作（拖小人、衣橱、别的弹窗）：先挂起，
  // 等玩家空闲时由主循环打开；顶栏按钮会提示有新一期，也可以手动点开
  if (document.getElementById('paperAuto')?.checked) {
    if (deferPaper || (typeof playerBusy === 'function' && playerBusy())) { G.paperPending = true; updateHousePaperButton(); }
    else showHousePaper();
  }
}

function updateHousePaperButton() {
  const button = document.getElementById('dailyPaper');
  if (!button) return;
  button.textContent = G.paperPending ? '📰 小屋月报 · 新一期到啦'
    : G.paper.length ? `📰 小屋月报 · ${G.paper.length}` : '📰 小屋月报';
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
  // 听岔了：不是记不清，而是记成了另一件事、冤枉到别人头上
  const wrong=misunderstood&&typeof misheardRumor==='function'?misheardRumor(speaker,listener,source):null;
  NPCMemory.record(G,{type:'rumor',time:now,participants:[speaker.pid,listener.pid],original:source.sources[0],outcome:wrong?'misheard':'retold'},[
    {person:listener.pid,subject:wrong?wrong.subject:source.subject,channel:'hearsay',confidence:misunderstood?.35:.65,
      emotion:wrong?-.5:source.emotion,impact:65,interpretation:wrong?wrong.interpretation:misunderstood?'听说有人闹得很厉害，但详情我也不确定。':`听${speaker.name}说：${source.interpretation}`}
  ]);
  if(!wrong&&typeof heardRumor==='function')heardRumor(listener,source.subject,source.emotion);
  addLog(wrong?`💬 ${speaker.name} 向 ${listener.name} 说起一件旧事，${listener.name} 却听成了「${wrong.claim}」`:`💬 ${speaker.name} 向 ${listener.name} 说起了一件旧事`);
}
