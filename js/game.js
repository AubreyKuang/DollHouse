// 游戏状态、房间格子、寻路、小人 AI、时间流逝
const TEST_MODE = document.body?.dataset?.mode === 'test';
const SAVE_KEY = TEST_MODE ? 'pixel-dollhouse-test-v1' : 'pixel-dollhouse-v1';
const MIN_PER_SEC = 4;               // 现实 1 秒 = 游戏 4 分钟，一天约 6 分钟
const HOOK = { refresh() {}, select() {}, toast() {}, logged() {}, community() {} };

// 像模拟人生那样的生活日志：每条记下年月、几点、发生了什么
function addLog(text) {
  G.log.push({ d: G.day, t: Math.floor(G.time), text });
  if (typeof rememberHomeLog === 'function') rememberHomeLog(text);
  if (G.log.length > 300) G.log.shift();
  HOOK.logged();
}

// 躺下的家具：人藏起来，只在枕头上画个头
const LIE = { bed: 1, bigbed: 1, cloudBed: 1, bath: 1 };
const lying = d => d.state === 'act' && d.act && d.act.onFurn && LIE[d.act.furn.id];
function headPos(d) {
  const f = d.act.furn;
  if (f.id === 'bigbed') return { x: f.x * T + 13 + (d.act.seat || 0) * 22, y: f.y * T };
  return { x: f.x * T + 16, y: f.y * T };
}

const G = {
  wall: 'cream', floor: 'oak', time: 480, day: 1, speed: 1, mode: 'live',
  furniture: [], dolls: [], sel: null, sky: '#9fd3f0', night: false, dark: 0,
  build: { placing: null, trash: false, hover: null }, rel: {}, log: [],
  fund: 800, level: 1, inv: {}, crowdDay: 0, paperPending: false,
  t: 0, uid: 1,
};

/* ---------------- 存档 ---------------- */
const validHouseSave=s=>Array.isArray(s.furniture)&&Array.isArray(s.dolls);
function houseSaveData() {
  return {
    cottageLooksV: 2, houseWindowsV: 1, floorsV: 1, yardV: 1, bathroom: G.bathroom, community: G.community, monthEvents: G.monthEvents, paper: G.paper, daily: G.daily, dayRelations: G.dayRelations,
    wall: G.wall, floor: G.floor, time: G.time, day: G.day, paperMoments: G.paperMoments,
    keepsakes: G.keepsakes, home: G.home, care: G.care, life: G.life,
    furniture: [...G.furniture, ...(G.build.placing?.moved ? [{ ...G.build.placing, ...G.build.placing.orig }] : [])]
      .map(({ id, x, y, key, piece, soloReading }) => ({ id, x, y, key, piece, ...(soloReading ? { soloReading } : {}) })),
    dolls: G.dolls.map(d => ({ guest: d.guest, pid: d.pid, name: d.name, gender: d.gender, heart: d.heart, zodiac: d.zodiac, mbti: d.mbti, persona: d.persona, job: d.job, money: d.money, look: d.look, needs: d.needs,
      tx:d.tx, ty:d.ty, dir:d.dir, routineTimes: d.routineTimes, vain: d.vain,
      away: d.state === 'away', awayUntil: d.awayUntil, lastWorkDay: d.lastWorkDay, leaveJitter: d.leaveJitter, overtime: d.overtime, nextJob: d.nextJob })),
    npcMemory: G.npcMemory, rel: G.rel, log: G.log, fund: G.fund, level: G.level, inv: G.inv, crowdDay: G.crowdDay, bedDoor: G.bedDoor, roomsV: 1, ageV: 1, weather: G.weather, wKey: G.wKey,
    studyQuiet: G.studyQuiet, studyQuietUntil: studyQuietTimed() ? G.studyQuietUntil : null,
    trust: G.trust, jealousy: G.jealousy, habits: G.habits, dayTrust: G.dayTrust, lastDaily: G.lastDaily, savedAt: Date.now(),
  };
}
function save(touch = false) {
  let ok = false;
  try {
    ok = SaveManager.save(SaveManager.getStorage(),SAVE_KEY,houseSaveData(),validHouseSave,{touch});
  } catch (e) { /* The toolbar offers an export if browser storage is unavailable. */ }
  G.saveOk = ok;
  HOOK.saved?.(ok);
  return ok;
}
// v1 存档没有信任、醋意和搭子记录：补上空表，其余照旧读取
function migrateHouseSave(s, from) {
  if (!s || typeof s !== 'object') return s;
  if (from < 2) {
    s.trust ??= {}; s.jealousy ??= {}; s.habits ??= {}; s.dayTrust ??= {}; s.lastDaily ??= {};
  }
  return s;
}
// 每月开始时留一份快照，最多 4 份，可以从月报里回到那个月初
function snapshotHouseMonth() {
  try { SaveManager.snapshot(SaveManager.getStorage(), SAVE_KEY, houseSaveData(), validHouseSave, { label: 'm-' + G.day, day: G.day }); } catch { /* 存不下就算了 */ }
}
function restoreHouseSnapshot(index, expected) {
  const s = SaveManager.restore(SaveManager.getStorage(), SAVE_KEY, index, validHouseSave, migrateHouseSave, expected);
  if (!s) return false;
  return replaceHouseSave(s);
}
function replaceHouseSave(data, alongside = []) {
  if (SaveManager.status(SaveManager.getStorage(), SAVE_KEY) !== 'ready') return false;
  const previous = { ...G }, previousBlock = BLOCK, previousCols = COLS;
  const restored = { ...data, savedAt: Date.now() };
  try {
    applySave(restored); rebuild();
    if (SaveManager.save(SaveManager.getStorage(), SAVE_KEY, houseSaveData(), validHouseSave, { touch: true, alongside })) {
      G.saveOk = true; HOOK.saved?.(true);
      return true;
    }
  } catch { /* Keep the live house when a restore cannot be applied. */ }
  Object.assign(G, previous);
  setWorldSize(previousCols);
  BLOCK = previousBlock;
  SFX.setRain(G.weather === 'rain');
  G.saveOk = false; HOOK.saved?.(false);
  return false;
}
let lastSavedAt = 0;
function load() {
  const s = SaveManager.load(SaveManager.getStorage(),SAVE_KEY,validHouseSave,migrateHouseSave);
  applySave(s || defaultHouseSave());
  lastSavedAt = s?.savedAt || 0;
  if (!SaveManager.snapshots(SaveManager.getStorage(), SAVE_KEY).some(entry => entry.label === 'm-' + G.day)) snapshotHouseMonth();
}
// Hidden and closed pages both use the same capped catch-up simulation.
const OFFLINE_KEY = TEST_MODE ? 'house-test-offline' : 'house-offline';
let catchingUp = false;

