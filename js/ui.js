// 界面：住户列表、状态卡、模式切换、布置面板、衣橱，以及主循环
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- 提示 ---------- */
let toastTimer = 0;
HOOK.toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); };

/* ---------- 住户列表 + 状态卡 ---------- */
function doingText(d) {
  if (d.state === 'lift') return '被你拎在手里';
  if (d.state === 'wait') return '在等人过来';
  if (!d.act) return ACT_NAMES.idle;
  if (d.state === 'walk' && d.act.type === 'join') return `去找${d.act.target.name}凑热闹`;
  if (d.state === 'walk' && d.act.type === 'chat' && d.act.partner) return `去找${d.act.partner.name}`;
  const sd = d.state === 'act' && socialDoing(d);
  if (sd) return sd;
  const n = ACT_NAMES[d.act.type] || '忙碌中';
  if (d.state === 'walk') return d.act.type === 'wander' ? '闲逛' : `正要去${n.replace(/^在/, '')}`;
  if (d.act.type === 'chat' && d.act.partner) return `和${d.act.partner.name}聊天`;
  return n;
}

function renderDollList() {
  const box = $('#dollList'); box.innerHTML = '';
  for (const d of G.dolls) {
    const b = el('button', 'doll-row' + (d.uid === G.sel ? ' sel' : ''));
    const c = el('canvas'); c.width = 20; c.height = 24; dollPortrait(c, d.look);
    const P = PERSONAS[d.persona];
    const m = el('div', 'meta', `<b>${esc(d.name)} ${P.icon}</b><small data-doing="${d.uid}">${doingText(d)}</small>`);
    b.append(c, m);
    b.onclick = () => { G.sel = d.uid === G.sel ? null : d.uid; SFX.play('click'); HOOK.select(); };
    box.append(b);
  }
  $('#btnAddDoll').style.display = G.dolls.length >= 6 ? 'none' : '';
}

function renderInfo() {
  const card = $('#dollInfo'), d = G.dolls.find(o => o.uid === G.sel);
  if (!d) { card.hidden = true; return; }
  const P = PERSONAS[d.persona];
  card.hidden = false;
  card.innerHTML = `<h3>${esc(d.name)}</h3>
    <div class="persona">${P.icon} ${P.name} · ${P.desc}</div>
    ${NEEDS.map(n => `<div class="need"><span>${n.name}</span><div class="bar"><i data-need="${n.key}" style="background:${n.color}"></i></div></div>`).join('')}
    <div class="doing">正在：<b id="infoDoing"></b></div>
    ${G.dolls.length > 1 ? `<div class="rels"><h4>人际关系</h4>${G.dolls.filter(o => o !== d).map(o => `
      <div class="rel"><div class="rel-top"><span>${esc(o.name)}</span><small data-rl="${o.uid}"></small></div>
      <div class="rel-bars"><span title="友好度">🤝</span><div class="bar"><i data-rf="${o.uid}" style="background:#7cc576"></i></div>
      <span title="恋爱度">💗</span><div class="bar"><i data-rlv="${o.uid}" style="background:#ec6a8a"></i></div></div></div>`).join('')}</div>` : ''}
    <div class="hint" style="margin:4px 0 0">选中后点家具，可以让 TA 去用</div>
    <div class="actions">
      <button class="btn small" id="btnPet">🤚 摸摸头</button>
      <button class="btn small" id="btnDress">👗 换装</button>
      <button class="btn small ghost" id="btnWake">📣 叫 TA</button>
    </div>`;
  $('#btnPet').onclick = () => petDoll(d);
  $('#btnDress').onclick = () => openWardrobe(d.uid);
  $('#btnWake').onclick = () => { if (d.act) endAct(d); d.path = []; d.state = 'idle'; d.think = 3; d.dir = 'down'; say(d, '叫我吗？'); };
  tickInfo();
}

