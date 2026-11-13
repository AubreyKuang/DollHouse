// 职业与作息：到点从大门出门，在外面待一段时间，每月回家的时间都不太一样
// 绝对分钟跨月连续累计，夜班在次月清晨结束。

const absNow = () => (G.day - 1) * 1440 + G.time;
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

// start/end 是时钟分钟，end < start 表示次月下班，off 是休息月份。
const JOBS = {
  student: { name: '学生', icon: '🎒', start: 480, end: 960, off: [7, 8], verb: '上学', wage: 40, wageName: '拿到零花钱',
    go: ['去上学啦！', '书包带了吗……带了！', '要迟到啦！'], back: ['放学啦～', '今天学了好多', '作业好多……'], tired: '今天考试……' },
  office: { name: '上班族', icon: '💼', start: 540, end: 1080, off: [2], verb: '上班', wage: 320,
    go: ['上班去了……', '又是元气满满的一天（假的）', '挤地铁去咯'], back: ['终于下班了！', '我回来啦', '今天开了好多会'], tired: '加班好累……' },
  baker: { name: '面包师', icon: '🥐', start: 330, end: 780, off: [1], verb: '烤面包', wage: 240,
    go: ['去烤面包！', '面团在等我', '早起的面包师有面包吃'], back: ['带了面包回来～', '香喷喷地回来啦', '今天的可颂很成功'], tired: '今天订单好多' },
  barista: { name: '咖啡师', icon: '☕', start: 600, end: 1140, off: [3], verb: '做咖啡', wage: 210,
    go: ['去咖啡店啦', '今天也要好好拉花', '出门咯～'], back: ['今天拉花很成功！', '一身咖啡香地回来了', '我回来啦～'], tired: '客人好多……' },
  night: { name: '夜班店员', icon: '🌙', start: 1320, end: 360, off: [6], verb: '值夜班', wage: 280,
    go: ['值夜班去了', '晚上见……不对，早上见', '出门啦'], back: ['困死了……', '天亮了，我回来了', '要去补觉了'], tired: '今晚好多客人' },
  librarian: { name: '图书管理员', icon: '📚', start: 540, end: 1020, off: [10], verb: '整理图书', wage: 230,
    interests: ['read','catalogue','study'], reply: '那本书听起来不错，下次讲给我听。',
    go: ['去给新书贴标签啦。','今天有小读者来听故事。','把借书卡带上。'], back: ['有位读者终于找到了小时候那本书。','今天的故事会，大家听得好认真。','又借到一本想读的书！'], tired: '整理了一整架书，肩膀有点酸。' },
  florist: { name: '花艺师', icon: '💐', start: 420, end: 900, off: [11], verb: '照料花店', wage: 240,
    interests: ['water','careHerbs','craft'], reply: '明天挑个花瓶，把你喜欢的颜色摆起来。',
    go: ['趁清早去接新鲜的花。','今天想配一束奶油色花束。','带上小剪刀，去花店咯。'], back: ['今天有人买花，只为让自己高兴。','客人把最后一朵小雏菊也选走了。','手上还有一点花叶的香气。'], tired: '搬了好多花桶，想坐下歇一歇。' },
  nurse: { name: '护理师', icon: '🩺', start: 420, end: 1140, off: [4], verb: '值护理班', wage: 360,
    interests: ['checkIn','tidy','careHerbs'], caring: true, reply: '今天换我们照顾你，先喝口水。',
    go: ['去交接班啦，晚上见。','希望今天大家都好好的。','水杯带好了，出门。'], back: ['有人恢复得很好，还和我道了谢。','今天跑来跑去，现在终于能坐下了。','忙完交接，看到家里的灯就安心了。'], tired: '今天的班有点长，想安静坐一会儿。' },
  chef: { name: '餐厅厨师', icon: '👩‍🍳', start: 660, end: 1260, off: [5], verb: '去餐厅掌勺', wage: 330,
    interests: ['cook','recipeBook','recipeSwap'], talent: 'cooking', reply: '辛苦了，回家这顿让你坐着吃。',
    go: ['去备菜，今晚有预约。','围裙收好了，出门啦。','今天想试一点新的调味。'], back: ['今天的汤被客人夸了。','最后一桌也吃得干干净净。','终于放下锅铲了，家里好安静。'], tired: '晚餐高峰忙到现在，胳膊都酸了。' },
  musicTeacher: { name: '音乐老师', icon: '🎼', start: 780, end: 1200, off: [8], verb: '教音乐', wage: 300,
    interests: ['piano','strum','music'], talent: 'music', reply: '你也教教我那一小段吧，等你休息好。',
    go: ['谱子带好了，去上课。','今天陪学生练一首小曲。','慢慢来，总会弹好的。'], back: ['学生今天终于跟上了节拍！','有个音总弹错，我们一起笑了。','听了一下午琴，想听听你们说话。'], tired: '示范了一下午，手指想休息了。' },
  carpenter: { name: '木工', icon: '🪚', start: 480, end: 1020, off: [10], verb: '做木工', wage: 310,
    interests: ['craft','repair','knit'], talent: 'craft', reply: '慢慢讲，你做的小物总有自己的样子。',
    go: ['量尺和铅笔带齐了。','今天要磨一个圆圆的桌角。','去工坊啦，回来给你们讲。'], back: ['今天做的小凳子，终于不晃了。','木头磨光以后，摸起来真舒服。','围裙上都是木屑，先让我拍一拍。'], tired: '打磨了一整天，手有点累。' },
  programmer: { name: '程序员', icon: '💻', start: 600, end: 1140, off: [9], verb: '去写程序', wage: 380,
    interests: ['pc','planChess','repair'], reply: '先把电脑放下吧，来聊点家里的事。',
    go: ['希望今天没有奇怪的报错。','电脑充好电了，出门！','今天要把那个小功能做完。'], back: ['困住我的问题，终于找到原因了。','同事帮我看了一眼，突然就想通了。','今天屏幕看够了，想看看你们。'], tired: '改了好久的问题，脑袋有点转不动了。' },
  courier: { name: '快递员', icon: '📦', start: 480, end: 1080, off: [1], verb: '送包裹', wage: 280,
    interests: ['stretch','snack','couchNap'], reply: '跑了一路，快坐下来歇歇脚。',
    go: ['今天的包裹装好啦。','鞋带系紧，去送件。','希望每一份都准时送到。'], back: ['有人等到包裹，开心得跳了起来。','今天路边的小猫又跟了我一段。','最后一件送到，我也回家啦。'], tired: '跑了好多楼梯，腿有点酸。' },
  artist: { name: '自由画家', icon: '🎨', start: null, verb: '在家画画' },
  none: { name: '宅在家', icon: '🏠', start: null, verb: '宅家' },
};

