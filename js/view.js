// 画面渲染 + 指针交互（拎小人、摆家具）
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
// 扩建后画布跟着变宽
HOOK.resize = () => {
  cv.width = lightCv.width = W + HOUSE_MARGIN;
  cv.height = lightCv.height = HOUSE_HEIGHT;
  ctx.imageSmoothingEnabled = false;
  document.getElementById('stage').style.setProperty('--scene-ratio', cv.width / cv.height);
};
const overlay = document.getElementById('overlay');

const wallSpec = () => WALLS.find(w => w.id === G.wall) || WALLS[0];
const floorSpec = () => FLOORS.find(f => f.id === G.floor) || FLOORS[0];

function dollPose(d) {
  if (d.state === 'lift') return 'lift';
  if (d.state === 'walk') return 'walk';
  if (d.act && d.state === 'act' && d.act.type === 'exercise') return 'walk';
  if (d.state === 'act' && (['yoga', 'boxPractice'].includes(d.act?.type) || ROUTINES[d.act?.type]?.motion === 'stretch')) return 'dance';
  if (d.act && d.state === 'act' && (d.act.type === 'dance' || (['join', 'visitStay'].includes(d.act.type) && d.act.dance))) return 'dance';
  if (d.act && d.act.onFurn && d.state === 'act') return 'sit';
  return 'stand';
}
function drawDollObj(c, d) {
  const { x, y } = houseDollPoint(d);
  drawDoll(c, x, y, d.look, {
    dir: d.dir, frame: d.frame, pose: dollPose(d), hop: d.hop,
    blink: (d.state === 'act' && d.act?.type === 'couchNap') || d.blink > 0 || (d.act && d.act.type === 'read' && d.state === 'act' && Math.sin(G.t * 2) > 0.7),
    happy: d.happy > 0 || (d.act && d.state === 'act' && (['dance', 'game', 'tv', 'snack', 'cat', 'join', 'visitStay'].includes(d.act.type) || (d.act.type === 'chat' && d.act.kind !== 'argue'))),
  });
  if (d.state !== 'act') return;
  if (d.act?.type === 'visitStay') {
    const px = x + 8, py = y - 13 - Math.floor(d.ft * 2) % 3;
    if (d.act.theme === 'music') {
      R(c, px + 2, py - 5, 1, 6, '#f4b6cb');
      R(c, px, py, 3, 2, '#f4b6cb');
      R(c, px + 2, py - 5, 3, 1, '#f8d9e3');
    } else if (d.act.theme === 'games') {
      box(c, px, py, 5, 5, '#f8e6c7', '#8e6d82');
      R(c, px + 2, py + 2, 1, 1, '#a67696');
    } else if (d.act.theme === 'tea') {
      box(c, px, py, 6, 5, '#ffefdc', '#a0747e');
      R(c, px + 6, py + 1, 2, 2, '#f6c8b5');
    }
  }
  const motion = ROUTINES[d.act?.type]?.motion;
  if (motion === 'book') {
    const side = d.dir === 'left' ? -1 : 1;
    box(c, x + side * 9 - 3, y - 12, 7, 5, '#fff1d7', '#8e6d82');
    R(c, x + side * 9, y - 11, 1, 3, '#c69eb4');
  }
  if (motion === 'doze') {
    R(c, x + 7, y - 23, 4, 1, '#f4e5ff');
    R(c, x + 8, y - 22, 2, 1, '#f4e5ff');
    R(c, x + 7, y - 21, 4, 1, '#f4e5ff');
  }
  if (motion === 'spark') {
    R(c, x + 9, y - 18, 1, 5, '#f7d485');
    R(c, x + 7, y - 16, 5, 1, '#f7d485');
  }
}

