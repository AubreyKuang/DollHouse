// Furniture keeps its identity when moved. These records contain only saveable IDs.
function restoreKeepsakes(saved) {
  return {
    nextFurniture: saved?.nextFurniture || 1,
    corners: saved?.corners || {},
    pieces: saved?.pieces || [],
    traditions: saved?.traditions || {},
    project: saved?.project || null,
  };
}

const KEEPSAKE_FINISHES = { rose: ['莓果粉', '#cf8e9e'], sage: ['鼠尾草绿', '#91ad93'], honey: ['蜂蜜木色', '#d5aa79'] };
const cornerDistance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const cornerRoom = f => roomOf({ tx: f.x, ty: f.y < 0 ? FLOOR_SPLIT : Math.max(f.y, WALL_ROWS) });

function cornerKind(f) {
  if (G.keepsakes.corners[f.key]?.kind) return G.keepsakes.corners[f.key].kind;
  if (f.id === 'teaTray') return 'tea';
  if (f.id === 'piano') return 'music';
  if (f.id === 'shelf') return 'read';
  if (f.id === 'chair' && G.furniture.some(w => w.id === 'window' && cornerRoom(w) === cornerRoom(f) &&
      Math.abs(w.x + 1 - f.x) <= 3)) return 'read';
  return null;
}

const CORNER_NAMES = { tea: '茶角', music: '练琴角', read: '阅读角' };
const cornerOwner = f => G.keepsakes.corners[f.key]?.owner;
const cornerRegular = (f, d) => G.keepsakes.corners[f.key]?.regulars?.includes(d.pid);

function noteCornerUse(d, f) {
  const kind = cornerKind(f);
  if (!kind || d.guest) return;
  const record = G.keepsakes.corners[f.key] ||= { kind, visits: {}, regulars: [] };
  const last = record.visits[d.pid];
  const companion = kind === 'tea' ? f.users.find(other => other !== d && other.state === 'act' && cornerRegular(f, other)) :
    kind === 'read' && record.owner && G.dolls.find(other => other !== d && other.state === 'act' && other.act?.furn &&
      cornerOwner(other.act.furn) === other.pid && cornerKind(other.act.furn) === 'read' &&
      cornerRoom(other.act.furn) === cornerRoom(f) && cornerDistance(other.act.furn, f) <= 3);
  if (companion && cornerRegular(f, d) && record.sharedMonth !== G.day) {
    record.sharedMonth = G.day;
    if (kind === 'read') G.keepsakes.corners[companion.act.furn.key].sharedMonth = G.day;
    bump(d, companion, 3);
    addLog(`🫖 ${d.name}和${companion.name}又在老地方一起${kind === 'tea' ? '喝茶' : '看书'}。`);
  }
  if (last?.month === G.day) return;
  const months = (last?.months || 0) + 1;
  record.visits[d.pid] = { month: G.day, months };
  if (months < 2 || record.regulars.includes(d.pid)) return;
  record.regulars.push(d.pid);
  if (!record.owner || !communityDoll(record.owner)) {
    record.owner = d.pid;
    addLog(`📖 ${d.name}有了自己的${CORNER_NAMES[kind]}，下次还想来这里。`);
  } else {
    const owner = communityDoll(record.owner);
    if (owner) addLog(`🫖 ${d.name}也常来${owner.name}的${CORNER_NAMES[kind]}，两人习惯给彼此留个位置。`);
  }
}

function drawCornerMark(c, f, x, y) {
  const owner = cornerOwner(f);
  if (!owner || !communityDoll(owner)) return;
  if (f.id === 'piano') {
    bevel(c, x + 20, y - 10, 6, 5, '#f1d7a5', '#937481');
    detail(c, x + 21, y - 8, 3.5, .5, '#b48388');
  } else if (f.id === 'teaTray') {
    bevel(c, x + 4, y - 3, 5, 4, '#f1d7b1', '#9d7780');
    if (G.keepsakes.corners[f.key].regulars.length > 1) detail(c, x + 3, y - 1.5, 1, 1, '#a5847d');
  } else if (f.id === 'chair' || f.id === 'shelf') {
    const bx = x + (f.id === 'chair' ? 4 : 24), by = y + (f.id === 'chair' ? 2 : 3);
    bevel(c, bx, by, 6, 4, '#ca8a9b', '#795661');
    detail(c, bx + 1, by + 2, 4, .5, '#f2d3aa');
  }
}