function offlineEnabled() {
  try { return localStorage.getItem(OFFLINE_KEY) !== 'off'; } catch { return false; }
}

function catchUpOffline(since, now = Date.now()) {
  if (!since || !offlineEnabled()) return null;
  const seconds = Math.min(1440 / MIN_PER_SEC, Math.max(0, (now - since) / 1000));
  if (!seconds) return null;
  const hooks = { toast: HOOK.toast, logged: HOOK.logged };
  const speed = G.speed;
  let happened = 0;
  HOOK.toast = () => {};
  HOOK.logged = () => { happened++; };
  G.speed = 1;
  catchingUp = true;
  try {
    for (let t = 0; t < seconds; t += .25) update(Math.min(.25, seconds - t));
  } finally {
    catchingUp = false;
    Object.assign(HOOK, hooks);
    G.speed = speed;
  }
  const minutes = Math.round(seconds * MIN_PER_SEC);
  if (happened || minutes >= 60) {
    const duration = minutes >= 60 ? `约 ${Math.round(minutes / 60)} 小时` : `${minutes} 分钟`;
    addLog(`🌙 离开期间，小屋过了${duration}，发生了 ${happened} 件事`);
  }
  return { minutes, happened };
}
function defaultHouseSave() {
  const initial = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  if (TEST_MODE) {
    for (const [id, x, y] of [
      ['vanity', 17, 4], ['teaTray', 20, 6], ['herbStand', 23, 5],
      ['craftBench', 17, 14], ['scrapbook', 20, 13], ['punchingBag', 23, 15], ['puzzleDesk', 19, 9],
    ]) initial.furniture.push({ id, x, y });
  }
  return initial;
}
function applySave(s) {
  G.npcMemory = s.npcMemory; G.paper = (s.paper || []).map(formatSavedPaper); G.daily=s.daily || {};
  G.paperMoments = s.paperMoments || [];
  G.wall = s.wall; G.floor = s.floor; G.bathroom = s.bathroom === true; G.time = s.time ?? 480; G.day = s.day ?? 1;
  G.monthEvents = s.monthEvents ?? G.day;
  G.community = restoreCommunity(s.community);
  if (G.community.active) {
    const event = G.community.active;
    event.reserved = {};
    if (!event.leavingAt && (event.kind === 'picnic' || (event.exchange && !event.exchangeDone))) {
      event.credited ||= [...event.joined];
      event.joined = [];
    }
  }
  G.keepsakes = restoreKeepsakes(s.keepsakes);
  G.home = restoreHomeStories(s.home);
  G.care = restoreHomeCare(s.care);
  G.life = restoreLifeMoments(s.life);
  G.build = { placing: null, trash: false, hover: null };
  G.furniture = []; G.dolls = []; G.rel = s.rel || {}; G.log = s.log || [];
  G.trust = s.trust || {}; G.jealousy = s.jealousy || {}; G.habits = s.habits || {}; G.dayTrust = s.dayTrust || { ...G.trust }; G.lastDaily = s.lastDaily || {};
  G.fund = s.fund ?? 800; G.level = TEST_MODE ? LEVELS.length - 1 : s.level || 1; G.inv = s.inv || {}; G.crowdDay = s.crowdDay || 0; G.bedDoor = s.bedDoor ?? true;
  G.studyQuiet = s.studyQuiet === true;
  const quietUntil = s.studyQuietUntil, now = absNow();
  G.studyQuietUntil = !G.studyQuiet && Number.isInteger(quietUntil) && quietUntil > now &&
    quietUntil <= now + STUDY_QUIET_MINUTES ? quietUntil : null;
  G.weather = s.weather || 'sunny'; G.wKey = s.wKey || 0; SFX.setRain(G.weather === 'rain');
  setWorldSize(LEVELS[G.level].cols);
  for (const f of s.furniture) if (FURNITURE[f.id]) addFurniture(f.id, f.x, f.y, f);
  if (!s.yardV) for (const [id, x, y] of YARD_DEFAULT) {
    if (canPlace(id, x, y)) addFurniture(id, x, y);
  }
  if(!s.floorsV)for(const [id,x,y] of [['desk',2,13],['shelf',5,13],['mirror',10,13],['bed',2,17],['chair',5,16]]){
    if(canPlace(id,x,y))addFurniture(id,x,y);
  }
  fitHouseFurniture();
  if (!s.houseWindowsV) addMissingUpperWindows();
  ensureDoor(); BLOCK = blockedMap();
  for (const d of s.dolls) {
    if (d.guest && d.pid !== G.community.active?.guestPid) continue;
    const previous = s.cottageLooksV === 1 && COTTAGE_STARTER_LOOKS[d.pid];
    const unchanged = previous && Object.keys(previous).every(key => d.look?.[key] === previous[key]);
    addDoll(unchanged ? { ...d, look: ORIGINAL_STARTER_LOOKS[d.pid] } : d);
  }
  // 老存档：开局的小桃原来是学生，现在改成成年的咖啡师
  if (!s.ageV) for (const d of G.dolls) if (d.pid === 'p-tao' && d.job === 'student') {
    d.job = 'barista'; addLog(`🎓 ${d.name} 毕业了，现在是一名${JOBS.barista.name}`);
  }
  G.dayRelations=s.dayRelations||houseRelations();
  G.sel = null;
}

/* ---------------- 家具与格子 ---------------- */
function addFurniture(id, x, y, saved = {}) {
  const key = saved.key || 'f-' + G.keepsakes.nextFurniture++;
  const f = { uid: G.uid++, id, x, y, key, piece: saved.piece, active: false, users: [] };
  if (id === 'chair' && saved.soloReading === true) f.soloReading = true;
  G.furniture.push(f);
  return f;
}
const layerOf = id => FURNITURE[id].layer || 'solid';