function render() {
  const c = ctx, t = G.t;
  drawHouseShell(c, wallSpec(), floorSpec());

  for (const f of G.furniture) if (layerOf(f.id) !== 'solid') drawHouseFurniture(c, f, t);

  if (G.mode === 'build') {
    for (const storey of [...STOREYS, YARD]) {
      const { back, front } = storey;
      R(c, HOUSE_X, back, W, front - back, '#48323810');
      for (let x = T; x < W; x += T) R(c, HOUSE_X + x, back, 1, front - back, '#48323824');
      const step = storey.step || FLOOR_STEP;
      for (let y = back + step; y < front; y += step) R(c, HOUSE_X, y, W, 1, '#48323824');
    }
  }

  // Sort by projected feet so characters and objects can pass behind each other.
  const list = [];
  for (const f of G.furniture) {
    if (layerOf(f.id) !== 'solid') continue;
    const { bottom } = houseFurnitureRect(f);
    const sleepers = f.users.filter(u => lying(u) && u.act.furn === f);
    f.occ = sleepers.length ? (slot, hx, hy) => {
      const sleeper = sleepers.find(u => (u.act.seat || 0) === slot);
      if (sleeper) drawDoll(c, hx, hy + 1, sleeper.look, { pose: 'head', dir: 'down' });
    } : null;
    list.push({ y: bottom, draw: () => drawHouseFurniture(c, f, t) });
  }
  for (const d of G.dolls) {
    if (d.state === 'lift' || d.state === 'away' || lying(d)) continue;
    const y = d.act?.onFurn ? houseFurnitureRect(d.act.furn).bottom + .5 : houseDollPoint(d).y;
    list.push({ y, draw: () => drawDollObj(c, d) });
  }
  list.push(...partitionDrawables(c));
  list.sort((a, b) => a.y - b.y).forEach(o => o.draw());

  // 夜晚：整体压暗，台灯/电视/游戏机处“挖洞”透光
  if (G.dark > 0.01) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, cv.width, cv.height);
    lctx.fillStyle = `rgba(18,14,48,${G.dark})`; lctx.fillRect(0, 0, cv.width, cv.height);
    lctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const g = lctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const f of G.furniture) {
      const { x, y, storey } = houseFurnitureRect(f);
      lctx.save();
      lctx.beginPath();
      lctx.rect(HOUSE_X, storey.wall, W, storey.front - storey.wall);
      lctx.clip();
      if (f.id === 'lamp') hole(x + 8, y - 10, 54);
      if (f.id === 'moonLamp' || f.id === 'paperLantern') hole(x + 8, y + 8, 34, .85);
      if (f.id === 'garland') for (let i = 0; i < 8; i += 2) hole(x + 4 + i * 6, y + 9, 16, .55);
      if (f.id === 'aquarium') hole(x + 16, y - 6, 22, .5);
      if (f.id === 'xmastree') hole(x + 8, y - 2, 30, .8);
      if (f.id === 'lantern') hole(x + 8, y + 9, 22, .7);
      if ((f.id === 'pc' || f.id === 'speaker') && f.active) hole(x + 12, y - 10, 24, .7);
      if (f.id === 'tv' && f.active) hole(x + 16, y - 4, 34, .8);
      if (f.id === 'arcade') hole(x + 8, y - 8, 20, f.active ? .8 : .4);
      if (f.id === 'stove' && f.active) hole(x + 8, y - 6, 22, .7);
      if (f.id === 'fridge' && f.active) hole(x + 8, y, 24, .7);
      lctx.restore();
    }
    c.drawImage(lightCv, 0, 0);
    c.globalCompositeOperation = 'lighter';
    for (const f of G.furniture) if (f.id === 'lamp') {
      const { x, y, storey } = houseFurnitureRect(f);
      const g = c.createRadialGradient(x + 8, y - 10, 1, x + 8, y - 10, 36);
      g.addColorStop(0, `rgba(255,190,90,${0.35 * G.dark})`); g.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = g;
      const top = Math.max(storey.wall, y - 48);
      c.fillRect(Math.max(HOUSE_X, x - 30), top, Math.min(HOUSE_X + W, x + 46) - Math.max(HOUSE_X, x - 30), Math.min(storey.front, y + 28) - top);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // 选中的小人头上跳动的小箭头
  const sel = G.dolls.find(d => d.uid === G.sel);
  if (sel && sel.state !== 'lift' && sel.state !== 'away' && G.mode === 'live') {
    const point = houseHeadPoint(sel);
    const ax = point.x, ay = point.y - 7 + Math.round(Math.sin(t * 6));
    R(c, ax - 3, ay, 7, 1, INK); R(c, ax - 2, ay + 1, 5, 1, INK); R(c, ax - 1, ay + 2, 3, 1, INK); R(c, ax, ay + 3, 1, 1, INK);
    R(c, ax - 2, ay, 5, 1, '#ffd35c'); R(c, ax - 1, ay + 1, 3, 1, '#ffd35c');
  }

  if (G.mode === 'build') drawBuildOverlay(c, t);

  // 被拎起来的小人画在最上面
  for (const d of G.dolls) if (d.state === 'lift') {
    if (d.liftShadow) {
      const { x, y } = houseDollPoint(d.liftShadow);
      R(c, x - 4, y - 1, 8, 2, 'rgba(0,0,0,.25)');
    }
    drawDollObj(c, d);
  }
  updateOverlay();
}

