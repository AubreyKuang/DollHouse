// 卧室：一面带门的隔墙把房子分成左边的卧室和右边的客厅
// 门关上时外面看不到里面——花心的人会趁机把暧昧对象叫进卧室；恋人走进来就会撞破

const BX = 8;
const DY = 5;
const UPPER_DOOR_Y = 16;
const BATH_X = 4;
const BATH_DOOR_Y = 17;
G.bedDoor = true;
G.studyQuiet = false;

const roomOf = d => d.ty >= ROWS ? 'yard' : d.ty >= FLOOR_SPLIT
  ? (G.bathroom && d.tx < BATH_X ? 'bathroom' : d.tx < BX ? 'upperBedroom' : 'study')
  : (d.tx < BX ? 'bed' : 'living');
const inBedroom = d => d.state !== 'away' && roomOf(d) === 'bed';
const canSee = (a, b) => roomOf(a) === roomOf(b) || (a.ty < FLOOR_SPLIT && b.ty < FLOOR_SPLIT && G.bedDoor);
const passageRow = y => y < FLOOR_SPLIT ? DY : UPPER_DOOR_Y;
const crossesDivider = (x1, x2, divider) => Math.min(x1, x2) === divider - 1 && Math.max(x1, x2) === divider;
const wallBetween = (x1, y1, x2, y2) =>
  ((y1 >= ROWS || y2 >= ROWS) ? (y1 >= ROWS) !== (y2 >= ROWS) :
  ((y1 < FLOOR_SPLIT) !== (y2 < FLOOR_SPLIT)) ||
  (crossesDivider(x1, x2, BX) && y1 !== passageRow(y1)) ||
  (G.bathroom && y1 >= FLOOR_SPLIT && crossesDivider(x1, x2, BATH_X) && y1 !== BATH_DOOR_Y));
const isDoorTile = (x, y) => (y === passageRow(y) && (x === BX - 1 || x === BX)) ||
  (G.bathroom && y === BATH_DOOR_Y && (x === BATH_X - 1 || x === BATH_X));
const straddles = (x, y, w) => y < ROWS && ((x < BX && x + w > BX) ||
  (G.bathroom && (y < 0 || y >= FLOOR_SPLIT) && x < BATH_X && x + w > BATH_X));

function blocksDoor({ x, y }, { w, h }) {
  for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
    if (isDoorTile(col, row)) return true;
  }
  return false;
}

function blocksStairs(f) {
  const { w, h } = FURNITURE[f.id], column = stairsColumn();
  return f.x <= column && column < f.x + w &&
    [LOWER_LANDING, UPPER_LANDING].some(row => f.y <= row && row < f.y + h);
}

function fitHouseFurniture() {
  for (const f of [...G.furniture]) {
    const F = FURNITURE[f.id], layer = layerOf(f.id);
    const wall = layer === 'wall';
    const upper = f.y < 0 || f.y >= FLOOR_SPLIT;
    const first = wall ? (upper ? UPPER_WALL : 0) : (upper ? FLOOR_SPLIT : WALL_ROWS);
    const end = wall ? first + WALL_ROWS : (upper ? ROWS : FLOOR_SPLIT);
    if (!straddles(f.x, f.y, F.w) && !(layer === 'solid' && (blocksDoor(f, F) || blocksStairs(f)))) continue;

    let best = null;
    for (let y = first; y + F.h <= end; y++) for (let x = 0; x + F.w <= COLS; x++) {
      const distance = Math.abs(x - f.x) + Math.abs(y - f.y);
      if ((!best || distance < best.distance) && canPlace(f.id, x, y, f)) best = { x, y, distance };
    }
    if (best) {
      f.x = best.x; f.y = best.y;
      addLog(`🧳 为隔墙或楼梯腾出空间，${F.name}移到了同层的空位`);
    } else {
      G.furniture = G.furniture.filter(other => other !== f);
      if (!f.piece) stash(f.id);
      addLog(`🧳 为隔墙或楼梯腾出空间，${F.name}收进了仓库`);
    }
  }
}

// Retrofit unoccupied upstairs walls once. These are ordinary movable windows;
// a later save remembers the upgrade even if the player removes a window.
function addMissingUpperWindows() {
  const rooms = G.bathroom ? [[0, BATH_X], [BATH_X, BX], [BX, COLS]] : [[0, BX], [BX, COLS]];
  for (const [left, right] of rooms) {
    if (G.furniture.some(f => f.id === 'window' && f.y < 0 && f.x >= left && f.x < right)) continue;
    const center = (left + right - FURNITURE.window.w) / 2;
    const positions = [];
    for (let x = left; x + FURNITURE.window.w <= right; x++) positions.push(x);
    positions.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    const x = positions.find(x => canPlace('window', x, UPPER_WALL));
    if (x !== undefined) addFurniture('window', x, UPPER_WALL);
  }
}

function doorOpenNow() { return G.bedDoor || G.dolls.some(d => d.state !== 'away' && d.ty === DY && (d.tx === BX - 1 || d.tx === BX)); }

// The dividing wall is shown as a full-height cut edge. Its door and
// threshold stay at the real crossing tile further inside the room.
function bedroomDoorRect() {
  const floor = STOREYS[0];
  return { x: HOUSE_X + BX * T, y: houseY(DY * T, floor) };
}

function partitionDrawables(c) {
  const { x, y } = bedroomDoorRect();
  const drawables = [{ y: y + FLOOR_STEP, draw: () => {
    R(c, x - 5, y + 2, 10, 2, '#b29a81');
    if (!doorOpenNow()) {
      R(c, x - 5, y - 16, 6, 18, '#78645d');
      R(c, x - 4, y - 15, 4, 16, '#bf9a7f');
      R(c, x - 2, y - 7, 1, 1, '#f7d390');
    }
  } }];
  if (G.bathroom) {
    const bx = HOUSE_X + BATH_X * T, by = houseY(BATH_DOOR_Y * T, STOREYS[1]);
    drawables.push({ y: by + FLOOR_STEP, draw: () => R(c, bx - 5, by + 2, 10, 2, '#ddcfaf') });
  }
  if (G.studyQuiet) {
    const x = HOUSE_X + BX * T, y = houseY(UPPER_DOOR_Y * T, STOREYS[1]);
    drawables.push({ y: y + FLOOR_STEP, draw: () => {
      R(c, x - 5, y - 11, 10, 7, '#665851');
      R(c, x - 4, y - 10, 8, 5, '#f7d390');
      R(c, x - 2, y - 8, 4, 1, '#665851');
    } });
  }
  return drawables;
}

function hitBedDoor(p) {
  const { x, y } = bedroomDoorRect();
  return Math.abs(p.x - x) <= 7 && p.y >= y - 16 && p.y <= y + 7;
}
function toggleBedDoor() {
  G.bedDoor = !G.bedDoor;
  SFX.play(G.bedDoor ? 'pick' : 'place');
  HOOK.toast(G.bedDoor ? '🚪 卧室门打开了' : '🚪 卧室门关上了', true);
}

/* ---------------- 卧室约会（地下情） ---------------- */
function bigbedInBedroom() { return G.furniture.find(f => f.id === 'bigbed' && f.y < FLOOR_SPLIT && f.x + FURNITURE.bigbed.w <= BX); }
// 卧室里除了这两个人没有别人（睡着的也算有人）
function bedroomEmptyFor(a, b) { return !G.dolls.some(o => o !== a && o !== b && inBedroom(o)); }

function canTryst(d, p) {
  if (!canRomance(d, p)) return false;
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