function tickInfo() {
  const d = G.dolls.find(o => o.uid === G.sel);
  if (d && !$('#dollInfo').hidden) {
    for (const i of document.querySelectorAll('[data-need]')) i.style.width = d.needs[i.dataset.need].toFixed(0) + '%';
    const s = $('#infoDoing'); if (s) s.textContent = doingText(d);
    for (const o of G.dolls) {
      if (o === d) continue;
      const r = rel(d, o), lab = document.querySelector(`[data-rl="${o.uid}"]`);
      if (!lab) continue;
      lab.textContent = relLabel(r);
      document.querySelector(`[data-rf="${o.uid}"]`).style.width = Math.max(0, r.f).toFixed(0) + '%';
      document.querySelector(`[data-rlv="${o.uid}"]`).style.width = r.l.toFixed(0) + '%';
    }
  }
  for (const s of document.querySelectorAll('[data-doing]')) {
    const o = G.dolls.find(x => x.uid === +s.dataset.doing); if (o) s.textContent = doingText(o);
  }
}

HOOK.select = () => { renderDollList(); renderInfo(); };

/* ---------- 顶栏 ---------- */
function setMode(m) {
  if (G.mode === 'build' && m !== 'build') cancelPlacing();
  G.mode = m; G.build.trash = false; G.build.placing = null; G.build.hover = null;
  document.querySelectorAll('.mode').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#buildBar').hidden = m !== 'build';
  $('#hint').textContent = m === 'build' ? '布置模式：小人们会继续生活，放好家具 TA 们就会去用' : '点击小人查看状态，按住可以把 TA 拎起来放到别处～';
  if (m === 'build') renderPalette();
  SFX.play('click');
}
document.querySelectorAll('.mode').forEach(b => b.onclick = () => setMode(b.dataset.mode));
document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => {
  G.speed = +b.dataset.speed;
  document.querySelectorAll('[data-speed]').forEach(o => o.classList.toggle('on', o === b));
  SFX.play('click');
});
$('#btnSound').onclick = () => { const on = SFX.toggle(); $('#btnSound').textContent = on ? '🔊' : '🔇'; $('#btnSound').classList.toggle('on', on); };
$('#btnWardrobe').onclick = () => openWardrobe(G.sel || (G.dolls[0] && G.dolls[0].uid));

function updateClock() {
  const m = Math.floor(G.time), h = Math.floor(m / 60), mm = m % 60;
  $('#clock').textContent = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  $('#dayLabel').textContent = `第 ${G.day} 天`;
  $('#timeIcon').textContent = h >= 21 || h < 6 ? '🌙' : h < 8 ? '🌅' : h >= 18 ? '🌇' : '☀️';
}

/* ---------- 布置面板 ---------- */
let tab = 'furniture';
document.querySelectorAll('.tab').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach(o => o.classList.toggle('on', o === b));
  G.build.placing = null; renderPalette(); SFX.play('click');
});
$('#btnTrash').onclick = () => {
  if (G.build.placing) cancelPlacing();
  G.build.trash = !G.build.trash; $('#btnTrash').classList.toggle('on', G.build.trash);
  $('#buildHint').textContent = G.build.trash ? '删除模式：点击房间里的家具把它移走' : '选择家具后点击房间放置 · 点已有家具可以拿起移动 · 右键/Esc 取消';
  SFX.play('click');
};
$('#btnReset').onclick = () => {
  if (!confirm('把房间恢复成默认布置吗？（住户会保留）')) return;
  const keepDolls = G.dolls.map(d => ({ name: d.name, persona: d.persona, look: d.look, needs: d.needs }));
  const s = JSON.parse(JSON.stringify(DEFAULT_SAVE)); s.dolls = keepDolls; s.time = G.time; s.day = G.day;
  applySave(s); rebuild(); save(); HOOK.select(); renderPalette(); HOOK.toast('房间已恢复默认');
};

