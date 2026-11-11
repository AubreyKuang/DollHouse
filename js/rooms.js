// 卧室：一面带门的隔墙把房子分成左边的卧室和右边的客厅
// 门关上时外面看不到里面——花心的人会趁机把暧昧对象叫进卧室；恋人走进来就会撞破

const BX = 7;           // 隔墙在第 7 列左边（0~6 列是卧室）
const DY = 5;           // 门在第 5 行
G.bedDoor = true;       // 卧室门：true 开着，false 关着

const roomOf = d => (d.tx < BX ? 'bed' : 'living');
const inBedroom = d => d.state !== 'away' && roomOf(d) === 'bed';
// 两个人能不能看见对方：同一个房间，或者门开着
const canSee = (a, b) => roomOf(a) === roomOf(b) || G.bedDoor;
// 两个相邻格子之间有没有墙挡着（只有门那一行能穿过去）
const wallBetween = (x1, y1, x2, y2) => Math.min(x1, x2) === BX - 1 && Math.max(x1, x2) === BX && y1 !== DY;
// 门两边的格子要留出来，不能放实心家具
const isDoorTile = (x, y) => y === DY && (x === BX - 1 || x === BX);
const straddles = (x, w) => x < BX && x + w > BX;

function doorOpenNow() { return G.bedDoor || G.dolls.some(d => d.state !== 'away' && d.ty === DY && (d.tx === BX - 1 || d.tx === BX)); }

// 隔墙按行切成几段，参与“按 y 排序”的绘制，这样小人在墙前墙后都能正确遮挡
function partitionDrawables(c) {
  const out = [], bx = BX * T, ws = WALLS.find(w => w.id === G.wall) || WALLS[0];
  const face = shade(ws.base, -0.12), cap = shade(ws.base, 0.08);
  for (let r = WALL_ROWS; r < ROWS; r++) {
    if (r === DY) {
      out.push({ y: (r + 1) * T - 0.1, draw: () => {
        R(c, bx - 3, r * T, 6, 2, INK);                                  // 门框上沿
        if (doorOpenNow()) { R(c, bx - 14, r * T + 2, 12, 3, INK); R(c, bx - 13, r * T + 3, 10, 1, WOOD_L); }   // 门往卧室里开着
        else { R(c, bx - 3, r * T + 2, 6, T - 2, INK); R(c, bx - 2, r * T + 2, 4, T - 3, WOOD); R(c, bx + 1, r * T + 8, 1, 2, '#f2c33a'); }
      } });
      continue;
    }
    out.push({ y: (r + 1) * T - 0.1, draw: () => {
      const top = r === WALL_ROWS ? r * T - 1 : r * T;
      R(c, bx - 3, top, 6, (r + 1) * T - top, INK);
      R(c, bx - 2, top, 4, (r + 1) * T - top, face);
      R(c, bx - 2, top, 1, (r + 1) * T - top, cap);
      if (r === DY - 1 || r === DY + 1) R(c, bx - 3, r === DY - 1 ? (r + 1) * T - 1 : r * T, 6, 1, INK);
    } });
  }
  return out;
}

// 生活模式下点门：开 / 关
function hitBedDoor(p) { return Math.abs(p.x - BX * T) <= 6 && p.y >= DY * T - 2 && p.y <= (DY + 1) * T + 2; }
function toggleBedDoor() {
  G.bedDoor = !G.bedDoor;
  SFX.play(G.bedDoor ? 'pick' : 'place');
  HOOK.toast(G.bedDoor ? '🚪 卧室门打开了' : '🚪 卧室门关上了', true);
}

