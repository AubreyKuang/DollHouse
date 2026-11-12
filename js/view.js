// 画面渲染 + 指针交互（拎小人、摆家具）
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const lightCv = document.createElement('canvas'); lightCv.width = W; lightCv.height = H;
const lctx = lightCv.getContext('2d');
// 扩建后画布跟着变宽
HOOK.resize = () => {
  cv.width = W; cv.height = H; lightCv.width = W; lightCv.height = H; ctx.imageSmoothingEnabled = false;
  document.getElementById('stage').style.aspectRatio = `${W} / ${H}`;
};
const overlay = document.getElementById('overlay');

const wallSpec = () => WALLS.find(w => w.id === G.wall) || WALLS[0];
const floorSpec = () => FLOORS.find(f => f.id === G.floor) || FLOORS[0];

function dollPose(d) {
  if (d.state === 'lift') return 'lift';
  if (d.state === 'walk') return 'walk';
  if (d.act && d.state === 'act' && d.act.type === 'exercise') return 'walk';
  if (d.act && d.state === 'act' && (d.act.type === 'dance' || (d.act.type === 'join' && d.act.dance))) return 'dance';
  if (d.act && d.act.onFurn && d.state === 'act') return 'sit';
  return 'stand';
}
function drawDollObj(c, d) {
  drawDoll(c, d.x, d.y, d.look, {
    dir: d.dir, frame: d.frame, pose: dollPose(d), hop: d.hop,
    blink: d.blink > 0 || (d.act && d.act.type === 'read' && d.state === 'act' && Math.sin(G.t * 2) > 0.7),
    happy: d.happy > 0 || (d.act && d.state === 'act' && (['dance', 'game', 'tv', 'snack', 'cat', 'join'].includes(d.act.type) || (d.act.type === 'chat' && d.act.kind !== 'argue'))),
  });
}