const iconCache = {};
function renderPalette() {
  const pal = $('#palette'); pal.innerHTML = '';
  $('#btnTrash').classList.toggle('on', G.build.trash);
  if (tab === 'furniture') {
    for (const id of Object.keys(FURNITURE)) {
      const F = FURNITURE[id];
      const b = el('button', 'item' + (G.build.placing && G.build.placing.id === id && !G.build.placing.moved ? ' on' : ''));
      iconCache[id] = iconCache[id] || furnitureIcon(id);
      const c = el('canvas'); c.width = c.height = 56; c.getContext('2d').drawImage(iconCache[id], 0, 0);
      b.append(c, el('span', null, F.name));
      b.title = F.use ? `${F.name} · ${ACT_NAMES[F.use] || ''}` : F.name;
      b.onclick = () => {
        if (G.build.placing && G.build.placing.moved) cancelPlacing();
        G.build.trash = false;
        G.build.placing = G.build.placing && G.build.placing.id === id ? null : { id };
        SFX.play('click'); renderPalette();
      };
      pal.append(b);
    }
  } else {
    const isWall = tab === 'wall', list = isWall ? WALLS : FLOORS;
    for (const s of list) {
      const b = el('button', 'item' + ((isWall ? G.wall : G.floor) === s.id ? ' on' : ''));
      b.append(swatchIcon(s, isWall), el('span', null, s.name));
      b.onclick = () => { if (isWall) G.wall = s.id; else G.floor = s.id; SFX.play('place'); save(); renderPalette(); };
      pal.append(b);
    }
  }
}
HOOK.refresh = () => { if (G.mode === 'build') renderPalette(); };

/* ---------- 衣橱 ---------- */
let wdUid = null, wdDir = 'down', wdFrame = 0, wdTimer = 0;
const wdDoll = () => G.dolls.find(d => d.uid === wdUid);

