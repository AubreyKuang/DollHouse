// 职业与作息：到点从大门出门，在外面待一段时间，每天回家的时间都不太一样
// 时间用“绝对分钟” abs = (第几天-1)*1440 + 当天分钟，这样夜班跨过午夜也好算

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const weekday = day => (day - 1) % 7;               // 第 1 天是周一
const absNow = () => (G.day - 1) * 1440 + G.time;
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

// start/end 是当天分钟；end < start 表示下班在第二天（夜班）；off 是休息的星期几
const JOBS = {
  student: { name: '学生', icon: '🎒', start: 480, end: 960, off: [5, 6], verb: '上学', wage: 40, wageName: '拿到零花钱',
    go: ['去上学啦！', '书包带了吗……带了！', '要迟到啦！'], back: ['放学啦～', '今天学了好多', '作业好多……'], tired: '今天考试……' },
  office: { name: '上班族', icon: '💼', start: 540, end: 1080, off: [5, 6], verb: '上班', wage: 320,
    go: ['上班去了……', '又是元气满满的一天（假的）', '挤地铁去咯'], back: ['终于下班了！', '我回来啦', '今天开了好多会'], tired: '加班好累……' },
  baker: { name: '面包师', icon: '🥐', start: 330, end: 780, off: [0], verb: '烤面包', wage: 240,
    go: ['去烤面包！', '面团在等我', '早起的面包师有面包吃'], back: ['带了面包回来～', '香喷喷地回来啦', '今天的可颂很成功'], tired: '今天订单好多' },
  barista: { name: '咖啡师', icon: '☕', start: 600, end: 1140, off: [2], verb: '做咖啡', wage: 210,
    go: ['去咖啡店啦', '今天也要好好拉花', '出门咯～'], back: ['今天拉花很成功！', '一身咖啡香地回来了', '我回来啦～'], tired: '客人好多……' },
  night: { name: '夜班店员', icon: '🌙', start: 1320, end: 360, off: [6], verb: '值夜班', wage: 280,
    go: ['值夜班去了', '晚上见……不对，早上见', '出门啦'], back: ['困死了……', '天亮了，我回来了', '要去补觉了'], tired: '今晚好多客人' },
  artist: { name: '自由画家', icon: '🎨', start: null, verb: '在家画画' },
  none: { name: '宅在家', icon: '🏠', start: null, verb: '宅家' },
};

const isWorkday = (job, day) => job.start != null && !job.off.includes(weekday(day));
const doorOf = () => G.furniture.find(f => f.id === 'door');
function doorTile() {
  const d = doorOf();
  return d ? { x: d.x, y: WALL_ROWS } : { x: Math.floor(COLS / 2), y: WALL_ROWS };
}

// 老存档没有门：找一块墙边空位装上
function ensureDoor() {
  if (doorOf()) return;
  const b = blockedMap();
  for (const x of [6, 3, 7, 11, 12, 10, 1, 14, 0, 15, 2, 4, 5, 8, 9, 13])
    if (canPlace('door', x, 1, null) && !b[x][WALL_ROWS]) { addFurniture('door', x, 1); return; }
  for (let x = 0; x < COLS; x++) if (canPlace('door', x, 1, null)) { addFurniture('door', x, 1); return; }
}

// 今天应该出门的时间（绝对分钟），不用上班返回 null
function leaveAbs(d) {
  const J = JOBS[d.job] || JOBS.none;
  if (!isWorkday(J, G.day) || d.lastWorkDay === G.day) return null;
  return (G.day - 1) * 1440 + J.start - 30 + (d.leaveJitter || 0);
}

function startLeave(d) {
  const J = JOBS[d.job];
  if (d.act) endAct(d);
  d.path = [];
  const t = doorTile();
  const goals = [t, { x: t.x - 1, y: t.y }, { x: t.x + 1, y: t.y }, { x: t.x, y: t.y + 1 }];
  const path = (d.tx === t.x && d.ty === t.y) ? [] : findPath(d.tx, d.ty, goals);
  if (!path) { d.state = 'idle'; d.think = 3; return; }
  d.path = path; d.state = path.length ? 'walk' : 'arrive';
  d.act = { type: 'leave' };
  say(d, G.weather === 'rain' ? pick(['下雨了，带上伞！', '雨好大……']) : G.weather === 'snow' ? pick(['外面好冷……', '围巾戴好！']) : pick(J.go));
}