function render() {
  const c = ctx, t = G.t;
  drawWall(c, wallSpec());
  drawFloor(c, floorSpec());
  c.fillStyle='#4c3543';
  c.fillRect(0,FLOOR_SPLIT*T-2,STAIRS_X*T,4);
  c.fillRect((STAIRS_X+1)*T,FLOOR_SPLIT*T-2,W-(STAIRS_X+1)*T,4);
  c.fillStyle='#cda277';
  for(let i=0;i<5;i++)c.fillRect(STAIRS_X*T+1,(FLOOR_SPLIT-1)*T+i*6,T-2,3);
  c.fillStyle='#4c3543';
  c.font='10px sans-serif';
  c.fillText('一楼',3,(FLOOR_SPLIT-1)*T);
  c.fillText('二楼',3,(FLOOR_SPLIT+1)*T);
  const placing = G.build.placing;

  for (const f of G.furniture) if (layerOf(f.id) === 'wall') DRAW[f.id](c, f.x * T, f.y * T, f, t);
  for (const f of G.furniture) if (layerOf(f.id) === 'floor') DRAW[f.id](c, f.x * T, f.y * T, f, t);

  if (G.mode === 'build') {
    c.fillStyle = 'rgba(59,42,47,.08)';
    for (let x = 1; x < COLS; x++) c.fillRect(x * T, 0, 1, H);
    for (let y = 1; y < ROWS; y++) c.fillRect(0, y * T, W, 1);
  }

  // 家具 + 小人 按“脚底 y”排序，越靠下越后画
  const list = [];
  for (const f of G.furniture) {
    if (layerOf(f.id) !== 'solid') continue;
    const F = FURNITURE[f.id];
    const sleepers = f.users.filter(u => lying(u) && u.act.furn === f);
    f.occ = sleepers.length ? (slot, hx, hy) => {
      const s = sleepers.find(u => (u.act.seat || 0) === slot);
      if (s) drawDoll(c, hx, hy + 1, s.look, { pose: 'head', dir: 'down' });
    } : null;
    list.push({ y: (f.y + F.h) * T, draw: () => DRAW[f.id](c, f.x * T, f.y * T, f, t) });
  }
  for (const d of G.dolls) {
    if (d.state === 'lift' || d.state === 'away') continue;
    if (lying(d)) continue;
    const y = d.state === 'act' && d.act && d.act.onFurn ? (d.act.furn.y + 1) * T + 0.5 : d.y;
    list.push({ y, draw: () => drawDollObj(c, d) });
  }
  list.push(...partitionDrawables(c));
  list.sort((a, b) => a.y - b.y).forEach(o => o.draw());

  // 夜晚：整体压暗，台灯/电视/游戏机处“挖洞”透光
  if (G.dark > 0.01) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = `rgba(18,14,48,${G.dark})`; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const g = lctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g; lctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (const f of G.furniture) {
      if (f.id === 'lamp') hole(f.x * T + 8, f.y * T - 10, 54);
      if (f.id === 'garland') for (let i = 0; i < 8; i += 2) hole(f.x * T + 4 + i * 6, f.y * T + 9, 16, .55);
      if (f.id === 'aquarium') hole(f.x * T + 16, f.y * T - 6, 22, .5);
      if (f.id === 'xmastree') hole(f.x * T + 8, f.y * T - 2, 30, .8);
      if (f.id === 'lantern') hole(f.x * T + 8, f.y * T + 9, 22, .7);
      if ((f.id === 'pc' || f.id === 'speaker') && f.active) hole(f.x * T + 12, f.y * T - 10, 24, .7);
      if (f.id === 'tv' && f.active) hole(f.x * T + 16, f.y * T - 4, 34, .8);
      if (f.id === 'arcade') hole(f.x * T + 8, f.y * T - 8, 20, f.active ? .8 : .4);
      if (f.id === 'stove' && f.active) hole(f.x * T + 8, f.y * T - 6, 22, .7);
      if (f.id === 'fridge' && f.active) hole(f.x * T + 8, f.y * T, 24, .7);
    }
    c.drawImage(lightCv, 0, 0);
    c.globalCompositeOperation = 'lighter';
    for (const f of G.furniture) if (f.id === 'lamp') {
      const g = c.createRadialGradient(f.x * T + 8, f.y * T - 10, 1, f.x * T + 8, f.y * T - 10, 36);
      g.addColorStop(0, `rgba(255,190,90,${0.35 * G.dark})`); g.addColorStop(1, 'rgba(255,190,90,0)');
      c.fillStyle = g; c.fillRect(f.x * T - 30, f.y * T - 48, 76, 76);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // 选中的小人头上跳动的小箭头
  const sel = G.dolls.find(d => d.uid === G.sel);
  if (sel && sel.state !== 'lift' && sel.state !== 'away' && G.mode === 'live') {
    let ax = sel.x, ay = sel.y - 30 + Math.round(Math.sin(t * 6));
    if (lying(sel)) { const h = headPos(sel); ax = h.x; ay = h.y - 6; }
    R(c, ax - 3, ay, 7, 1, INK); R(c, ax - 2, ay + 1, 5, 1, INK); R(c, ax - 1, ay + 2, 3, 1, INK); R(c, ax, ay + 3, 1, 1, INK);
    R(c, ax - 2, ay, 5, 1, '#ffd35c'); R(c, ax - 1, ay + 1, 3, 1, '#ffd35c');
  }

  if (G.mode === 'build') drawBuildOverlay(c, t);

  // 被拎起来的小人画在最上面
  for (const d of G.dolls) if (d.state === 'lift') {
    R(c, d.x - 4, d.liftShadow - 1, 8, 2, 'rgba(0,0,0,.25)');
    drawDollObj(c, d);
  }
  updateOverlay();
}

function furnTop(f) { const F = FURNITURE[f.id]; return f.y * T - (F.layer ? 0 : (TALL[f.id] || 0)); }

function drawBuildOverlay(c, t) {
  const B = G.build, hv = B.hover;
  if (B.placing && hv) {
    const F = FURNITURE[B.placing.id];
    const ok = canPlace(B.placing.id, hv.x, hv.y, null);
    c.globalAlpha = 0.75;
    DRAW[B.placing.id](c, hv.x * T, hv.y * T, {}, t);
    c.globalAlpha = 1;
    c.fillStyle = ok ? 'rgba(124,197,118,.35)' : 'rgba(226,109,109,.45)';
    c.fillRect(hv.x * T, hv.y * T, F.w * T, F.h * T);
    c.fillStyle = ok ? '#4f9a4a' : '#c24d4d';
    const x = hv.x * T, y = hv.y * T, w = F.w * T, h = F.h * T;
    c.fillRect(x, y, w, 1); c.fillRect(x, y + h - 1, w, 1); c.fillRect(x, y, 1, h); c.fillRect(x + w - 1, y, 1, h);
  } else if (hv && hv.furn) {
    const f = hv.furn, F = FURNITURE[f.id], top = furnTop(f);
    c.fillStyle = B.trash ? 'rgba(226,109,109,.4)' : 'rgba(255,211,92,.3)';
    c.fillRect(f.x * T, top, F.w * T, (f.y + F.h) * T - top);
  }
}

/* ---------- DOM 浮层：对话气泡、名字、爱心 ---------- */
const domBubbles = new Map();
function updateOverlay() {
  const s = cv.clientWidth / W;
  const alive = new Set();
  for (const d of G.dolls) {
    let el = domBubbles.get(d.uid);
    if (!el) { el = { b: document.createElement('div'), n: document.createElement('div'), id: null }; el.b.className = 'bubble'; el.n.className = 'nametag'; overlay.append(el.b, el.n); domBubbles.set(d.uid, el); }
    alive.add(d.uid);
    let hx = d.x, hy = d.y - 24;
    if (lying(d)) { const h = headPos(d); hx = h.x; hy = h.y - 2; }
    else if (d.state === 'act' && d.act && d.act.onFurn) hy = d.y - 22;
    if (d.bubble && d.state !== 'away') {
      if (el.id !== d.bubble.id) { el.b.textContent = d.bubble.text; el.id = d.bubble.id; el.b.style.animation = 'none'; void el.b.offsetWidth; el.b.style.animation = ''; }
      el.b.style.display = ''; el.b.style.left = hx * s + 'px'; el.b.style.top = (hy - 2) * s + 'px';
    } else el.b.style.display = 'none';
    const showName = d.state !== 'away' && (d.uid === G.sel || d.uid === hoverDoll);
    el.n.style.display = showName ? '' : 'none';
    if (showName) {
      const np = lying(d) ? { x: headPos(d).x, y: headPos(d).y + 17 } : d;
      el.n.textContent = d.name; el.n.style.left = np.x * s + 'px'; el.n.style.top = (np.y + 2) * s + 'px';
    }
  }
  for (const [uid, el] of domBubbles) if (!alive.has(uid)) { el.b.remove(); el.n.remove(); domBubbles.delete(uid); }
  for (const h of hearts) {
    if (!h.el) { h.el = document.createElement('div'); h.el.className = 'heart'; h.el.textContent = h.txt; overlay.append(h.el); h.el.style.left = h.x * s + 'px'; h.el.style.top = h.y * s + 'px'; }
  }
  for (const el of overlay.querySelectorAll('.heart')) if (!hearts.some(h => h.el === el)) el.remove();
}

/* ---------- 指针交互 ---------- */
let hoverDoll = null, press = null;
function toWorld(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function dollAt(p) {
  let best = null;
  for (const d of G.dolls) {
    if (d.state === 'away') continue;
    let x = d.x, y = d.y;
    if (lying(d)) { const h = headPos(d); x = h.x; y = h.y + 14; }
    if (p.x >= x - 7 && p.x <= x + 7 && p.y >= y - 22 && p.y <= y + 1 && (!best || y > best.y)) best = { d, y };
  }
  return best && best.d;
}
function furnAt(p) {
  const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
  const solid = G.furniture.filter(f => layerOf(f.id) === 'solid').sort((a, b) => (b.y + FURNITURE[b.id].h) - (a.y + FURNITURE[a.id].h));
  for (const f of solid) { const F = FURNITURE[f.id]; if (p.x >= f.x * T && p.x < (f.x + F.w) * T && p.y >= furnTop(f) && p.y < (f.y + F.h) * T) return f; }
  for (const L of ['wall', 'floor']) for (const f of G.furniture) {
    if (layerOf(f.id) !== L) continue; const F = FURNITURE[f.id];
    if (tx >= f.x && tx < f.x + F.w && ty >= f.y && ty < f.y + F.h) return f;
  }
  return null;
}
function ghostTile(p, id) { const F = FURNITURE[id]; return { x: Math.round(p.x / T - F.w / 2), y: Math.round(p.y / T - F.h / 2) }; }

function removeFurniture(f) {
  for (const u of [...f.users]) endAct(u);
  G.furniture = G.furniture.filter(o => o !== f);
}

cv.addEventListener('contextmenu', e => { e.preventDefault(); cancelPlacing(); });
cv.addEventListener('pointerdown', e => {
  const p = toWorld(e);
  cv.setPointerCapture(e.pointerId);
  if (G.mode === 'live') {
    const d = dollAt(p);
    if (!d && hitBedDoor(p)) { toggleBedDoor(); return; }
    press = { p, d, moved: false, furn: d ? null : furnAt(p) };
    return;
  }
  // 布置模式
  const B = G.build;
  if (B.placing) {
    const g = ghostTile(p, B.placing.id);
    if (canPlace(B.placing.id, g.x, g.y, null)) {
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
  else { removeFurniture(f); rebuild(); B.placing = { id: f.id, moved: true, orig: { x: f.x, y: f.y } }; B.hover = ghostTile(p, f.id); SFX.play('pick'); HOOK.refresh(); }
});
cv.addEventListener('pointermove', e => {
  const p = toWorld(e);
  if (G.mode === 'build') {
    const B = G.build;
    B.hover = B.placing ? ghostTile(p, B.placing.id) : { furn: furnAt(p) };
    cv.style.cursor = B.placing ? 'copy' : B.hover.furn ? (B.trash ? 'not-allowed' : 'grab') : 'default';
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
  if (press.moved) { d.x = p.x; d.y = p.y + 12; const g = nearestFree(Math.floor(p.x / T), Math.floor((p.y + 10) / T)); d.liftShadow = g ? g.y * T + 14 : d.y; }
});
cv.addEventListener('pointerup', e => {
  if (G.mode !== 'live' || !press) { press = null; return; }
  const p = toWorld(e), d = press.d;
  if (d && press.moved) {
    const g = nearestFree(Math.floor(p.x / T), Math.floor((p.y + 10) / T));
    if (g) placeDollAt(d, g.x, g.y);
    d.state = 'idle'; d.think = 1.5; d.frame = 0; SFX.play('drop');
  } else if (d) {
    G.sel = d.uid; SFX.play('click'); HOOK.select();
  } else if (press.furn && G.sel) {
    const sd = G.dolls.find(o => o.uid === G.sel);
    if (sd) orderUse(sd, press.furn);
  } else { G.sel = null; HOOK.select(); }
  press = null;
});
cv.addEventListener('pointerleave', () => { hoverDoll = null; if (G.mode === 'build') G.build.hover = null; });

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