function canPlace(id, x, y, ignore) {
  const d = FURNITURE[id], L = layerOf(id);
  if (x < 0 || x + d.w > COLS) return false;
  if (d.outdoor ? y < ROWS + 1 || y + d.h >= YARD_END : y >= ROWS) return false;
  if (L === 'solid' && blocksStairs({ id, x, y })) return false;
  if(y<FLOOR_SPLIT&&y+d.h>FLOOR_SPLIT)return false;
  if (L === 'wall') {
    const start = y < 0 ? UPPER_WALL : 0;
    if (y < start || y + d.h > start + WALL_ROWS) return false;
    if (id === 'door' && y !== WALL_ROWS - 2) return false;
  }
  else if (y < WALL_ROWS || (!d.outdoor && y + d.h > ROWS)) return false;
  if (straddles(x, y, d.w)) return false;
  if (L === 'solid' && blocksDoor({ x, y }, d)) return false;
  for (const f of G.furniture) {
    if (f === ignore || layerOf(f.id) !== L) continue;
    const e = FURNITURE[f.id];
    if (x < f.x + e.w && x + d.w > f.x && y < f.y + e.h && y + d.h > f.y) return false;
  }
  return true;
}

// 能走的格子：地板区域里没有实心家具
function blockedMap() {
  const m = [];
  for (let x = 0; x < COLS; x++) { m[x] = []; for (let y = 0; y < YARD_END; y++) m[x][y] = y < WALL_ROWS; }
  for (const f of G.furniture) {
    if (layerOf(f.id) !== 'solid') continue;
    const d = FURNITURE[f.id];
    for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) m[f.x + i][f.y + j] = true;
  }
  return m;
}
let BLOCK = null;
function rebuild() {
  BLOCK = blockedMap();
  // 被家具压住的小人挪到最近的空地
  for (const d of G.dolls) {
    if (d.state === 'away' || (d.state === 'act' && d.act.onFurn)) continue;
    if (BLOCK[d.tx] && BLOCK[d.tx][d.ty]) { const p = nearestFree(d.tx, d.ty); if (p) placeDollAt(d, p.x, p.y); }
    if (d.state === 'walk' || d.state === 'arrive') endAct(d);
    d.path = [];
  }
}
const free = (x, y) => x >= 0 && y >= 0 && x < COLS && y < YARD_END && !BLOCK[x][y];

function nearestFree(x, y, floor) {
  const first = floor === 3 ? ROWS : floor === 2 ? FLOOR_SPLIT : WALL_ROWS;
  const end = floor === 1 ? FLOOR_SPLIT : floor === 2 ? ROWS : YARD_END;
  x = Math.max(0, Math.min(COLS - 1, x)); y = Math.max(first, Math.min(end - 1, y));
  const seen = new Set([x + ',' + y]), q = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.shift();
    if (free(cx, cy)) return { x: cx, y: cy };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
      if (nx < 0 || ny < first || nx >= COLS || ny >= end || seen.has(k)) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  return null;
}

// BFS 寻路：从 (sx,sy) 走到 goals 里任意一个格子
function findPath(sx, sy, goals) {
  const goalSet = new Set(goals.filter(g => free(g.x, g.y)).map(g => g.x + ',' + g.y));
  if (!goalSet.size) return null;
  const prev = new Map([[sx + ',' + sy, null]]), q = [[sx, sy]];
  while (q.length) {
    const [cx, cy] = q.shift(), k = cx + ',' + cy;
    if (goalSet.has(k)) {
      const path = []; let cur = k;
      while (cur) { const [a, b] = cur.split(',').map(Number); path.unshift({ x: a, y: b }); cur = prev.get(cur); }
      path.shift(); return path;
    }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].sort(() => Math.random() - 0.5);
    const neighbors = dirs.map(([dx, dy]) => [cx + dx, cy + dy])
      .filter(([nx, ny]) => !wallBetween(cx, cy, nx, ny));
    if (cx === stairsColumn() && cy === LOWER_LANDING) neighbors.push([cx, UPPER_LANDING]);
    if (cx === stairsColumn() && cy === UPPER_LANDING) neighbors.push([cx, LOWER_LANDING]);
    if (yardGate(cx) && cy === FLOOR_SPLIT - 1) neighbors.push([cx, ROWS]);
    if (yardGate(cx) && cy === ROWS) neighbors.push([cx, FLOOR_SPLIT - 1]);
    for (const [nx, ny] of neighbors) {
      const nk = nx + ',' + ny;
      if (!free(nx, ny) || prev.has(nk)) continue;
      prev.set(nk, k); q.push([nx, ny]);
    }
  }
  return null;
}

// 使用家具时站的位置：优先家具正下方，其次左右两侧
function approachTiles(f) {
  const d = FURNITURE[f.id], out = [];
  const end = f.y < FLOOR_SPLIT ? FLOOR_SPLIT : f.y < ROWS ? ROWS : YARD_END;
  const front = f.y + d.h < end;
  if (front) for (let i = 0; i < d.w; i++) out.push({ x: f.x + i, y: f.y + d.h });
  if (d.mode === 'on' || !front) for (let j = 0; j < d.h; j++) {
    const y = f.y + j, right = f.x + d.w;
    if (!wallBetween(f.x, y, f.x - 1, y)) out.push({ x: f.x - 1, y });
    if (!wallBetween(right - 1, y, right, y)) out.push({ x: right, y });
  }
  if (!front && f.y - 1 >= (f.y < FLOOR_SPLIT ? WALL_ROWS : FLOOR_SPLIT)) {
    for (let i = 0; i < d.w; i++) out.push({ x: f.x + i, y: f.y - 1 });
  }
  return out;
}

