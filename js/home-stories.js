// Shared time is earned by being together, never by pressing the invitation button.
const HOME_TIMES = {
  supper: { name: '一起吃顿饭', icon: '🍲', title: '热饭要一起吃', furniture: ['table'], cost: 30,
    hint: '围着餐桌，聊聊各自的一天。家庭基金准备一桌饭，没人需要自己付钱。',
    need: { hunger: 32, fun: 12, social: 22 } },
  stories: { name: '围坐讲故事', icon: '📖', title: '再讲一个就睡', furniture: ['sofa', 'shelf'], cost: 0,
    hint: '沙发或书架旁，一人讲一点，故事会变成谁也没想到的样子。',
    need: { fun: 20, social: 22 } },
  music: { name: '小小音乐会', icon: '🎵', title: '只唱给家里听', furniture: ['piano', 'recordPlayer', 'ukulele'], cost: 0,
    hint: '不必表演得完美。有人唱跑调，有人打拍子，有人安静听完。',
    need: { fun: 24, social: 18 } },
};
const HOME_WISHES = {
  foodie: ['supper', '想做一桌热乎的饭，大家都来尝一口。'],
  lazy: ['stories', '想窝在家里，听你们讲点有意思的事。'],
  nerd: ['stories', '读到了一个好故事，想找人一起往下编。'],
  social: ['supper', '想让大家坐在一桌，慢慢聊聊最近的事。'],
  maker: ['stories', '想听大家说说，小时候最珍惜的东西。'],
  stylist: ['music', '想穿喜欢的衣服，办一场家里的音乐会。'],
  active: ['music', '想给大家打拍子，跑调也没关系。'],
  tidy: ['supper', '想把餐桌收拾好，等大家回来吃饭。'],
  genki: ['music', '想在家里开音乐会！观众只有你们也行。'],
};
const HOME_LINES = {
  supper: {
    foodie: ['这口先尝尝，我特意少放了盐。', '锅里还有，今天谁都不许饿着。'],
    lazy: ['我负责吃得干干净净。', '能坐着等开饭，也太幸福了。'],
    nerd: ['书里说，饭桌是一个家的中心。', '先不看书了，听你们讲。'],
    social: ['今天有什么值得讲的小事？', '能凑在一桌，比吃什么都重要。'],
    maker: ['下次我给餐桌做个小托盘。', '这碗边缺了一点，我改天补好。'],
    stylist: ['这一桌颜色真好看。', '我想给今天拍一张照片。'],
    active: ['回来一闻到这个味道，就饿了！', '吃完我来收碗，你们坐着。'],
    tidy: ['热汤放中间，小心烫。', '剩下的装好，晚回家的人也有份。'],
    genki: ['我有件好笑的事，等我咽下这口！', '下次还要坐在一起！'],
  },
  stories: {
    nerd: ['故事要从一把找不到门的钥匙讲起。', '最后，那扇门一直就在家里。'],
    lazy: ['我猜门后面是一张很软的床。', '还没讲完吗？我没有睡，我在听。'],
    foodie: ['钥匙能不能打开点心柜？', '那里面一定要有刚烤好的面包。'],
    maker: ['也许钥匙是自己做的，世上只有一把。', '做它的人，一直在等主人回来。'],
    social: ['那我们每个人接一句吧。', '同一个故事，听出了好多种结局。'],
    tidy: ['等等，钥匙会不会在外套口袋？', '下次我做一个专门放钥匙的盒子。'],
    stylist: ['那扇门一定是很漂亮的莓果色。', '我已经把画面想好了。'],
    active: ['找到门以后，我们一起去探险！', '但是天黑以前得回家。'],
    genki: ['门后面不会住着一只会说话的猫吧！', '好，这个结尾我喜欢！'],
  },
  music: {
    nerd: ['我选了一首很轻的曲子。', '刚才那段，有点像雨落在窗台上。'],
    lazy: ['我可以坐着当观众吗？', '这首好听，听着就想打个盹。'],
    foodie: ['我来当端点心的观众。', '散场以后，还有一小块蛋糕。'],
    maker: ['我拿小木盒给你们打拍子。', '这样也算一件乐器吧？'],
    social: ['会唱的都跟一句，不会也没关系。', '这一首就是我们家的歌了。'],
    tidy: ['声音刚好，隔壁应该不会嫌吵。', '结束以后，我来把东西收好。'],
    stylist: ['今天客厅就是我们的舞台。', '刚才那个转身，是我临时想的。'],
    active: ['一、二、三，我给你们数拍子！', '再来一小段吧！'],
    genki: ['跑调了！没事，我们一起跑！', '只给你们听，安可！'],
  },
};