function exitHome(d) {
  const J = JOBS[d.job], door = doorOf();
  d.act = null; d.path = []; d.bubble = null;
  d.state = 'away'; d.lastWorkDay = G.day;
  if (door) door.openT = 0.8;
  // 回家时间：正常下班后 0~80 分钟到家，偶尔早退，15% 概率加班
  const startAbs = (G.day - 1) * 1440 + J.start;
  let len = (J.end - J.start + 1440) % 1440;
  let back = startAbs + len + 15 + Math.random() * 65;
  d.overtime = Math.random() < 0.15;
  if (d.overtime) back += 120 + Math.random() * 60;
  else if (Math.random() < 0.15) back -= 60 + Math.random() * 40;
  d.awayUntil = Math.round(back);
  d.leaveJitter = Math.round(Math.random() * 40 - 15);  // 明天出门时间也稍微变一变
  SFX.play('open');
  HOOK.toast(`${J.icon} ${d.name} ${J.verb}去了，大约 ${hhmm(d.awayUntil)} 回家`);
  if (G.sel === d.uid) HOOK.select();
}

function comeHome(d) {
  const J = JOBS[d.job], door = doorOf(), t = doorTile();
  const p = free(t.x, t.y) ? t : nearestFree(t.x, t.y);
  if (p) placeDollAt(d, p.x, p.y);
  d.state = 'idle'; d.dir = 'down'; d.think = 2 + Math.random() * 2; d.away = false;
  if (door) door.openT = 0.8;
  say(d, d.overtime ? J.tired : pick(J.back));
  if (G.weather === 'rain' && Math.random() < 0.4) { d.needs.fun = Math.max(0, d.needs.fun - 8); setTimeout(() => say(d, '淋湿了……阿嚏！'), 1600); }
  payday(d);
  SFX.play('newday');
  HOOK.toast(`🏠 ${d.name} 回家了`);
  // 在家的人打招呼；恋人会过来抱抱
  const lover = loverOf(d);
  for (const o of G.dolls) {
    if (o === d || o.state === 'away' || lying(o) || o.state === 'lift') continue;
    if (o === lover && (o.state === 'idle' || (o.act && !o.act.onFurn && o.act.type !== 'chat'))) {
      if (o.act) endAct(o);
      o.state = 'idle';
      if (startAct(o, { type: 'chat', partner: d })) { o.act.kind = 'hug'; say(o, '欢迎回家 💕'); d.path = []; d.state = 'wait'; d.waitT = 8; }
    } else if (rel(d, o).f >= 40 && Math.random() < 0.6) {
      setTimeout(() => o.state !== 'away' && say(o, pick(['欢迎回来～', '回来啦！', `${d.name}辛苦啦`])), 600 + Math.random() * 900);
    }
  }
  if (G.sel === d.uid) HOOK.select();
}

// 每帧在 updateDoll 里调用；返回 true 表示这帧不用再做别的
function workTick(d, dt) {
  const N = d.needs;
  if (d.state === 'away') {
    // 在外面：会累、会饿，但和同事也算有社交
    N.energy = Math.max(0, N.energy - 3 * MIN_PER_SEC / 60 * dt);
    N.hunger = Math.max(0, N.hunger - 1.5 * MIN_PER_SEC / 60 * dt);
    N.social = Math.min(100, N.social + 6 * MIN_PER_SEC / 60 * dt);
    if (absNow() >= d.awayUntil) comeHome(d);
    return true;
  }
  if (d.state === 'lift' || (d.act && d.act.type === 'leave')) return false;
  const la = leaveAbs(d), now = absNow();
  if (la != null && now >= la && now < la + 180) {
    if (lying(d)) say(d, '要迟到啦！');
    startLeave(d);
    return true;
  }
  return false;
}

function updateDoors(dt) { for (const f of G.furniture) if (f.openT > 0) f.openT -= dt; }