function pairRoutes(a, b, tiles) {
  const routes = d => tiles.map(tile => ({ tile, path: findPath(d.tx, d.ty, [tile]) })).filter(r => r.path);
  let best = null;
  for (const left of routes(a)) for (const right of routes(b)) {
    if (left.tile === right.tile || cornerDistance(left.tile, right.tile) !== 1) continue;
    const cost = left.path.length + right.path.length;
    if (!best || cost < best.cost) best = { cost, routes: [left.path, right.path] };
  }
  return best?.routes;
}

function sendKeepsakePair(pair, routes, type, key) {
  for (const [i, d] of pair.entries()) {
    if (d.act) endAct(d);
    d.path = routes[i];
    d.act = { type, keepsakeKey: key };
    d.state = d.path.length ? 'walk' : 'arrive';
  }
}

function readyForKeepsake(d) {
  return d && d.state !== 'away' && d.state !== 'lift' && !takingStairs(d) && !takingYardPath(d) &&
    !lying(d) && d.needs.energy >= 25 && d.needs.bladder >= 18 && !['homeTime', 'leave', 'neighborLeave', 'visitLeave', 'makeKeepsake', 'rainTea'].includes(d.act?.type);
}

function startKeepsakeProject(a, b, finish) {
  if (G.keepsakes.project || !a || !b || a === b || a.guest || b.guest ||
      !Object.hasOwn(KEEPSAKE_FINISHES, finish) || ![a, b].every(readyForKeepsake)) return false;
  const bench = G.furniture.find(f => f.id === 'craftBench' && f.users.every(d => d === a || d === b) &&
    pairRoutes(a, b, approachTiles(f)));
  if (!bench) return false;
  G.keepsakes.project = { people: [a.pid, b.pid], finish, bench: bench.key, expires: absNow() + 240, work: 0 };
  tickKeepsakes(0);
  save();
  return true;
}

function finishKeepsake(project, pair) {
  const names = pair.map(d => d.name);
  G.keepsakes.pieces.push({ key: 'piece-' + G.keepsakes.nextFurniture++, finish: project.finish,
    makers: names, month: G.day });
  const text = `${names.join('和')}一起做成了${KEEPSAKE_FINISHES[project.finish][0]}花架。`;
  rememberKeepsakePair(pair, 'shared-craft', text);
  addLog(`🪴 ${text}成品已收进布置里的纪念物。`);
  G.keepsakes.project = null;
  pair.forEach(endAct);
  HOOK.refresh();
  save();
}

function rememberKeepsakePair(pair, type, text) {
  const [a, b] = pair;
  bump(a, b, 5);
  addTrust(a, b, 3);
  addTrust(b, a, 3);
  NPCMemory.record(G, { type, time: absNow(), participants: [a.pid, b.pid], outcome: 'shared' },
    pair.map((d, i) => ({ person: d.pid, subject: pair[1 - i].pid, emotion: .7, impact: 70, interpretation: text })));
}

function arriveKeepsake(d) {
  const work = d.act.type === 'makeKeepsake';
  d.state = 'act';
  d.act.t = 60;
  d.act.gain = { fun: 8, social: 10 };
  d.dir = 'up';
  say(d, work ? ({
    maker: '我来把木边磨圆。', stylist: '这里再添一点颜色。', genki: '我已经想好放什么花了！',
    tidy: '我把螺丝都排好了。', nerd: '我量一量，两边得一样高。',
  })[d.persona] || '我来扶住这边。' : '给你留了一杯热茶。');
}

function noteRainTradition(a, b) {
  const key = relKey(a, b);
  G.keepsakes.traditions[key] ||= { people: [a.pid, b.pid], first: G.day, last: G.day };
}

function startRainTea(key, pair) {
  const tiles = [];
  for (const f of G.furniture) {
    if (!['teaTray', 'chair', 'shelf'].includes(f.id) || cornerRoom(f) !== 'study') continue;
    tiles.push(...approachTiles(f));
  }
  const backup = [];
  for (let y = FLOOR_SPLIT; y < ROWS; y++) for (let x = BX; x < COLS; x++) backup.push({ x, y });
  const open = candidates => [...new Map(candidates.map(tile => [`${tile.x},${tile.y}`, tile])).values()]
    .filter(tile => tile.x >= BX && tile.y >= FLOOR_SPLIT && tile.y < ROWS && free(tile.x, tile.y) &&
      !isDoorTile(tile.x, tile.y) && !(tile.x === stairsColumn() && tile.y === UPPER_LANDING));
  const routes = pairRoutes(...pair, open(tiles)) || pairRoutes(...pair, open(backup));
  if (!routes) return false;
  sendKeepsakePair(pair, routes, 'rainTea', key);
  return true;
}