// 老存档：把挡住隔墙或门口的家具收进仓库
function migrateRooms() {
  const moved = [];
  for (const f of [...G.furniture]) {
    const F = FURNITURE[f.id], L = layerOf(f.id);
    let bad = straddles(f.x, F.w);
    if (L === 'solid') for (let i = 0; i < F.w; i++) for (let j = 0; j < F.h; j++) if (isDoorTile(f.x + i, f.y + j)) bad = true;
    if (bad && f.id !== 'door') { G.furniture = G.furniture.filter(o => o !== f); stash(f.id); moved.push(FURNITURE[f.id].name); }
  }
  if (moved.length) addLog(`🧳 隔出卧室时，${moved.join('、')}被收进了仓库`);
}

/* ---------------- 卧室约会（地下情） ---------------- */
function bigbedInBedroom() { return G.furniture.find(f => f.id === 'bigbed' && f.x + FURNITURE.bigbed.w <= BX); }
// 卧室里除了这两个人没有别人（睡着的也算有人）
function bedroomEmptyFor(a, b) { return !G.dolls.some(o => o !== a && o !== b && inBedroom(o)); }

function canTryst(d, p) {
  const r = rel(d, p);
  if (r.trystAt > absNow() - 480) return false;            // 一次之后要隔几个小时
  return d.heart === 'fickle' && !r.lovers && (r.secret || r.l >= 40) && r.f >= 30 &&
    bigbedInBedroom() && bedroomEmptyFor(d, p) && interruptible(p) && !(p.heart === 'loyal' && loverOf(p));
}

function startTryst(d, p) {
  const bb = bigbedInBedroom(); if (!bb) return false;
  const spots = approachTiles(bb).filter(t => t.x < BX && free(t.x, t.y) && !isDoorTile(t.x, t.y));
  if (spots.length < 2) return false;
  const pa = findPath(d.tx, d.ty, [spots[0]]), pb = findPath(p.tx, p.ty, [spots[1]]);
  if (!pa || !pb) return false;
  if (d.act) endAct(d); if (p.act) endAct(p);
  d.path = pa; d.state = pa.length ? 'walk' : 'arrive'; d.act = { type: 'tryst', partner: p, since: absNow() };
  p.path = pb; p.state = pb.length ? 'walk' : 'arrive'; p.act = { type: 'tryst', partner: d, since: absNow() };
  say(d, pick(['跟我来一下～', '我们去卧室聊？', '这边没人……']));
  setTimeout(() => p.act && p.act.type === 'tryst' && say(p, pick(['嗯……', '好吧', '去哪？'])), 1200);
  return true;
}

// 两个人都走到卧室后：关门、亲热
function arriveTryst(d) {
  const a = d.act, p = a.partner;
  a.ready = true; d.state = 'wait'; d.waitT = 12;
  if (!p.act || p.act.type !== 'tryst' || p.act.partner !== d) { endAct(d); return; }
  if (!p.act.ready) return;
  G.bedDoor = false;
  const r = rel(d, p);
  if (!r.secret) HOOK.toast(`🤫 ${d.name} 和 ${p.name} 背着别人偷偷暧昧……`);
  r.secret = true; r.trystAt = absNow();
  addLog(`🚪 ${d.name} 和 ${p.name} 躲进卧室，关上了门……`);
  d.act = { type: 'chat', kind: 'kiss', partner: p };
  startSocial(d, p);
  d.act.t = p.act.t = 10 + Math.random() * 5; d.act.tryst = p.act.tryst = true;
}

// 每帧检查：恋人推门进来了吗？
function trystTick() {
  for (const d of G.dolls) {
    const a = d.act;
    if (d.state === 'wait' && a && a.type === 'tryst' && absNow() - a.since > 60) { endAct(d); d.state = 'idle'; }
    if (!a || a.type !== 'chat' || !a.tryst || a.passive || a.caught) continue;
    const p = a.partner;
    for (const [x, other] of [[d, p], [p, d]]) {
      const L = loverOf(x);
      if (L && L !== other && L.state !== 'away' && !lying(L) && inBedroom(L)) {
        a.caught = true; G.bedDoor = true;
        addLog(`🚪 ${L.name} 推开卧室门……`);
        caught(L, x, other);
        return;
      }
    }
  }
}