/* ---------------- 小人 ---------------- */
function addDoll(src) {
  const d = {
    uid: G.uid++, guest: !!src.guest, pid: src.pid || Math.random().toString(36).slice(2, 10), name: src.name, persona: Object.hasOwn(PERSONAS, src.persona) ? src.persona : 'genki', look: { ...src.look },
    needs: src.needs ? { ...src.needs } : { energy: 60 + Math.random() * 40, hunger: 50 + Math.random() * 40, fun: 50 + Math.random() * 40, social: 50 + Math.random() * 40 },
    x: 0, y: 0, tx: 0, ty: 0, dir: 'down', frame: 0, ft: 0, state: 'idle', path: [], act: null,
    routineTimes: { ...src.routineTimes },
    think: Math.random() * 2, bubble: null, blink: 0, blinkT: 2 + Math.random() * 3, hop: 0, happy: 0,
    gender: src.gender || (Math.random() < 0.5 ? 'f' : 'm'), heart: src.heart || 'normal',
    // 老存档没有星座/MBTI：开局的四位用设定好的，其他人随机
    zodiac: src.zodiac || (DEFAULT_SAVE.dolls.find(o => o.pid === src.pid) || {}).zodiac || randomZodiac(),
    mbti: src.mbti || (DEFAULT_SAVE.dolls.find(o => o.pid === src.pid) || {}).mbti || randomMbti(),
    job: src.job || 'none', money: src.money ?? Math.round((START_MONEY[src.job || 'none'] || 600) + Math.random() * 500), awayUntil: src.awayUntil || 0, lastWorkDay: src.lastWorkDay || 0, leaveJitter: src.leaveJitter || 0, overtime: !!src.overtime,
    vain: typeof src.vain === 'boolean' ? src.vain : undefined,
    nextJob: Object.hasOwn(JOBS,src.nextJob) ? src.nextJob : undefined,
  };
  isVain(d);
  if (TEST_MODE) d.money = Math.max(d.money, 1000000);
  d.needs.bladder ??= 85;
  G.dolls.push(d);
  if (!BLOCK) BLOCK = blockedMap();
  const p = nearestFree(2 + ((Math.random() * (COLS - 4)) | 0), WALL_ROWS + 1 + ((Math.random() * (ROWS - WALL_ROWS - 2)) | 0));
  if (p) placeDollAt(d, p.x, p.y);
  if(Number.isInteger(src.tx)&&Number.isInteger(src.ty)&&free(src.tx,src.ty))placeDollAt(d,src.tx,src.ty);
  if(src.dir)d.dir=src.dir;
  if (src.away) d.state = 'away';
  return d;
}
function placeDollAt(d, x, y) { d.tx = x; d.ty = y; d.x = x * T + 8; d.y = y * T + 14; }

function say(d, text, dur = 2.6) { if (text) { d.bubble = { text, t: dur, id: Math.random() }; SFX.play('pop'); } }
const pick = a => a[(Math.random() * a.length) | 0];

function takingStairs(d) {
  return d.state === 'walk' && d.path.length > 0 && d.ty < ROWS && d.path[0].y < ROWS && Math.abs(d.path[0].y - d.ty) > 1;
}
const takingYardPath = d => d.state === 'walk' && d.path.length > 0 && (d.ty >= ROWS) !== (d.path[0].y >= ROWS);

function endAct(d) {
  if (takingStairs(d) || takingYardPath(d)) placeDollAt(d, d.tx, d.ty);
  const a = d.act;
  if (G.community.active && ['visitGather', 'visitStay'].includes(a?.type)) delete G.community.active.reserved[d.pid];
  if (a && a.furn) {
    a.furn.users = a.furn.users.filter(u => u !== d);
    a.furn.active = a.furn.users.length > 0;
    if (a.onFurn) placeDollAt(d, a.back.x, a.back.y);
  }
  if (a && a.partner && a.partner.act && a.partner.act.partner === d) { a.partner.act = null; a.partner.state = 'idle'; a.partner.think = 1; }
  d.act = null; d.state = 'idle'; d.hop = 0; d.ft = 0; d.think = 1 + Math.random() * 2;
  if (a?.tension && a.t <= 0 && a.partner) stepAwayAfterTension(d, a.partner);
}