const isWorkMonth = (job, cycle) => job.start != null && !job.off.includes(monthOf(cycle));
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

// 本月应该出门的时间（绝对分钟），不用上班返回 null
function leaveAbs(d) {
  const J = JOBS[d.job] || JOBS.none;
  if (!isWorkMonth(J, G.day) || d.lastWorkDay === G.day) return null;
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
  d.leaveJitter = leaveJitterFor(d);  // 下月出门时间也稍微变一变：J 型准时，P 型常常踩点
  SFX.play('open');
  HOOK.toast(`${J.icon} ${d.name} ${J.verb}去了，大约 ${returnTime(d)} 回家`);
  if (G.sel === d.uid) HOOK.select();
}

function comeHome(d) {
  const J = JOBS[d.job], door = doorOf(), t = doorTile();
  const p = free(t.x, t.y) ? t : nearestFree(t.x, t.y);
  if (p) placeDollAt(d, p.x, p.y);
  d.state = 'idle'; d.dir = 'down'; d.think = 2 + Math.random() * 2; d.away = false;
  if (door) door.openT = 0.8;
  const soaked = G.weather === 'rain' && Math.random() < .4;
  if (soaked) d.needs.fun = Math.max(0, d.needs.fun - 8);
  const line = soaked ? '刚才雨好大，鞋子都湿了。' : d.overtime ? J.tired : pick(J.back);
  say(d, line);
  payday(d);
  SFX.play('newday');
  HOOK.toast(`🏠 ${d.name} 回家了`);
  if (!noticeSavedMeal(d)) greetAfterWork(d, line, soaked);
  if (d.nextJob) changeResidentJob(d,d.nextJob);
  if (G.sel === d.uid) HOOK.select();
}

function greetAfterWork(d, line, soaked) {
  const nearby = residents().filter(o => o !== d && !tensionBetween(d, o) && canSee(d, o) && canDisturb(d, o) &&
    Math.abs(o.tx - d.tx) + Math.abs(o.ty - d.ty) <= 7 && availableForHouseChat(o) &&
    (arePartners(d, o) || rel(d, o).f >= 0));
  nearby.sort((a, b) => Number(arePartners(d, b)) - Number(arePartners(d, a)) || rel(d, b).f - rel(d, a).f);
  for (const roommate of nearby) {
    const close = arePartners(d, roommate);
    const tired = d.overtime || d.needs.energy < 35 || d.job === 'night';
    const reply = soaked ? '门边有干毛巾，我给你拿一条。'
      : tired ? pick(isF(roommate) ? ['辛苦了，坐会儿吧，我陪你。', '回来就好，先喘口气。']
        : ['先坐会儿，水壶还有热水。', '鞋脱了歇会儿，慢慢说。'])
      : (JOBS[d.job]?.reply || { baker: '闻着好香，我去拿两个盘子。', barista: '下次也给我看看你的拉花。', student: '先歇一会儿，作业等会儿再写。' }[d.job] || '坐下说吧，我听着呢。');
    if (startAct(roommate, { type: 'chat', partner: d, kind: close ? 'hug' : 'chat', exchange: {
      lines: ['回来啦，辛苦了。', line, reply], log: `🏠 ${roommate.name} 迎了迎刚回家的 ${d.name}，两人聊起了${soaked ? '路上的大雨' : '今天的事'}`
    } })) return;
  }
}