function tickKeepsakes(dt) {
  const k = G.keepsakes;
  const project = k.project;
  if (project) {
    const pair = project.people.map(communityDoll);
    const bench = G.furniture.find(f => f.key === project.bench);
    const assigned = d => d?.act?.type === 'makeKeepsake' && d.act.keepsakeKey === project.bench;
    if (!bench || pair.some(d => !d) || absNow() >= project.expires) {
      pair.filter(assigned).forEach(endAct);
      k.project = null;
      addLog('🪵 手工暂时搁下了，有空可以再约。');
      save();
    } else if (pair.every(assigned)) {
      if (pair.every(d => d.state === 'act')) {
        project.work += dt;
        if (project.work >= 5) finishKeepsake(project, pair);
      }
    } else {
      pair.filter(assigned).forEach(endAct);
      if (pair.every(readyForKeepsake) && bench.users.every(d => pair.includes(d))) {
        const routes = pairRoutes(...pair, approachTiles(bench));
        if (routes) sendKeepsakePair(pair, routes, 'makeKeepsake', bench.key);
      }
    }
  }

  // Once a rain-day ritual has begun, finish it only if both actually reach the study.
  for (const [key, tie] of Object.entries(k.traditions)) {
    const pair = tie.people.map(communityDoll);
    const assigned = d => d?.act?.type === 'rainTea' && d.act.keepsakeKey === key;
    if (pair.every(assigned)) {
      if (!pair.every(d => d.state === 'act')) continue;
      tie.last = G.day;
      const text = `又下雨了，${pair[0].name}给${pair[1].name}在二楼留了一杯茶，两人又在书房坐到了一起。`;
      rememberKeepsakePair(pair, 'rain-tea-tradition', text);
      addLog(`🫖 ${text}`);
      for (const d of pair) {
        d.act.t = 5;
        d.act.keepsakeKey = null;
      }
      save();
      continue;
    }
    pair.filter(assigned).forEach(endAct);
    if (tie.last >= G.day || G.weather !== 'rain' || G.time < 13 * 60 || G.time >= 20 * 60) continue;
    if (pair.every(readyForKeepsake) && !G.community.outing && !G.community.active?.leavingAt && !G.community.active?.rainDeadline) {
      if (G.community.active && G.community.active.guestPid !== pair.find(d => d.guest)?.pid) continue;
      startRainTea(key, pair);
    } else if (!G.community.active && !G.community.outing && tie.invited !== G.day) {
      const host = pair.find(d => d && !d.guest && readyForKeepsake(d));
      const friend = G.community.friends.find(f => tie.people.includes(f.pid) && !communityDoll(f.pid));
      if (host && friend && startGetTogether(host, 'visit', { friend })) {
        tie.invited = G.day;
        save();
      }
    }
  }
}

function keepsakeLabel(piece) {
  return `${KEEPSAKE_FINISHES[piece.finish][0]}花架 · ${piece.makers.join('和')}一起做 · ${monthLabel(piece.month)}`;
}

function keepsakePiece(key) { return G.keepsakes.pieces.find(p => p.key === key); }
function unplacedKeepsakes() {
  const inRoom = new Set(G.furniture.map(f => f.piece));
  if (G.build.placing?.moved) inRoom.add(G.build.placing.piece);
  return G.keepsakes.pieces.filter(p => !inRoom.has(p.key));
}

FURNITURE.handmadePlanter = { name: '手作花架', w: 1, h: 1, fixed: true };
TALL.handmadePlanter = 10;
DRAW.handmadePlanter = (c, x, y, f) => {
  const finish = KEEPSAKE_FINISHES[keepsakePiece(f?.piece)?.finish] || KEEPSAKE_FINISHES.honey;

  for (const px of [x + 2, x + 12]) R(c, px, y - 1, 2, 15, '#785247');
  for (const [i, row] of [-3, 6].entries()) {
    bevel(c, x + 1, y + row + 4, 14, 4, finish[1], '#795b5c');
    bevel(c, x + 4 + i * 2, y + row, 6, 5, i ? '#d9a68a' : '#e5cbae', '#94716f');
    R(c, x + 6 + i * 2, y + row - 4, 1, 5, '#689071');
    R(c, x + 4 + i * 2, y + row - 5, 5, 2, i ? '#e5a7ac' : '#f3d68e');
    detail(c, x + 6 + i * 2, y + row - 4.5, 1, .5, '#fff0c8');
  }
};

FURNITURE.teaTray.cap = 2;
ACT_NAMES.makeKeepsake = '一起做花架';
ACT_NAMES.rainTea = '在书房喝雨天茶';
ACT_LINES.makeKeepsake = ['漆快干了，再等一会儿。'];
ACT_LINES.rainTea = ['雨声和上次一样。'];