function decide(d) {
  if (tryHomeCare(d)) return;
  if (tryLifeLesson(d)) return;
  if (joinGetTogether(d)) return;
  const P = PERSONAS[d.persona], N = d.needs, opts = [];
  const want = (gain) => Object.entries(gain).reduce((s, [k, v]) => s + Math.max(0, v) * Math.pow(1 - N[k] / 100, 1.5) * 3, 0);
  for (const f of G.furniture) {
    const F = FURNITURE[f.id];
    if (!F.use || homeFurnitureReserved(f) || (G.keepsakes.project && G.keepsakes.project.bench === f.key) || (d.guest && F.use === 'sleep')) continue;
    const cap = F.cap ?? (f.id === 'sofa' || f.id === 'bigbed' ? 2 : 1);
    if (f.users.length >= cap) continue;
    if (PRICES[F.use] && !canAfford(d, PRICES[F.use])) continue;   // 买不起就不去了
    const lover = loverOf(d);
    // 双人床只和恋人一起睡
    if (f.id === 'bigbed' && f.users.length && !f.users.every(u => u === lover)) continue;
    const use = isWindowChair(f) ? 'read' : F.use;
    const gain = use !== F.use ? { ...F.need, fun: 10 } : F.need;
    let s = want(gain) + (P.like[use] || 0) + traitBonus(d, use) + Math.random() * 25 * noiseMul(d);   // 性格 + 星座/MBTI + 随机
    if (JOBS[d.job]?.interests?.includes(F.use)) s += 10;
    if (cornerRegular(f, d)) s += 17;
    if (F.use === 'sit' || F.use === 'read') s += readingCornerBonus(d, f);
    if (F.outdoor) {
      if (G.weather === 'rain' || G.night) continue;
      s += F.use === 'swing' && ['active', 'genki'].includes(d.persona) ? 24 : 13;
    }
    if (F.use === 'toilet') {
      if (N.bladder >= 48) continue;
      s += N.bladder < 20 ? 75 : 20;
    }
    if (F.use === 'sleep') s += G.night ? 70 : (N.energy > 45 ? -60 : 0);
    else if (G.night && N.energy < 60) s -= 20;
    if (f.id === 'bigbed' && lover) s += f.users.includes(lover) ? 60 : 20;
    if (F.use === 'paint' && d.job === 'artist') s += 40;          // 画家要画画才卖得出画
    if (F.use === 'study' && d.job === 'student') s += 15;
    if (['exercise', 'boxPractice'].includes(F.use) && N.energy < 30) s -= 40;
    if (d.recentFurniture?.use === use && d.recentFurniture.at + 125 > absNow() && !['sleep', 'toilet', 'snack', 'cook', 'meal'].includes(use)) s -= 25;
    if (F.use === 'party') s += isHolidayParty() ? 50 : -10;           // 圣诞节大家围着圣诞树过节
    if(F.use==='meal'){
      const evening=G.time>=17*60&&G.time<21*60;
      s+=evening?18+f.users.length*12:0;
    }
    if(F.use==='groom')s+=groomBonus(d);              // 爱美的人更常去照镜子
    s+=companionBonus(d,f,F.use);                      // 饭搭子、游戏搭子在用，就想凑过去
    if(inPrivateRoomTile(f)&&!isE(d))s+=6;             // 内向的人喜欢待在卧室里
    const distance = f.y >= ROWS && d.ty < FLOOR_SPLIT ? f.y - ROWS + FLOOR_SPLIT - d.ty : Math.abs(f.y - d.ty);
    s -= (Math.abs(f.x - d.tx) + distance) * 1.2;
    const paperMoment = paperFollowup(d, f);
    opts.push({ s: s + (paperMoment ? 35 : 0), type: F.use, furn: f, paperMoment });
  }
  // 只有闲着、闲逛、或在做不重要的小事的人可以被拉去聊天；表演中的人只能被围观
  const others = G.dolls.filter(o => o !== d && (o.state === 'idle' || (o.state === 'walk' && o.act && o.act.type === 'wander') ||
    (o.state === 'act' && o.act && !o.act.onFurn && !Object.hasOwn(ROUTINES, o.act.type) && !JOIN[o.act.type] && o.act.type !== 'chat' && o.act.type !== 'join' && o.act.type !== 'visitStay'))
    && !inHomeTime(o) && !CARE_ACTIONS.includes(o.act?.type) && canDisturb(d, o));   // 不打断正在端饭、吃留饭的人
  if (others.length) {
    const p = pickPartner(d, others), r = rel(d, p);
    opts.push({ s: want({ social: 30 }) + (P.like.chat || 0) + traitBonus(d, 'chat') + Math.random() * 25 * noiseMul(d) + Math.max(0, r.f) * 0.23 + (canSee(d, p) && Math.abs(d.tx - p.tx) + Math.abs(d.ty - p.ty) <= 4 ? 10 : 0) + r.l * 0.15 + (r.lovers ? 15 : 0) + (G.furniture.some(f=>f.id==='sofa'&&Math.hypot(f.x-d.tx,f.y-d.ty)<5)?12:0), type: 'chat', partner: p });
  }
  // 恋人在家就想黏在一起；花心的人会去找暧昧对象，对象不在家时更大胆
  const lover = loverOf(d), lvBusy = lover && (lover.state === 'away' || lying(lover));
  if (d.jealousOf && d.jealousOf.until > absNow() && others.includes(d.jealousOf.who)) opts.push({ s: 999, type: 'chat', partner: d.jealousOf.who, kind: 'argue', jealous: true });
  if (lover && others.includes(lover)) opts.push({ s: want({ social: 30 }) + 28 + rel(d, lover).l * 0.25 + Math.random() * 20, type: 'chat', partner: lover });
  if (d.heart === 'fickle') {
    const crush = others.filter(o => o !== lover && rel(d, o).l >= 15).sort((a, b) => rel(d, b).l - rel(d, a).l)[0];
    if (crush) opts.push({ s: 18 + rel(d, crush).l * 0.5 + (lvBusy ? 30 : lover ? 0 : 10) + Math.random() * 20, type: 'chat', partner: crush });
    if (crush && canTryst(d, crush)) opts.push({ s: 30 + rel(d, crush).l * 0.6 + (lvBusy ? 25 : 0) + Math.random() * 20, type: 'tryst', partner: crush });
  }
  for (const o of G.dolls) {
    if (o === d || !joinable(o) || !canSee(d,o)) continue;
    const J = JOIN[o.act.type], r = rel(d, o);
    const buddy = o.act.type === 'game' && bondTagged(d, o, 'game') ? 25 : 0;
    opts.push({ s: want({ fun: 16, social: 12 }) + (P.like[J.like] || 0) * 0.7 + (P.like.chat || 0) * 0.4 + r.f * 0.25 + r.l * 0.2 + 8 + buddy + traitBonus(d, 'join') + Math.random() * 20 * noiseMul(d) - (G.night ? 15 : 0), type: 'join', target: o });
  }
  opts.push({ s: want({ fun: 10 }) + (P.like.dance || 0) + traitBonus(d, 'dance') + Math.random() * 15 * noiseMul(d) - (G.night ? 20 : 0), type: 'dance' });
  opts.push({ s: 12 + (P.like.wander || 0) + traitBonus(d, 'wander') + Math.random() * 20 * noiseMul(d), type: 'wander' });
  opts.push(...routineOptions(d, want));
  opts.sort((a, b) => b.s - a.s);
  for (const o of opts.slice(0, 4)) if (startAct(d, o)) return;
  d.think = 2;
}

// 让小人去做某件事；成功规划路线返回 true
function startAct(d, o) {
  if (Object.hasOwn(ROUTINES, o.type)) return startRoutine(d, o);
  if (o.type === 'dance') { d.state = 'act'; d.act = { type: 'dance', t: 9 + Math.random() * 4 }; nudgeAudience(d); say(d, pick(ACT_LINES.dance)); return true; }
  if (o.type === 'wander') {
    const goal = nearestFree((Math.random() * COLS) | 0, WALL_ROWS + ((Math.random() * (ROWS - WALL_ROWS)) | 0));
    const path = goal && findPath(d.tx, d.ty, [goal]);
    if (!path || !path.length) return false;
    d.path = path; d.state = 'walk'; d.act = { type: 'wander' };
    if (Math.random() < 0.25) say(d, pick(PERSONAS[d.persona].lines));
    return true;
  }
  if (o.type === 'join') return startJoin(d, o.target);
  if (o.type === 'tryst') return startTryst(d, o.partner);
  if (o.type === 'chat') {
    // 优先站到对方左右两边，这样两个人不会上下叠在一起
    const p = o.partner, side = [[1, 0], [-1, 0]].map(([a, b]) => ({ x: p.tx + a, y: p.ty + b }));
    const path = findPath(d.tx, d.ty, side) || findPath(d.tx, d.ty, [[0, 1], [0, -1]].map(([a, b]) => ({ x: p.tx + a, y: p.ty + b })));
    if (!path) return false;
    d.path = path; d.state = 'walk'; d.act = { type: 'chat', partner: p, pending: true, kind: o.kind, jealous: o.jealous, exchange: o.exchange };
    if (o.jealous) { d.jealousOf = null; say(d, `${p.name}，你过来一下！`); }
    if (p.state === 'idle' || (p.state === 'walk' && p.act && p.act.type === 'wander')) { p.path = []; p.act = null; p.state = 'wait'; p.waitT = 8; }
    return true;
  }
  const f = o.furn, F = FURNITURE[f.id];
  if (furnitureInUse(f)) return false;
  const path = o.path ?? furniturePath(d, f);
  if (!path) return false;
  f.users.push(d);
  d.path = path; d.state = path.length ? 'walk' : 'arrive';
  const reading = isWindowChair(f);
  d.act = { type: reading ? 'read' : F.use, furn: f, gain: reading ? { ...F.need, fun: 10 } : F.need,
    mode: F.mode, paperMoment: o.paperMoment };
  return true;
}