// 每帧在 updateDoll 里调用；返回 true 表示这帧不用再做别的
function workTick(d, dt) {
  if (d.guest) return false;
  if (d.state === 'away' && G.community?.outing?.pid === d.pid && G.community.outing.phase === 'visiting') return true;
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
  const off = J.off.map(month => `${month} 月`).join('、');
  return `${J.icon} ${J.name} · ${hhmm(J.start)}–${hhmm(J.end)} · ${off}休息 · ${J.wageName ? '零花钱' : '月薪'} ${yuan(J.wage)}${d.nextJob ? ` · 回家后转为${JOBS[d.nextJob].name}` : ''}`;
}
function changeResidentJob(d, job) {
  if (!Object.hasOwn(JOBS,job)) return false;
  if (job === d.job) { delete d.nextJob; return true; }
  if ((d.state === 'away' && G.community?.outing?.pid !== d.pid) || d.act?.type === 'leave') {
    d.nextJob = job;
    return true;
  }
  d.job = job; delete d.nextJob;
  // A career change starts next month and cannot claim a second salary in this one.
  d.lastWorkDay = G.day;
  if (job === 'student') clearRomance(d);
  return true;
}
function returnTime(d) {
  const cycle = Math.floor(d.awayUntil / 1440) + 1;
  const time = hhmm(d.awayUntil);
  return cycle > G.day ? `${monthLabel(cycle)} ${time}` : time;
}
function awayText(d) {
  if (G.community?.outing?.pid === d.pid && G.community.outing.phase === 'visiting') return `在麦麦家做客，约 ${returnTime(d)} 回家`;
  const J = JOBS[d.job] || JOBS.none;
  return `${J.verb}中，约 ${returnTime(d)} 回家`;
}

/* ---------------- 收入与储蓄 ----------------
   上班的人每月下班领月薪（加班多拿 50%），学生有零花钱，自由画家偶尔卖画；
   吃零食、买菜要花钱，每晚 0 点每人交房租水电。钱不够时，恋人或好朋友会帮忙付。 */
const PRICES = { snack: 12, cook: 25 };
const PRICE_NAME = { snack: '零食钱', cook: '买菜钱' };
const RENT = 50;
const START_MONEY = { office: 4000, baker: 2500, barista: 2000, night: 2500, student: 300, artist: 1500, none: 600,
  librarian: 2200, florist: 2100, nurse: 3400, chef: 3000, musicTeacher: 2600, carpenter: 2800, programmer: 4000, courier: 2300 };
const yuan = n => (n < 0 ? '-¥' : '¥') + Math.abs(Math.round(n)).toLocaleString('en-US');

function helperFor(d, amount) {
  return G.dolls
    .filter(o => o !== d && !o.guest && o.state !== 'away' && o.money >= amount && (rel(d, o).lovers || rel(d, o).f >= 50))
    .sort((a, b) => (rel(d, b).lovers - rel(d, a).lovers) || (rel(d, b).f - rel(d, a).f))[0];
}
const canAfford = (d, amount) => TEST_MODE || d.money >= amount || !!helperFor(d, amount);

function pay(d, amount, what) {
  if (TEST_MODE) return true;
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
  const payers = TEST_MODE ? [] : residents().filter(d => d.job !== 'student');   // 学生不用交房租
  for (const d of payers) d.money -= RENT;
  if (payers.length) addLog(`🏠 ${payers.map(d => d.name).join('、')} 交了房租水电，每人 ${yuan(RENT)}`);
  const sb = seasonBill();
  if (sb && payers.length) { for (const d of payers) d.money -= sb[1]; addLog(`${sb[0] === '暖气费' ? '🔥' : '🧊'} 每人还交了${sb[0]} ${yuan(sb[1])}`); }
  for (const d of residents()) if (d.job === 'artist' && Math.random() < (d.paintedDay >= G.day - 1 ? 0.7 : 0.25)) {
    const v = 200 + Math.round(Math.random() * 6) * 100;
    d.money += v; addLog(`🎨 ${d.name} 的画卖出去了，收入 ${yuan(v)}`);
  }
  // 欠债太多的人会出去找工作
  for (const d of residents()) if ((d.job === 'none' || d.job === 'artist') && d.money < -500 && Math.random() < 0.3) {
    d.job = pick(['barista', 'night', 'office']);
    addLog(`💼 ${d.name} 欠了 ${yuan(-d.money)}，终于去找了份工作：${JOBS[d.job].name}`);
  }
  const broke = residents().filter(d => d.money < 0);
  for (const d of broke) d.needs.fun = Math.max(0, d.needs.fun - 20);
  if (broke.length) addLog(`😰 ${broke.map(d => d.name).join('、')} 的存款见底了`);
}