function restoreHomeStories(saved) {
  return { wishes: Array.isArray(saved?.wishes) ? saved.wishes.slice(-16) : [],
    album: Array.isArray(saved?.album) ? saved.album.slice(-120) : [],
    next: Math.max(1, Number(saved?.next) || 1), lastWishMonth: saved?.lastWishMonth || 0,
    active: saved?.active && Object.hasOwn(HOME_TIMES, saved.active.kind)
      ? { ...saved.active, resume: true, elapsed: 0, line: 0, phase: 'gather' } : null };
}
function homePortrait(d) { return { pid: d.pid, name: d.name, look: { ...d.look } }; }
function addHomeMemory(kind, title, text, people, key) {
  const home = G.home;
  if (!home || home.album.some(m => m.key === key)) return;
  home.album.push({ id: home.next++, key, kind, title, text, month: G.day,
    weather: G.weather, people: people.map(homePortrait), favorite: false });
  while (home.album.length > 120) {
    const oldest = home.album.findIndex(m => !m.favorite);
    home.album.splice(oldest < 0 ? 0 : oldest, 1);
  }
  HOOK.home?.();
}
function rememberHomeLog(text) {
  if (!G.home || !G.dolls?.length) return;
  const theme = /在一起了|确认了恋人/.test(text) ? ['love', '心意相通的那个月']
    : /一起做成了.+花架/.test(text) ? ['craft', '我们一起做的']
    : /有了自己的.+角/.test(text) ? ['corner', '家里有我的位置了']
    : /搬进来啦|搬进来了/.test(text) ? ['welcome', '又多了一个家人']
    : /又下雨了.+书房/.test(text) ? ['rain', '雨声里的老地方'] : null;
  if (!theme) return;
  const people = G.dolls.filter(d => text.includes(d.name));
  if (!people.length) return;
  addHomeMemory(theme[0], theme[1], text.replace(/^[^\p{L}\p{N}]+/u, ''), people,
    `${theme[0]}:${G.day}:${people.map(d => d.pid).sort().join(':')}`);
}
function ensureHomeWishes() {
  const home = G.home;
  home.wishes = home.wishes.filter(w => residents().some(d => d.pid === w.pid));
  if (home.lastWishMonth === G.day) return;
  home.lastWishMonth = G.day;
  home.wishes = home.wishes.filter(w => (!w.done || w.done >= G.day - 2) && !w.deferred);
  fillHomeWishes();
}
function fillHomeWishes() {
  const home = G.home;
  const candidates = residents().filter(d => !home.wishes.some(w => w.pid === d.pid));
  for (const d of candidates.slice(0, Math.max(0, 2 - home.wishes.filter(w => !w.done && !w.deferred).length))) {
    const [kind, text] = HOME_WISHES[d.persona] || HOME_WISHES.genki;
    home.wishes.push({ pid: d.pid, kind, text, since: G.day, done: 0 });
  }
}
function homeWishLine(d) {
  return G.home?.wishes.find(w => w.pid === d.pid && !w.done && !w.deferred)?.text || null;
}
const inHomeTime = d => d?.act?.type === 'homeTime';
const homeFurnitureReserved = f => G.home?.active?.anchor === f.key;
function homeAvailability(d, kind) {
  if (!d || d.guest || d.state === 'away') return '还没回家';
  if (inHomeTime(d)) return '正在一起活动';
  if (CARE_ACTIONS.includes(d.act?.type) || d.act?.type === 'chat') return '正和别人忙着，晚点再约';
  if (!readyForKeepsake(d) || ['visitGather', 'visitStay', 'tryst'].includes(d.act?.type)) return '正忙着，晚点再约';
  const leave = leaveAbs(d);
  if (leave !== null && leave <= absNow() + 130 && leave + 180 > absNow()) return '快到出门时间了';
  if (d.needs.hunger < 15 && kind !== 'supper') return '先让 TA 吃点东西';
  return '';
}
function homeRoutes(group, anchor) {
  const F = FURNITURE[anchor.id], occupied = new Set(), columns = new Set();
  const spots = [];
  for (let y = anchor.y - 1; y <= anchor.y + F.h + 4; y++) {
    for (let x = anchor.x - 2; x <= anchor.x + F.w; x++) {
      if (!free(x, y) || isDoorTile(x, y) || x === stairsColumn() ||
          roomOf({ tx: x, ty: y }) !== cornerRoom(anchor) ||
          G.dolls.some(d => !group.includes(d) && d.state !== 'away' &&
            ((d.tx === x && d.ty === y) || (d.path.at(-1)?.x === x && d.path.at(-1)?.y === y)))) continue;
      const px=HOUSE_X+x*T+8, py=houseY(y*T+14,storeyOf(y));
      const hidden=G.furniture.some(f=>{
        if(layerOf(f.id)!=='solid'||storeyOf(f.y)!==storeyOf(y))return false;
        const box=houseFurnitureRect(f);
        return box.bottom>py && box.top<py-5 && px+4>box.x && px-4<box.x+box.w;
      });
      spots.push({ x, y, hidden });
    }
  }
  const routes = [];
  for (const d of group) {
    const options = spots.filter(t => !occupied.has(`${t.x},${t.y}`))
      .map(t => ({ tile: t, path: findPath(d.tx, d.ty, [t]) }))
      // The cutaway compresses depth: adjacent grid rows can hide a whole person.
      .filter(r => r.path).sort((a, b) => {
        const score=r=>Number(r.tile.hidden)*10000+Number(columns.has(r.tile.x))*1000+
          Math.abs(r.tile.y-anchor.y-F.h-1)*12+r.path.length*.1;
        return score(a)-score(b);
      });
    if (!options.length) return null;
    const chosen = options[0];
    occupied.add(`${chosen.tile.x},${chosen.tile.y}`);
    columns.add(chosen.tile.x);
    routes.push(chosen.path);
  }
  return routes;
}
function prepareHomeTime(kind, pids, focusPid) {
  const theme = HOME_TIMES[kind];
  if (!theme) return { reason: '这个活动还没有准备好。' };
  const group = [...new Set(pids)].map(communityDoll);
  if (group.length < 2 || group.length > 4 || group.some(d => !d || d.guest)) return { reason: '选两到四位住户，一起留一点空闲。' };
  for (const d of group) {
    const reason = homeAvailability(d, kind);
    if (reason) return { reason: `${d.name}${reason}。` };
  }
  for (let i = 0; i < group.length; i++) for (const other of group.slice(i + 1)) {
    if (tensionBetween(group[i], other)) return { reason: `${group[i].name}和${other.name}还需要一点空间，这次先分别约吧。` };
  }
  const detail = lifeTimePlan(kind, group, focusPid);
  if (detail.reason) return detail;
  if (!TEST_MODE && G.fund < theme.cost) return { reason: `${theme.name}需要家庭基金 ¥${theme.cost}，也可以先约免费的故事会。` };
  const anchors = G.furniture.filter(f => theme.furniture.includes(f.id));
  if (!anchors.length) return { reason: `先摆好${theme.furniture.map(id => FURNITURE[id]?.name).filter(Boolean).join('或')}。` };
  for (const anchor of anchors) {
    if (G.keepsakes.project?.bench === anchor.key || G.care.meals.some(m => m.table === anchor.key && ['packing', 'ready'].includes(m.phase))) continue;
    if (anchor.users.some(d => !group.includes(d))) continue;
    const routes = homeRoutes(group, anchor);
    if (routes) return { group, anchor, routes, detail };
  }
  return { reason: '家具旁要给每个人留一个能走到的位置；也可以等正在使用的人结束。' };
}
function sendHomeGroup(active, group, routes) {
  group.forEach((d, i) => {
    if (d.act) endAct(d);
    d.path = routes[i]; d.state = d.path.length ? 'walk' : 'arrive';
    d.act = { type: 'homeTime', homeId: active.id, homeKind: active.kind,
      dance: active.kind === 'music' && ['genki', 'stylist', 'active'].includes(d.persona), t: 90 };
    say(d, ['我来啦。', '给我留个位置～', '好，等我一下。'][i % 3]);
  });
}
function startHomeTime(kind, pids, focusPid) {
  if (G.home.active) return '家里的活动已经开始啦，等这次结束再约。';
  const plan = prepareHomeTime(kind, pids, focusPid);
  if (plan.reason) return plan.reason;
  const active = G.home.active = { id: G.home.next++, kind, people: plan.group.map(d => d.pid),
    anchor: plan.anchor.key, started: absNow(), deadline: absNow() + 180,
    phase: 'gather', elapsed: 0, line: 0, paid: false, detail: plan.detail,
    anchorAt: { x: plan.anchor.x, y: plan.anchor.y } };
  sendHomeGroup(active, plan.group, plan.routes);
  HOOK.home?.(); save();
  return null;
}
function arriveHomeTime(d) {
  const active = G.home.active, anchor = G.furniture.find(f => f.key === active?.anchor);
  if (!active || !anchor || d.act.homeId !== active.id) { endAct(d); return; }
  d.state = 'act'; d.act.t = 90;
  face(d, (anchor.x + FURNITURE[anchor.id].w / 2) * T, d.y - 5);
  say(d, '位置留好了，等你们。');
}
function cancelHomeTime(message = '这次先忙各自的，有空再聚。') {
  const active = G.home.active;
  if (!active) return;
  if(active.kind==='birthday'&&active.detail?.honoree&&!G.life.birthdayInvites.some(b=>b.pid===active.detail.honoree&&b.month===G.day)) {
    G.life.birthdayInvites.push({pid:active.detail.honoree,month:G.day});
    G.life.birthdayInvites=G.life.birthdayInvites.slice(-16);
  }
  for (const d of G.dolls) if (inHomeTime(d) && d.act.homeId === active.id) { endAct(d); d.path = []; }
  G.home.active = null;
  HOOK.toast(message, true); HOOK.home?.(); save();
}
function finishHomeTime(active, group) {
  const theme = HOME_TIMES[active.kind];
  const special = finishLifeTime(active, group);
  const text = special?.text || `${group.map(d => d.name).join('、')}在家${active.kind === 'music' ? '开了一场小小音乐会' : theme.name}。${active.kind === 'supper' ? '饭慢慢吃，话慢慢讲。' : active.kind === 'stories' ? '每人接了一句，编出了只属于小屋的结尾。' : '有人跑调，有人打拍子，谁也没有提前离场。'}`;
  addHomeMemory(active.kind, special?.title || theme.title, text, group, `gather:${active.id}`);
  const perceptions = [];
  for (const d of group) {
    for (const [key, gain] of Object.entries(theme.need)) d.needs[key] = Math.min(100, d.needs[key] + gain);
    d.happy = 3;
    const companion = group.find(o => o !== d);
    perceptions.push({ person: d.pid, subject: companion.pid, emotion: .75, impact: 75, interpretation: text });
    const wish = G.home.wishes.find(w => !w.done && !w.deferred && w.pid === d.pid && w.kind === active.kind);
    if (wish) { wish.done = G.day; say(d, '这就是我一直想和你们做的事。', 4); }
    else say(d, active.kind === 'supper' ? '吃饱了，心里也暖暖的。' : '这一小段时间，我会记得的。', 4);
  }
  // Each resident's attention is shared across the other participants.
  const companions = group.length - 1;
  for (let i = 0; i < group.length; i++) for (const other of group.slice(i + 1)) {
    bump(group[i], other, 4 / companions);
    addTrust(group[i], other, 2 / companions); addTrust(other, group[i], 2 / companions);
    if (active.kind === 'supper') countTogether('meal', group[i], other);
  }
  NPCMemory.record(G, { type: 'home-time', time: absNow(), participants: group.map(d => d.pid), outcome: active.kind }, perceptions);
  addLog(`${theme.icon} ${text}`);
  group.forEach(d => { endAct(d); d.path = []; d.think = 4; });
  G.home.active = null; HOOK.home?.(); HOOK.refresh(); save();
}
function tickHomeStories(dt) {
  ensureHomeWishes();
  const a = G.home.active;
  if (!a) return;
  const anchor = G.furniture.find(f => f.key === a.anchor);
  if (!anchor) { cancelHomeTime('家具挪走了，这次先暂停；重新摆好以后再约。'); return; }
  let group = a.people.map(communityDoll).filter(Boolean);
  if (!lifeTimeValid(a, group)) { cancelHomeTime('主角暂时来不了，这次先歇一会儿。'); return; }
  if (!a.resume && a.anchorAt && (a.anchorAt.x !== anchor.x || a.anchorAt.y !== anchor.y)) {
    const routes = homeRoutes(group, anchor);
    if (!routes) { cancelHomeTime('新位置暂时走不到，有空再聚。'); return; }
    a.anchorAt = { x: anchor.x, y: anchor.y }; a.phase = 'gather'; a.elapsed = 0; a.line = 0;
    a.deadline = absNow() + 180; sendHomeGroup(a, group, routes);
  }
  if (a.resume) {
    // Rebuild paths from saved positions; never award time that happened off-screen without simulation.
    const available = group.filter(d => !homeAvailability(d, a.kind));
    const routes = available.length >= 2 && homeRoutes(available, anchor);
    if (!routes || absNow() > a.deadline || !lifeTimeValid(a, available)) { cancelHomeTime(); return; }
    a.people = available.map(d => d.pid); a.resume = false; group = available;
    a.anchorAt = { x: anchor.x, y: anchor.y };
    sendHomeGroup(a, group, routes);
  }
  const assigned = group.filter(d => inHomeTime(d) && d.act.homeId === a.id);
  const together = assigned.filter(d => d.state === 'act');
  if (!lifeTimeValid(a, assigned)) { cancelHomeTime('有人先去忙了，等有空再继续。'); return; }
  if (assigned.length < 2 || group.some((d, i) => group.slice(i + 1).some(o => tensionBetween(d, o)))) { cancelHomeTime(); return; }
  if (a.phase === 'gather') {
    if (together.length !== assigned.length && absNow() < a.deadline) return;
    if (together.length < 2 || !lifeTimeValid(a, together)) { cancelHomeTime('这次没能凑齐，大家有空时再约。'); return; }
    for (const d of assigned.filter(d => d.state !== 'act')) { endAct(d); d.path = []; }
    a.people = together.map(d => d.pid);
    if (!a.paid && !TEST_MODE) {
      if (G.fund < HOME_TIMES[a.kind].cost) { cancelHomeTime('家庭基金不够准备这顿饭了，下次再约。'); return; }
      G.fund -= HOME_TIMES[a.kind].cost;
    }
    a.paid = true; a.phase = 'sharing'; a.elapsed = 0;
    HOOK.refresh(); HOOK.home?.();
  }
  if (together.length < a.people.length) {
    // Interruptions restart the shared-time clock, so running away cannot complete a wish.
    a.people = together.map(d => d.pid); a.elapsed = 0; a.line = 0;
    if (together.length < 2) { cancelHomeTime(); return; }
  }
  a.elapsed += dt;
  const turn = Math.floor(a.elapsed / 3.3);
  if (turn >= a.line) {
    const d = together[a.line % together.length];
    const listener = together[(a.line + 1) % together.length];
    face(d, listener.x, listener.y); face(listener, d.x, d.y);
    const round = Math.floor(a.line / together.length) % 2;
    say(d, lifeTimeLine(a,d,round) || (HOME_LINES[a.kind][d.persona] || HOME_LINES[a.kind].genki)[round], 3.2);
    if (a.kind === 'music' || a.kind === 'learnMusic') SFX.play('piano');
    a.line++;
  }
  if (a.elapsed >= Math.max(14, together.length * 6.6)) finishHomeTime(a, together);
}
function drawHomeTable(c, f, x, y) {
  drawLifeTime(c, f, x, y);
  const a = G.home?.active;
  if (!a || a.anchor !== f.key || a.phase !== 'sharing') return;
  if (a.kind === 'music') {
    const by = y - 14 - Math.floor(G.t * 2) % 4;
    R(c, x + 13, by, 1, 5, '#d49a62'); R(c, x + 10, by + 4, 3, 2, '#d49a62');
    R(c, x + 14, by, 3, 1, '#d49a62'); return;
  }
  if (a.kind !== 'supper') return;
  R(c, x + 4, y + 2, 24, 8, '#f2dcb7');
  for (const px of [x + 7, x + 23]) {
    R(c, px, y + 3, 6, 4, '#fff7e4'); R(c, px + 1, y + 4, 4, 2, '#c58d62');
  }
  R(c, x + 15, y - 1, 6, 5, '#cb8b82'); R(c, x + 16, y - 2, 4, 2, '#f5dbad');
  if (Math.floor(G.t * 2) % 2) R(c, x + 17, y - 5, 1, 2, '#fff3db');
}
ACT_NAMES.homeTime = '共度小屋时光';