function arrive(d) {
  const a = d.act;
  if (CARE_ACTIONS.includes(a?.type)) { arriveHomeCare(d); return; }
  if (a?.type === 'homeTime') { arriveHomeTime(d); return; }
  if (['makeKeepsake', 'rainTea'].includes(a?.type)) { arriveKeepsake(d); return; }
  if (a?.type === 'visitLeave') { finishGuestDeparture(); return; }
  if (a?.type === 'neighborLeave') { arriveNeighborOuting(d); return; }
  if (a?.type === 'visitGather') { arriveAtGathering(d); return; }
  if (a && Object.hasOwn(ROUTINES, a.type)) { beginRoutine(d); return; }
  if (a && a.type === 'join') { arriveJoin(d); return; }
  if (a && a.type === 'leave') { exitHome(d); return; }
  if (a && a.type === 'tryst') { arriveTryst(d); return; }
  if (!a || a.type === 'wander') { d.act = null; d.state = 'idle'; d.think = 0.5 + Math.random() * 2; return; }
  if (a.type === 'chat') {
    const p = a.partner;
    if (!G.dolls.includes(p) || inHomeTime(p) || ['lift', 'away'].includes(p.state) || (p.act && p.act.onFurn) ||
        (a.exchange && (!['idle', 'wait'].includes(p.state) || !canSee(d, p) || !canDisturb(d, p) ||
          Math.abs(d.tx - p.tx) + Math.abs(d.ty - p.ty) !== 1))) { endAct(d); return; }
    if (p.act && (p.act.type === 'visitStay' || Object.hasOwn(ROUTINES, p.act.type) || (p.act.type === 'chat' && p.act.partner !== d))) { say(d, '在忙呢，下次吧'); endAct(d); return; }
    if (p.act && (p.act.furn || p.act.type === 'join')) endAct(p);
    startSocial(d, p);
    return;
  }
  const f = a.furn, F = FURNITURE[f.id];
  if (!G.furniture.includes(f)) { endAct(d); return; }
  if (PRICES[a.type] && !pay(d, PRICES[a.type], PRICE_NAME[a.type])) { say(d, '钱不够了……'); endAct(d); d.think = 4; return; }
  d.state = 'act';
  a.t = a.type === 'toilet' ? 4 : a.type === 'sleep' ? 28 + Math.random() * 10 : 7 + Math.random() * 5;
  if (JOIN[a.type] && a.type !== 'read') { a.t = 16 + Math.random() * 8; nudgeAudience(d); }
  const PDur = PERSONAS[d.persona].dur; if (PDur && PDur[a.type]) a.t *= PDur[a.type];
  a.t *= durMul(d);   // J 型更专注，P 型更容易换下一件事
  a.back = { x: d.tx, y: d.ty };
  f.active = true;
  if (F.mode === 'on') {
    a.onFurn = true;
    if (f.id === 'sofa' || f.id === 'bigbed') {
      const left = !f.users.some(u => u !== d && u.act && u.act.seat === 0); a.seat = left ? 0 : 1;
      if (f.id === 'sofa') { d.x = f.x * T + 8 + a.seat * 16; d.y = f.y * T + 13; }
    }
    else if (f.id === 'chair' || f.id === 'beanbag') { d.x = f.x * T + 8; d.y = f.y * T + (f.id === 'chair' ? 10 : 12); }
    else if (F.outdoor) {
      a.seat = f.users.some(o => o !== d && o.act?.seat === 0) ? 1 : 0;
      d.x = f.x * T + (f.id === 'gardenSwing' ? 14 : 8) + a.seat * 16;
      d.y = f.y * T + 10;
    }
    d.dir = 'down';
    if (f.id === 'treadmill') { d.x = f.x * T + 18; d.y = f.y * T + 11; d.dir = 'left'; }
  } else {
    // 站在家具前：朝家具的方向
    const cx = (f.x + F.w / 2) * T, cy = (f.y + F.h / 2) * T;
    face(d, cx, cy);
  }
  d.recentFurniture = { use: a.type, at: absNow() };
  countHouseActivity(a.type,d.name);
  completePaperFollowup(d, f);
  noteCornerUse(d, f);
  if ((F.outdoor || a.type === 'puzzle') && F.cap > 1) {
    const companion = f.users.find(o => o !== d && o.state === 'act');
    if (companion) {
      bump(d, companion, 3);
      addLog(`🌿 ${d.name} 和 ${companion.name} 一起${ACT_NAMES[a.type]}`);
    }
  }
  const mealMate = a.type === 'meal' && f.users.find(o => o !== d && o.state === 'act' && o.act?.type === 'meal');
  if(a.type==='meal'){
    if (mealMate) addLog(`🍲 ${d.name} 和 ${mealMate.name} 一起用餐`);
    noteSharedMeal(d,f);
    if(G.time>=17*60&&G.time<21*60)helpWithMeal(d,f);
  }
  if(a.type==='groom')afterGroom(d);
  if (a.type === 'chess') {
    const opponent = f.users.find(o => o !== d && o.state === 'act');
    if (opponent) {
      bump(d, opponent, 2);
      countHouseActivity('chess', `${opponent.name} 和 ${d.name}`);
      addLog(`♟ ${opponent.name} 和 ${d.name} 下了一局棋`);
    }
  }
  const mate = f.id === 'bigbed' && f.users.find(u => u !== d && lying(u));
  say(d, mate ? pick(['晚安～💕', '往里挪一点嘛', '抱着睡～']) : pick(ACT_LINES[a.type] || ['…']));
  if (mealMate && !houseExchangeActive(mealMate) && mealMate.act.t > 3.2) {
    startHouseExchange(d, mealMate, tensionLines(d, mealMate) || ['坐下吃饭啦，你今天怎么样？', '现在能一起吃顿饭，挺好的。', '那我们慢慢吃。']);
  }
  if (f.id === 'bigbed' && !mate) inviteLover(d, f);
  if (mate && !(f.coupleLogAt > absNow() - 600)) { f.coupleLogAt = absNow(); addLog(`🛏 ${mate.name} 和 ${d.name} 一起睡了`); }   // 一晚只记一次
  const snd = { snack: 'eat', cook: 'cook', piano: 'piano', game: 'game', bath: 'splash', shower: 'splash', wash: 'splash', cat: 'meow', water: 'splash' }[a.type];
  if (snd) SFX.play(snd);
}