function openWardrobe(uid) {
  if (!G.dolls.length) return;
  wdUid = uid || G.dolls[0].uid;
  $('#wardrobe').hidden = false; SFX.play('open');
  renderWardrobe();
}
function closeWardrobe() { $('#wardrobe').hidden = true; HOOK.select(); save(); }
$('#wdClose').onclick = closeWardrobe;
$('#wardrobe').addEventListener('pointerdown', e => { if (e.target.id === 'wardrobe') closeWardrobe(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#wardrobe').hidden) closeWardrobe(); });
document.querySelectorAll('.wd-dir button').forEach(b => b.onclick = () => { wdDir = b.dataset.dir; SFX.play('click'); });
$('#wdName').oninput = e => { const d = wdDoll(); if (d) { d.name = e.target.value.trim() || '无名'; renderWdTabs(); } };
$('#wdRandom').onclick = () => {
  const d = wdDoll(); if (!d) return;
  d.look = randomLook(); SFX.play('love'); renderWardrobe();
};
$('#wdRemove').onclick = () => {
  const d = wdDoll(); if (!d) return;
  if (G.dolls.length <= 1) { HOOK.toast('至少要留一位住户哦'); return; }
  if (!confirm(`真的要让 ${d.name} 搬走吗？`)) return;
  if (d.act) endAct(d);
  for (const o of G.dolls) if (o.act && o.act.partner === d) endAct(o);
  G.dolls = G.dolls.filter(o => o !== d);
  if (G.sel === d.uid) G.sel = null;
  HOOK.toast(`${d.name} 挥挥手搬走了`); wdUid = G.dolls[0].uid; renderWardrobe(); save();
};

function randomLook() {
  const keys = o => Object.keys(o), r = n => (Math.random() * n) | 0;
  const top = pick(keys(OUTFIT.top));
  return {
    skin: r(OUTFIT.skin.length), hair: pick(keys(OUTFIT.hair)), hairColor: r(OUTFIT.hairColor.length),
    top, topColor: r(OUTFIT.clothColor.length), bottom: pick(keys(OUTFIT.bottom)), bottomColor: r(OUTFIT.clothColor.length),
    shoes: r(OUTFIT.shoes.length), acc: pick(keys(OUTFIT.acc)),
  };
}

function renderWdTabs() {
  const box = $('#wdTabs'); box.innerHTML = '';
  for (const d of G.dolls) {
    const b = el('button', d.uid === wdUid ? 'on' : '', esc(d.name));
    b.onclick = () => { wdUid = d.uid; SFX.play('click'); renderWardrobe(); };
    box.append(b);
  }
}

function renderWardrobe() {
  const d = wdDoll(); if (!d) return;
  renderWdTabs();
  $('#wdName').value = d.name;
  const box = $('#wdOptions'); box.innerHTML = '';
  const section = (title, node) => { const s = el('div', 'opt'); s.append(el('h4', null, title), node); box.append(s); };
  const chips = (obj, key) => {
    const w = el('div', 'chips');
    for (const [k, name] of Object.entries(obj)) {
      const b = el('button', 'chip' + (d.look[key] === k ? ' on' : ''), name);
      b.onclick = () => { d.look[key] = k; SFX.play('pop'); renderWardrobe(); };
      w.append(b);
    }
    return w;
  };
  const swatches = (cols, key) => {
    const w = el('div', 'chips');
    cols.forEach((col, i) => {
      const b = el('button', 'swatch' + (d.look[key] === i ? ' on' : ''));
      b.style.background = col; b.setAttribute('aria-label', col);
      b.onclick = () => { d.look[key] = i; SFX.play('pop'); renderWardrobe(); };
      w.append(b);
    });
    return w;
  };
  const pers = el('div', 'chips');
  for (const [k, P] of Object.entries(PERSONAS)) {
    const b = el('button', 'chip' + (d.persona === k ? ' on' : ''), `${P.icon} ${P.name}<small>${P.desc}</small>`);
    b.onclick = () => { d.persona = k; SFX.play('pop'); say(d, pick(P.lines)); renderWardrobe(); };
    pers.append(b);
  }
  section('性格', pers);
  section('肤色', swatches(OUTFIT.skin, 'skin'));
  section('发型', chips(OUTFIT.hair, 'hair'));
  section('发色', swatches(OUTFIT.hairColor, 'hairColor'));
  section('上衣', chips(OUTFIT.top, 'top'));
  section('上衣颜色', swatches(OUTFIT.clothColor, 'topColor'));
  if (d.look.top !== 'dress') section('下装', chips(OUTFIT.bottom, 'bottom'));
  section(d.look.top === 'overall' ? '背带颜色' : '下装颜色', swatches(OUTFIT.clothColor, 'bottomColor'));
  section('鞋子', swatches(OUTFIT.shoes, 'shoes'));
  section('配饰', chips(OUTFIT.acc, 'acc'));
  drawWdPreview();
}
function drawWdPreview() { const d = wdDoll(); if (d) dollPortrait($('#wdCanvas'), d.look, wdDir, wdFrame, 'walk'); }

/* ---------- 新住户 ---------- */
$('#btnAddDoll').onclick = () => {
  if (G.dolls.length >= 6) return;
  const used = new Set(G.dolls.map(d => d.name));
  const name = NAMES.find(n => !used.has(n)) || '新朋友';
  const d = addDoll({ name, persona: pick(Object.keys(PERSONAS)), look: randomLook() });
  G.sel = d.uid; say(d, '大家好，请多关照！'); spawnHeart(d); SFX.play('love');
  HOOK.select(); save(); HOOK.toast(`${name} 搬进来啦！`);
};

/* ---------- 主循环 ---------- */
load(); rebuild(); HOOK.select(); updateClock();
let last = performance.now(), uiT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  uiT += dt;
  if (uiT > 0.25) { uiT = 0; updateClock(); tickInfo(); }
  if (!$('#wardrobe').hidden) { wdTimer += dt; if (wdTimer > 0.18) { wdTimer = 0; wdFrame = (wdFrame + 1) % 4; drawWdPreview(); } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('beforeunload', save);