// 状态卡里的作息说明
function jobLine(d) {
  const J = JOBS[d.job] || JOBS.none;
  if (J.start == null) return `${J.icon} ${J.name}`;
  const off = J.off.map(i => WEEKDAYS[i]).join('、');
  return `${J.icon} ${J.name} · ${hhmm(J.start)}–${hhmm(J.end)} · ${off}休息 · ${J.wageName ? '零花钱' : '日薪'} ${yuan(J.wage)}`;
}
function awayText(d) {
  const J = JOBS[d.job] || JOBS.none;
  return `${J.verb}中，约 ${hhmm(d.awayUntil)} 回家`;
}

/* ---------------- 收入与储蓄 ----------------
   上班的人每天下班领日薪（加班多拿 50%），学生有零花钱，自由画家偶尔卖画；
   吃零食、买菜要花钱，每晚 0 点每人交房租水电。钱不够时，恋人或好朋友会帮忙付。 */
const PRICES = { snack: 12, cook: 25 };
const PRICE_NAME = { snack: '零食钱', cook: '买菜钱' };
const RENT = 50;
const START_MONEY = { office: 4000, baker: 2500, barista: 2000, night: 2500, student: 300, artist: 1500, none: 600 };
const yuan = n => (n < 0 ? '-¥' : '¥') + Math.abs(Math.round(n)).toLocaleString('en-US');

function helperFor(d, amount) {
  return G.dolls
    .filter(o => o !== d && o.state !== 'away' && o.money >= amount && (rel(d, o).lovers || rel(d, o).f >= 50))
    .sort((a, b) => (rel(d, b).lovers - rel(d, a).lovers) || (rel(d, b).f - rel(d, a).f))[0];
}
const canAfford = (d, amount) => d.money >= amount || !!helperFor(d, amount);

function pay(d, amount, what) {
  if (d.money >= amount) { d.money -= amount; return true; }
  const h = helperFor(d, amount);
  if (!h) return false;
  h.money -= amount; bump(d, h, 3);
  setTimeout(() => say(h, pick(['我来付吧', '这顿我请～', '拿去用，不用还'])), 400);
  addLog(`💸 ${d.name} 钱不够，${h.name} 帮忙付了${what} ${yuan(amount)}`);
  return true;
}

function payday(d) {
  const J = JOBS[d.job];
  if (!J.wage) return;
  const w = Math.round(J.wage * (d.overtime ? 1.5 : 1));
  const c = d.job === 'student' ? 0 : Math.round(w * FUND_SHARE);   // 工资的 20% 存进家庭基金
  d.money += w - c; G.fund += c;
  addLog(`💰 ${d.name} ${J.wageName || '领到工资'} ${yuan(w)}${d.overtime ? '（含加班费）' : ''}${c ? `，${yuan(c)} 存进家庭基金` : ''}，个人存款 ${yuan(d.money)}`);
}

function nightlyBills() {
  const payers = G.dolls.filter(d => d.job !== 'student');   // 学生不用交房租
  for (const d of payers) d.money -= RENT;
  if (payers.length) addLog(`🏠 ${payers.map(d => d.name).join('、')} 交了房租水电，每人 ${yuan(RENT)}`);
  const sb = seasonBill();
  if (sb && payers.length) { for (const d of payers) d.money -= sb[1]; addLog(`${sb[0] === '暖气费' ? '🔥' : '🧊'} 每人还交了${sb[0]} ${yuan(sb[1])}`); }
  for (const d of G.dolls) if (d.job === 'artist' && Math.random() < (d.paintedDay >= G.day - 1 ? 0.7 : 0.25)) {
    const v = 200 + Math.round(Math.random() * 6) * 100;
    d.money += v; addLog(`🎨 ${d.name} 的画卖出去了，收入 ${yuan(v)}`);
  }
  // 欠债太多的人会出去找工作
  for (const d of G.dolls) if ((d.job === 'none' || d.job === 'artist') && d.money < -500 && Math.random() < 0.3) {
    d.job = pick(['barista', 'night', 'office']);
    addLog(`💼 ${d.name} 欠了 ${yuan(-d.money)}，终于去找了份工作：${JOBS[d.job].name}`);
  }
  const broke = G.dolls.filter(d => d.money < 0);
  for (const d of broke) d.needs.fun = Math.max(0, d.needs.fun - 20);
  if (broke.length) addLog(`😰 ${broke.map(d => d.name).join('、')} 的存款见底了`);
}