function drawHouseFurniture(c, f, t) {
  const { x, y, bottom } = houseFurnitureRect(f);
  if (layerOf(f.id) === 'floor') {
    c.save();
    c.translate(x, bottom - FURNITURE[f.id].h * FLOOR_STEP);
    c.scale(1, FLOOR_STEP / T);
    DRAW[f.id](c, 0, 0, f, t);
    c.restore();
    return;
  }
  DRAW[f.id](c, x, y, f, t);
}

function houseHeadPoint(d) {
  if (!lying(d)) {
    const { x, y } = houseDollPoint(d);
    return { x, y: y - 24 };
  }
  const f = d.act.furn, { y } = houseFurnitureRect(f);
  return { x: HOUSE_X + headPos(d).x - (f.id === 'bath' ? 2 : 0), y: y + (f.id === 'bath' ? -6 : 11) };
}

function drawBuildOverlay(c, t) {
  const B = G.build, hv = B.hover;
  if (B.placing && hv) {
    const id = B.placing.id, f = { id, ...hv };
    const F = FURNITURE[id], rect = houseFurnitureRect(f);
    const wall = layerOf(id) === 'wall';
    const x = rect.x, w = rect.w, bottom = rect.bottom;
    const h = F.h * (wall ? T : rect.storey.step || FLOOR_STEP);
    const y = bottom - h;
    const ok = canPlace(id, hv.x, hv.y, null);
    c.globalAlpha = .75;
    drawHouseFurniture(c, f, t);
    c.globalAlpha = 1;
    R(c, x, y, w, h, ok ? '#7cc57659' : '#e26d6d73');
    c.strokeStyle = ok ? '#4f9a4a' : '#c24d4d';
    c.strokeRect(x + .5, y + .5, w - 1, h - 1);
  } else if (hv?.furn) {
    const { x, w, top, bottom } = houseFurnitureRect(hv.furn);
    R(c, x, top, w, bottom - top, B.trash ? '#e26d6d66' : '#ffd35c4d');
  }
}

/* ---------- DOM 浮层：对话气泡、名字、爱心 ---------- */
const domBubbles = new Map();
function positionOverlay(el, x, y) {
  el.style.left = `${100 * x / cv.width}%`;
  el.style.top = `${100 * y / cv.height}%`;
}
function updateOverlay() {
  const alive = new Set();
  const selected = G.dolls.find(d => d.uid === G.sel);
  const invite = press?.moved && G.mode === 'live' ? dropInteraction(press.point, press.d) : null;
  for (const d of G.dolls) {
    let el = domBubbles.get(d.uid);
    if (!el) { el = { b: document.createElement('div'), n: document.createElement('div'), id: null }; el.b.className = 'bubble'; el.n.className = 'nametag'; overlay.append(el.b, el.n); domBubbles.set(d.uid, el); }
    alive.add(d.uid);
    const { x: hx, y: hy } = houseHeadPoint(d);
    if (d.bubble && d.state !== 'away') {
      if (el.id !== d.bubble.id) { el.b.textContent = d.bubble.text; el.id = d.bubble.id; el.b.style.animation = 'none'; void el.b.offsetWidth; el.b.style.animation = ''; }
      el.b.style.display = ''; positionOverlay(el.b, hx, hy - 2);
    } else el.b.style.display = 'none';
    const partner = selected && arePartners(selected, d);
    const dropTarget = invite?.target === d;
    const showName = d.state !== 'away' && (d === selected || d.uid === hoverDoll || partner || dropTarget);
    el.n.style.display = showName ? '' : 'none';
    if (showName) {
      const np = lying(d) ? { x: hx, y: hy + 20 } : houseDollPoint(d);
      const paired = partner || G.dolls.some(o => arePartners(d, o));
      const label = dropTarget ? (invite.spot ? `💬 放下和${d.name}互动` : invite.reason) : paired ? `♥ ${d.name}` : d.name;
      if (el.n.textContent !== label) el.n.textContent = label;
      el.n.classList.toggle('couple-name', paired);
      el.n.classList.toggle('drop-target', dropTarget);
      positionOverlay(el.n, np.x, np.y + 2);
    }
  }
  for (const [uid, el] of domBubbles) if (!alive.has(uid)) { el.b.remove(); el.n.remove(); domBubbles.delete(uid); }
  for (const h of hearts) {
    if (!h.el) { h.el = document.createElement('div'); h.el.className = 'heart'; h.el.textContent = h.txt; overlay.append(h.el); const { x, y } = houseHeadPoint(h.doll); positionOverlay(h.el, x + h.dx, y); }
  }
  for (const el of overlay.querySelectorAll('.heart')) if (!hearts.some(h => h.el === el)) el.remove();
}