function face(d, x, y) {
  const dx = x - d.x, dy = y - d.y;
  d.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

/* ---------------- 每帧更新 ---------------- */
function updateDoll(d, dt) {
  const P = PERSONAS[d.persona], N = d.needs;
  for (const k in P.decay) N[k] = Math.max(0, N[k] - P.decay[k] * decayMul(d, k) * MIN_PER_SEC / 60 * dt);
  if (G.furniture.some(f => f.id === 'toilet')) N.bladder = Math.max(0, N.bladder - 11 * MIN_PER_SEC / 60 * dt);
  d.blinkT -= dt; if (d.blinkT < 0) { d.blink = 0.15; d.blinkT = 2 + Math.random() * 4; }
  if (d.blink > 0) d.blink -= dt;
  if (d.happy > 0) d.happy -= dt;
  if (d.bubble) { d.bubble.t -= dt; if (d.bubble.t <= 0) d.bubble = null; }
  if (d.state === 'lift') { d.ft += dt; if (d.ft > 0.2) { d.ft = 0; d.frame = (d.frame + 1) % 2; } return; }
  if (workTick(d, dt)) return;

  if (d.state === 'wait') { d.waitT -= dt; if (d.waitT <= 0) d.state = 'idle'; return; }
  if (d.state === 'arrive') { arrive(d); return; }

  if (d.state === 'walk') {
    const n = d.path[0];
    if (!n) { arrive(d); return; }
    if (!free(n.x, n.y)) { endAct(d); d.path = []; return; }
    const gx = n.x * T + 8, gy = n.y * T + 14, dx = gx - d.x, dy = gy - d.y, dist = Math.hypot(dx, dy);
    const onStairs = takingStairs(d);
    const sp = P.speed * T * dt * (N.energy < 20 ? 0.6 : 1) * (takingYardPath(d) ? 6 : onStairs ? 2 : 1);
    if (onStairs) d.dir = n.y === UPPER_LANDING ? 'up' : 'down';
    else if (dist > 0.01) face(d, gx, gy);
    if (dist <= sp) {
      const from = { x: d.tx, y: d.ty };
      d.x = gx; d.y = gy; d.tx = n.x; d.ty = n.y; d.path.shift();
      greetPassingReader(d, from);
      if (!d.path.length) arrive(d);
    }
    else { d.x += dx / dist * sp; d.y += dy / dist * sp; }
    d.ft += dt; if (d.ft > 0.13) { d.ft = 0; d.frame = (d.frame + 1) % 4; }
    return;
  }
  d.frame = 0;

  if (d.state === 'act') {
    const a = d.act;
    if (CARE_ACTIONS.includes(a.type)) { tickCareAction(d, dt); return; }
    if (a.readingPause > 0) {
      a.readingPause -= dt;
      return;
    }
    if (a.furn && a.t > 0) a.practiceTime = (a.practiceTime || 0) + Math.min(dt, a.t);
    if (a.gain) for (const k in a.gain) N[k] = Math.max(0, Math.min(100, N[k] + a.gain[k] / (a.type === 'sleep' ? 10 : 8) * dt));
    if (a.type === 'sleep') N.energy = Math.min(100, N.energy + 2.2 * dt);
    if (a.type === 'visitStay' || (a.type === 'homeTime' && a.homeKind === 'music')) {
      d.ft += dt;
      if (a.dance) { d.frame = Math.floor(d.ft * 5) % 4; d.hop = d.frame % 2; }
      if (a.theme === 'music' && G.community.active?.hostPid === d.pid && Math.random() < dt * .8) SFX.play('piano');
    }
    if (a.type === 'dance') { d.ft += dt; if (d.ft > 0.25) { d.ft = 0; d.frame = (d.frame + 1) % 4; d.dir = ['down', 'right', 'up', 'left'][d.frame]; } d.hop = d.frame % 2 ? 2 : 0; N.fun = Math.min(100, N.fun + 2 * dt); }
    if (a.exchange) tickHouseExchange(d, dt);
    if (a.type === 'chat') tickSocial(d, dt);
    if (a.type === 'join') { tickJoin(d, dt); if (!d.act) return; }
    if (a.type !== 'homeTime' && a.type !== 'chat' && a.type !== 'join' && a.type !== 'sleep' && !houseExchangeActive(d) && Math.random() < dt * 0.12) say(d, pick(ACT_LINES[a.type] || ['♪']));
    if (a.type === 'sleep' && Math.random() < dt * 0.15) { d.bubble = { text: 'Zzz…', t: 2, id: Math.random() }; SFX.play('snore'); }
    if (a.type === 'sleep' && a.furn.id === 'bigbed') {
      const mate = a.furn.users.find(u => u !== d && lying(u));
      if (mate && rel(d, mate).lovers) { const r = rel(d, mate); r.l = Math.min(100, r.l + 0.3 * dt); if (Math.random() < dt * 0.08) spawnHeart(d, '💕'); }
    }
    if ((a.type === 'piano' || a.type === 'strum') && Math.random() < dt * 3) SFX.play('piano');
    if (a.type === 'exercise' || a.type === 'boxPractice' || a.type === 'yoga' || ROUTINES[a.type]?.motion === 'stretch') {
      d.ft += dt;
      const interval = a.type === 'exercise' ? .09 : a.type === 'yoga' ? .45 : .23;
      d.frame = Math.floor(d.ft / interval) % 4;
      if (a.type === 'clapGame' || a.type === 'rehearse') d.hop = d.frame % 2;
    }
    if (a.type === 'paint' && d.job === 'artist') d.paintedDay = G.day;
    if (a.type === 'music' && Math.random() < dt * 2) SFX.play('game');
    if (a.type === 'game' && Math.random() < dt * 2) SFX.play('game');
    a.t -= dt;
    const wake = a.type === 'sleep' && !G.night && N.energy > 92;
    if (a.t <= 0 && a.type === 'read' && a.furn?.id === 'chair') say(d, '这一段读完了。');
    if (a.type === 'toilet' && a.t <= 0) N.bladder = 100;
    if (a.t <= 0) finishTalentPractice(d, a);
    if (a.type === 'cook' && a.t <= 0) {
      shareCookedMeal(d);
      if (!planSavedMeal(d, a.mealRecipient) && a.mealRecipient) HOOK.toast('这次没能留饭。室友已回来，或餐桌暂时不可用。', true);
    }
    if (a.t <= 0 || wake) endAct(d);
    return;
  }

  // 发呆中：偶尔自言自语，到时间就决定下一件事
  d.think -= dt;
  // 懒懒会站着打盹
  if (d.persona === 'lazy' && Math.random() < dt * 0.04) { d.blink = 3; d.think += 3; say(d, pick(['💤 呼……', '（站着睡着了）', 'zzz'])); }
  if (Math.random() < dt * 0.04) {
    const low = Object.entries(N).sort((a, b) => a[1] - b[1])[0];
    const sad = { bladder: '想去一下洗手间…', energy: '好困……', hunger: '肚子咕咕叫', fun: '好无聊～', social: '有点寂寞' };
    say(d, low[1] < 25 ? sad[low[0]] : (Math.random() < 0.3 && (homeWishLine(d) || wishLine(d))) || pick(P.lines));
  }
  if (d.think <= 0) decide(d);
}

const hearts = [];
function spawnHeart(d, txt = '❤') {
  hearts.push({ doll: d, dx: Math.random() * 8 - 4, t: 1, txt });
}

function petDoll(d) {
  if (d.state === 'lift' || d.state === 'away') return;
  if (d.act && d.act.type === 'sleep') { say(d, '唔……别吵'); return; }
  d.needs.fun = Math.min(100, d.needs.fun + 12); d.needs.social = Math.min(100, d.needs.social + 15);
  d.happy = 2; say(d, pick(ACT_LINES.pet)); spawnHeart(d); spawnHeart(d); SFX.play('love');
  addLog(`🤚 你摸了摸 ${d.name} 的头`);
}

function furnitureInUse(f, resident) {
  if (G.keepsakes.project?.bench === f.key || homeFurnitureReserved(f)) return true;
  const capacity = FURNITURE[f.id].cap ?? (f.id === 'sofa' || f.id === 'bigbed' ? 2 : 1);
  return f.users.length - Number(f.users.includes(resident)) >= capacity;
}

function furnitureOrderBlock(d, f) {
  const spec = FURNITURE[f.id];
  if (!spec.use) return `「${spec.name}」是摆设，不能安排活动`;
  if (d.state === 'away') return `${d.name} 还没回家`;
  if (d.state === 'lift') return `先放下 ${d.name}`;
  if (inHomeTime(d) || CARE_ACTIONS.includes(d.act?.type) || d.act?.type === 'leave') {
    return `${d.name}正在忙，等这件事做完再安排吧`;
  }
  if (d.guest && spec.use === 'sleep') return '访客不在这里睡觉哦';
  if (furnitureInUse(f, d)) return `「${spec.name}」正在使用中`;
  return '';
}

function furniturePath(d, f, x = d.tx, y = d.ty) {
  const distinct = FURNITURE[f.id].cap > 1;
  const tiles = approachTiles(f).filter(tile => !distinct || !f.users.some(user => {
    if (user === d) return false;
    const destination = user.path.at(-1) || user;
    return tile.x === (destination.tx ?? destination.x) && tile.y === (destination.ty ?? destination.y);
  }));
  return tiles.some(tile => tile.x === x && tile.y === y) ? [] : findPath(x, y, tiles);
}

// 选中的小人被点到的家具上去
function orderUse(d, f) {
  const F = FURNITURE[f.id];
  let blocked = furnitureOrderBlock(d, f);
  const path = blocked ? null : d.act?.onFurn ? furniturePath(d, f, d.act.back.x, d.act.back.y) : furniturePath(d, f);
  if (!blocked && !path) blocked = `从这里走不到「${F.name}」旁边，试试别件家具`;
  if (blocked) { HOOK.toast(blocked, true); SFX.play('deny'); return false; }
  if (d.act) endAct(d);
  const meal = savedMealFor(d, f);
  if (meal && beginCareAction(d, meal, 'savedMeal')) return true;
  if (!startAct(d, { type: F.use, furn: f, path })) {
    HOOK.toast(`「${F.name}」现在无法使用，试试别件家具`, true);
    SFX.play('deny');
    return false;
  }
  say(d, '好的～', 1.2);
  return true;
}

/* ---------------- 时间与天色 ---------------- */
const SKY = [[0, '#1d2348'], [5, '#2b3366'], [6.2, '#f6b38a'], [8, '#9fd3f0'], [17, '#9fd3f0'], [18.6, '#f59a7a'], [20, '#3a3a78'], [24, '#1d2348']];
const DARK = [[0, .55], [5, .5], [7, 0], [17, 0], [19, .25], [21, .5], [24, .55]];
function lerpKeys(keys, h, mix) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [h0, v0] = keys[i], [h1, v1] = keys[i + 1];
    if (h >= h0 && h <= h1) return mix(v0, v1, (h - h0) / (h1 - h0));
  }
  return keys[0][1];
}
const mixNum = (a, b, t) => a + (b - a) * t;
const mixHex = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
};