/* ---------- 指针交互 ---------- */
let hoverDoll = null, press = null;
function toScene(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height };
}

function dollAt(p, exclude) {
  let best = null;
  for (const d of G.dolls) {
    if (d === exclude || d.state === 'away' || d.state === 'lift') continue;
    const { x, y: top } = houseHeadPoint(d);
    const y = lying(d) ? top + 12 : houseDollPoint(d).y;
    if (Math.abs(p.x - x) <= 7 && p.y >= top && p.y <= y + 1 && (!best || y > best.y)) best = { d, y };
  }
  return best?.d;
}

function dropInteraction(point, carried) {
  const direct = dollAt(point, carried);
  const column = Math.floor((point.x - HOUSE_X) / T);
  if (column < 0 || column >= COLS) return null;
  let target = null, closest = Infinity;
  for (const d of G.dolls) {
    if (d === carried || ['away', 'lift'].includes(d.state) || takingStairs(d) || takingYardPath(d)) continue;
    if (d === direct) { target = d; break; }
    if (direct || roomOf(d) !== roomOf({ tx: column, ty: d.ty })) continue;
    const head = houseHeadPoint(d);
    const feet = lying(d) ? head.y + 12 : houseDollPoint(d).y;
    if (Math.abs(point.x - head.x) > T * 1.35 || point.y < head.y - 4 || point.y > feet + 5) continue;
    const distance = Math.hypot(point.x - head.x, point.y - head.y - 10);
    if (distance < closest) { target = d; closest = distance; }
  }
  if (!target) return null;
  if (target.state === 'wait' || ['chat', 'tryst', 'leave', 'visitLeave', 'sleep', 'couchNap', 'bath', 'toilet', 'shower'].includes(target.act?.type)) {
    return { target, reason: `${target.name} 正在忙` };
  }

  // Prefer a free tile beside the partner. The cutaway projects depth to only a few pixels.
  const room = roomOf(target);
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: target.tx + dx, y: target.ty + dy, dx }));
  spots.sort((a, b) => Math.abs(b.dx) - Math.abs(a.dx) || Math.abs(a.x - column) - Math.abs(b.x - column));
  const spot = spots.find(({ x, y }) => free(x, y) && !wallBetween(target.tx, target.ty, x, y) &&
    roomOf({ tx: x, ty: y }) === room && !isDoorTile(x, y) && !G.dolls.some(o => o !== carried && o.state !== 'away' && o.tx === x && o.ty === y));
  return { target, spot, reason: `${target.name} 身边没有空位` };
}

function furnAt(p) {
  let best = null;
  for (const f of G.furniture) {
    const { x, w, top, bottom } = houseFurnitureRect(f);
    if (p.x < x || p.x >= x + w || p.y < top || p.y >= bottom) continue;
    const priority = { floor: 0, wall: 1, solid: 2 }[layerOf(f.id)];
    if (!best || priority > best.priority || (priority === best.priority && bottom >= best.bottom)) best = { f, bottom, priority };
  }
  return best?.f;
}

function removeFurniture(f) {
  for (const u of [...f.users]) endAct(u);
  G.furniture = G.furniture.filter(o => o !== f);
}