let saveT = 0;
function update(realDt) {
  const dt = realDt * G.speed;
  G.t += realDt;
  const running = dt > 0 && (catchingUp || (!document.getElementById('paperDialog')?.open && !document.getElementById('homeDialog')?.open && !document.getElementById('saveDialog')?.open));
  if (running) {
    if (G.monthEvents !== G.day) {
      startHouseMonth();
      save();
    }
    G.time += dt * MIN_PER_SEC;
    if (G.time >= 1440) {
      finishHouseMonth(catchingUp);
      G.time -= 1440;
      G.day++;
      HOOK.toast(`☀️ ${monthLabel(G.day)}开始啦`);
      nightlyBills();
      startHouseMonth();
      save();
      snapshotHouseMonth();
      SFX.play('newday');
    }
    const h = G.time / 60;
    G.sky = lerpKeys(SKY, h, mixHex); G.dark = lerpKeys(DARK, h, mixNum);
    G.night = h >= 21 || h < 6;
    seasonTick();
    communityTick();
    // 有小人被拎在手里时，其他人先定住不动：落点目标不会自己跑开
    const carrying = G.dolls.some(d => d.state === 'lift');
    if (!carrying) tickKeepsakes(dt);
    if (!carrying) tickHomeStories(dt);
    if (!carrying) tickHomeCare();
    if (!carrying) tickLifeMoments();
    for (const d of G.dolls) { if (carrying && d.state !== 'lift') continue; updateDoll(d, dt); }
  }
  updateDoors(realDt);
  if (running) { socialTick(dt); trystTick(); bondsTick(dt); }
  for (let i = hearts.length - 1; i >= 0; i--) { hearts[i].t -= realDt; if (hearts[i].t <= 0) hearts.splice(i, 1); }
  if (running) { saveT += realDt; if (saveT > 5) { saveT = 0; save(); } }
}