cv.addEventListener('contextmenu', e => { e.preventDefault(); cancelPlacing(); });
cv.addEventListener('pointerdown', e => {
  if (press || e.button !== 0) return;
  const p = toScene(e);
  cv.setPointerCapture(e.pointerId);
  if (G.mode === 'live') {
    const d = dollAt(p);
    if (!d && hitBedDoor(p)) { toggleBedDoor(); return; }
    press = { p, d, pointerId: e.pointerId, moved: false, furn: d ? null : furnAt(p) };
    return;
  }
  // 布置模式
  const B = G.build;
  if (B.placing) {
    const g = houseTile(p, B.placing.id);
    if (g && canPlace(B.placing.id, g.x, g.y, null)) {
      if (!B.placing.moved && !acquire(B.placing.id)) { SFX.play('deny'); return; }   // 新放的家具要从仓库拿或者花钱买
      addFurniture(B.placing.id, g.x, g.y); HOOK.refresh(); rebuild(); SFX.play('place'); save();
      if (B.placing.moved) { B.placing = null; HOOK.refresh(); }
    } else SFX.play('deny');
    return;
  }
  const f = furnAt(p);
  if (!f) return;
  if (f.id === 'door' && B.trash) { HOOK.toast('大门不能拆哦，可以拿起来换个位置', true); SFX.play('deny'); return; }
  if (B.trash) { removeFurniture(f); stash(f.id); rebuild(); SFX.play('trash'); save(); HOOK.toast(`「${FURNITURE[f.id].name}」收进仓库了`, true); HOOK.refresh(); }
  else { removeFurniture(f); rebuild(); B.placing = { id: f.id, moved: true, orig: { x: f.x, y: f.y } }; B.hover = houseTile(p, f.id); SFX.play('pick'); HOOK.refresh(); }
});
cv.addEventListener('pointermove', e => {
  if (press && press.pointerId !== e.pointerId) return;
  const p = toScene(e);
  if (G.mode === 'build') {
    const B = G.build;
    B.hover = B.placing ? houseTile(p, B.placing.id) : { furn: furnAt(p) };
    cv.style.cursor = B.placing ? 'copy' : B.hover?.furn ? (B.trash ? 'not-allowed' : 'grab') : 'default';
    return;
  }
  const hd = dollAt(p); hoverDoll = hd ? hd.uid : null;
  cv.style.cursor = press && press.d ? 'grabbing' : hd ? 'grab' : (G.sel && furnAt(p) && FURNITURE[furnAt(p).id].use ? 'pointer' : 'default');
  if (!press || !press.d) return;
  const d = press.d;
  if (!press.moved && Math.hypot(p.x - press.p.x, p.y - press.p.y) > 3) {
    press.moved = true;
    if (d.act) endAct(d);
    d.path = []; d.state = 'lift'; d.dir = 'down'; G.sel = d.uid; HOOK.select();
    say(d, pick(ACT_LINES.lift), 1.5); SFX.play('lift');
  }
  if (press.moved) {
    press.point = p;
    d.liftX = p.x;
    d.liftY = p.y + 12;
    const g = dropTile(p);
    d.liftShadow = g && { x: g.x * T + 8, y: g.y * T + 14, ty: g.y };
  }
});
cv.addEventListener('pointerup', e => {
  if (!press || press.pointerId !== e.pointerId) return;
  if (G.mode !== 'live') { cancelDollDrag(e); return; }
  const p = toScene(e), d = press.d;
  if (d && press.moved) {
    const invite = dropInteraction(p, d);
    let g = invite?.spot || dropTile(p);
    // Don't leave a doll stacked on the target when an invitation can't start.
    if (invite && !invite.spot && g?.x === invite.target.tx && g.y === invite.target.ty) g = null;
    placeDollAt(d, g?.x ?? d.tx, g?.y ?? d.ty);
    d.state = 'idle'; d.think = 1.5; d.frame = 0; d.liftShadow = null; d.bubble = null; SFX.play('drop');
    if (invite?.spot) {
      const partner = invite.target;
      if (partner.act) endAct(partner);
      placeDollAt(partner, partner.tx, partner.ty);
      startSocial(d, partner);
      HOOK.select();
    } else if (invite) HOOK.toast(invite.reason, true);
  } else if (d) {
    G.sel = d.uid; SFX.play('click'); HOOK.select(true);
  } else if (press.furn && G.sel) {
    const sd = G.dolls.find(o => o.uid === G.sel);
    if (sd) orderUse(sd, press.furn);
  } else { G.sel = null; HOOK.select(); }
  press = null;
});
function cancelDollDrag(e) {
  if (!press || press.pointerId !== e.pointerId) return;
  const d = press?.d;
  if (d?.state === 'lift') {
    placeDollAt(d, d.tx, d.ty);
    d.state = 'idle';
    d.liftShadow = null;
  }
  press = null;
}
cv.addEventListener('pointercancel', cancelDollDrag);
cv.addEventListener('lostpointercapture', cancelDollDrag);
cv.addEventListener('pointerleave', () => { hoverDoll = null; if (G.mode === 'build') G.build.hover = null; });

const rawDropTile = p => houseTile({ x: p.x, y: p.y + 12 }) || houseTile(p);
function dropTile(p) {
  const tile = rawDropTile(p);
  return tile && nearestFree(tile.x, tile.y, tile.y >= ROWS ? 3 : tile.y >= FLOOR_SPLIT ? 2 : 1);
}

function cancelPlacing() {
  const B = G.build;
  if (B.placing && B.placing.moved && B.placing.orig) {
    const o = B.placing.orig;
    if (canPlace(B.placing.id, o.x, o.y, null)) addFurniture(B.placing.id, o.x, o.y);
    rebuild();
  }
  B.placing = null; HOOK.refresh();
}
window.addEventListener('keydown', e => { if (e.key === 'Escape') cancelPlacing(); });
