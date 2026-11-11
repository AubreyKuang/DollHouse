// 界面：住户列表、状态卡、模式切换、布置面板、衣橱，以及主循环
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- 提示 ---------- */
let toastTimer = 0;
HOOK.toast = (msg, quiet) => {
  if (!quiet && !msg.startsWith('☀️')) addLog(msg);   // quiet=true 的是纯界面提示，不进日志          // 新的一天用日志里的日期分隔，不重复记
  const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200); };

/* ---------- 住户列表 + 状态卡 ---------- */
function doingText(d) {
  if (d.state === 'lift') return '被你拎在手里';
  if (d.state === 'wait') return '在等人过来';
  if (d.state === 'away') return awayText(d);
  if (d.act && d.act.type === 'leave') return `出门${JOBS[d.job].verb}`;
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
    const b = el('button', 'doll-row' + (d.uid === G.sel ? ' sel' : '') + (d.state === 'away' ? ' away' : ''));
    const c = el('canvas'); c.width = 20; c.height = 24; dollPortrait(c, d.look);
    const P = PERSONAS[d.persona];
    const m = el('div', 'meta', `<b>${esc(d.name)} <span class="g-${d.gender}">${d.gender === 'm' ? '♂' : '♀'}</span> ${P.icon}</b><small data-doing="${d.uid}">${doingText(d)}</small>`);
    b.append(c, m);
    b.onclick = () => { G.sel = d.uid === G.sel ? null : d.uid; SFX.play('click'); HOOK.select(); };
    box.append(b);
  }
  $('#btnAddDoll').style.display = G.dolls.length >= LEVELS[G.level].cap ? 'none' : '';
}

function renderInfo() {
  const card = $('#dollInfo'), d = G.dolls.find(o => o.uid === G.sel);
  if (!d) { card.hidden = true; return; }
  const P = PERSONAS[d.persona];
  card.hidden = false;
  card.innerHTML = `<h3>${esc(d.name)}</h3>
    <div class="persona">${P.icon} ${P.name} · ${P.desc}</div>
    <div class="persona">${jobLine(d)}</div>
    <div class="persona">${astroLine(d)}</div>
    <div class="money">💰 存款 <b id="infoMoney"></b></div>
    <div class="persona">${GENDERS[d.gender]} · ${HEARTS[d.heart].icon} ${HEARTS[d.heart].name}：${HEARTS[d.heart].desc}</div>
    ${NEEDS.map(n => `<div class="need"><span>${n.name}</span><div class="bar"><i data-need="${n.key}" style="background:${n.color}"></i></div></div>`).join('')}
    <div class="doing">正在：<b id="infoDoing"></b></div>
    ${G.dolls.length > 1 ? `<div class="rels"><h4>人际关系</h4>${G.dolls.filter(o => o !== d).map(o => `
      <div class="rel"><div class="rel-top"><span>${esc(o.name)} <span class="stars" title="星座 + MBTI 缘分">${compatStars(d, o)}</span></span><small data-rl="${o.uid}"></small></div>
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
  $('#btnWake').onclick = () => { if (d.state === 'away') { HOOK.toast(`${d.name} 不在家哦`, true); return; } if (d.act) endAct(d); d.path = []; d.state = 'idle'; d.think = 3; d.dir = 'down'; say(d, '叫我吗？'); };
  tickInfo();
}

function tickInfo() {
  const d = G.dolls.find(o => o.uid === G.sel);
  if (d && !$('#dollInfo').hidden) {
    for (const i of document.querySelectorAll('[data-need]')) i.style.width = d.needs[i.dataset.need].toFixed(0) + '%';
    const s = $('#infoDoing'); if (s) s.textContent = doingText(d);
    const m = $('#infoMoney'); if (m) { m.textContent = yuan(d.money); m.classList.toggle('neg', d.money < 0); }
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

/* ---------- 生活日志 ---------- */
function renderLog() {
  const box = $('#logList'); box.innerHTML = '';
  if (!G.log.length) { box.append(el('div', 'log-empty', '还没有发生什么事～')); return; }
  let day = null;
  for (let i = G.log.length - 1; i >= 0; i--) {
    const e = G.log[i];
    if (e.d !== day) { day = e.d; box.append(el('div', 'log-day', `第 ${e.d} 天 · ${WEEKDAYS[weekday(e.d)]}`)); }
    box.append(el('div', 'log-item', `<time>${hhmm(e.t)}</time><span>${esc(e.text)}</span>`));
  }
}
HOOK.logged = renderLog;
$('#btnLogClear').onclick = () => { G.log = []; renderLog(); save(); };

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
  const S = seasonOf(G.day), Hd = holidayOf(G.day);
  $('#dayLabel').textContent = `第 ${G.day} 天 · ${WEEKDAYS[weekday(G.day)]} · ${S.icon}${S.name}${Hd ? ' · ' + Hd.icon + Hd.name : ''}`;
  const sky = h >= 21 || h < 6 ? '🌙' : h < 8 ? '🌅' : h >= 18 ? '🌇' : '☀️';
  $('#timeIcon').textContent = G.weather && G.weather !== 'sunny' ? WEATHER[G.weather].icon : sky;
  $('#timeIcon').title = WEATHER[G.weather || 'sunny'].name;
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
  const keepDolls = G.dolls.map(d => ({ pid: d.pid, name: d.name, gender: d.gender, heart: d.heart, zodiac: d.zodiac, mbti: d.mbti, persona: d.persona, job: d.job, money: d.money, look: d.look, needs: d.needs, away: d.state === 'away', awayUntil: d.awayUntil, lastWorkDay: d.lastWorkDay }));
  const keepRel = G.rel;
  const s = JSON.parse(JSON.stringify(DEFAULT_SAVE)); s.dolls = keepDolls; s.time = G.time; s.day = G.day;
  s.rel = keepRel; applySave(s); rebuild(); save(); HOOK.select(); renderPalette(); HOOK.toast('房间已恢复默认', true);
};

const iconCache = {};
function renderPalette() {
  const pal = $('#palette'); pal.innerHTML = '';
  $('#btnTrash').classList.toggle('on', G.build.trash);
  if (tab === 'furniture') {
    for (const id of Object.keys(FURNITURE)) {
      const F = FURNITURE[id];
      if (F.fixed) continue;
      const [price, lv] = SHOP[id] || [0, 1], have = G.inv[id] || 0, locked = lv > G.level && !have;
      const b = el('button', 'item' + (G.build.placing && G.build.placing.id === id && !G.build.placing.moved ? ' on' : '') + (locked ? ' locked' : ''));
      iconCache[id] = iconCache[id] || furnitureIcon(id);
      const c = el('canvas'); c.width = c.height = 56; c.getContext('2d').drawImage(iconCache[id], 0, 0);
      const tag = have ? `仓库 ×${have}` : locked ? `🔒 ${LEVELS[lv].name}` : yuan(price);
      b.append(c, el('span', null, F.name), el('small', 'price' + (have ? ' own' : price > G.fund && !locked ? ' poor' : ''), tag));
      b.title = F.use ? `${F.name} · ${ACT_NAMES[F.use] || ''}` : F.name;
      b.onclick = () => {
        if (locked) { HOOK.toast(`🔒 扩建成「${LEVELS[lv].name}」才能买${F.name}`, true); SFX.play('deny'); return; }
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
HOOK.refresh = () => { renderShopBar(); if (G.mode === 'build') renderPalette(); };

/* ---------- 家庭基金与扩建 ---------- */
function renderShopBar() {
  $('#fundAmt').textContent = yuan(G.fund);
  $('#fundTop').textContent = yuan(G.fund);
  const L = LEVELS[G.level], next = LEVELS[G.level + 1];
  $('#houseLv').textContent = `🏠 ${L.name}（Lv${G.level} · 最多 ${L.cap} 人）`;
  const ex = $('#btnExpand');
  ex.textContent = next ? `🔨 扩建成「${next.name}」${yuan(next.cost)}` : '🏰 已经是最大的房子了';
  ex.disabled = !next;
  ex.classList.toggle('ready', !!next && G.fund >= next.cost);
  $('#btnCrowd').disabled = G.crowdDay === G.day;
}
$('#btnCrowd').onclick = () => crowdfund();
$('#btnExpand').onclick = () => expand();

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
  if (G.dolls.length <= 1) { HOOK.toast('至少要留一位住户哦', true); return; }
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
  const jobs = el('div', 'chips');
  for (const [k, J] of Object.entries(JOBS)) {
    const sub = J.start == null ? (k === 'artist' ? '不用出门 · 偶尔卖画' : '不用出门 · 没有收入') : `${hhmm(J.start)}–${hhmm(J.end)} · ${yuan(J.wage)}/天${k === 'student' ? ' · 不谈恋爱' : ''}`;
    const b = el('button', 'chip' + (d.job === k ? ' on' : ''), `${J.icon} ${J.name}<small>${sub}</small>`);
    b.onclick = () => {
      d.job = k; SFX.play('pop');
      if (k === 'student') { clearRomance(d); HOOK.toast('学生不参与恋爱剧情，和 TA 有关的恋爱关系已清零', true); }
      renderWardrobe();
    };
    jobs.append(b);
  }
  section('职业', jobs);
  const gen = el('div', 'chips');
  for (const [k, n] of Object.entries(GENDERS)) {
    const b = el('button', 'chip' + (d.gender === k ? ' on' : ''), n);
    b.onclick = () => { d.gender = k; SFX.play('pop'); renderWardrobe(); };
    gen.append(b);
  }
  section('性别', gen);
  const zs = el('div', 'chips');
  for (const z of ZODIAC) {
    const b = el('button', 'chip' + (d.zodiac === z.id ? ' on' : ''), `${z.icon} ${z.name}<small>${ELEMENTS[z.el].icon}${ELEMENTS[z.el].name}</small>`);
    b.onclick = () => { d.zodiac = z.id; SFX.play('pop'); renderWardrobe(); };
    zs.append(b);
  }
  section('星座', zs);
  const ms = el('div', 'chips');
  MBTI_AXES.forEach(([a, b, na, nb], i) => {
    for (const [letter, label] of [[a, na], [b, nb]]) {
      const btn = el('button', 'chip' + (mb(d)[i] === letter ? ' on' : ''), `${letter} ${label}`);
      btn.onclick = () => { const m = mb(d).split(''); m[i] = letter; d.mbti = m.join(''); SFX.play('pop'); renderWardrobe(); };
      ms.append(btn);
    }
    if (i < 3) ms.append(el('span', 'mbti-sep', '·'));
  });
  section(`MBTI：${mb(d)} ${MBTI_NAMES[mb(d)]}`, ms);
  const hearts = el('div', 'chips');
  for (const [k, H] of Object.entries(HEARTS)) {
    const b = el('button', 'chip' + (d.heart === k ? ' on' : ''), `${H.icon} ${H.name}<small>${H.desc}</small>`);
    b.onclick = () => { d.heart = k; SFX.play('pop'); renderWardrobe(); };
    hearts.append(b);
  }
  section('感情观', hearts);
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
  if (G.dolls.length >= LEVELS[G.level].cap) { HOOK.toast(`房子住满了，扩建后才能邀请更多人`, true); return; }
  const used = new Set(G.dolls.map(d => d.name));
  const name = NAMES.find(n => !used.has(n)) || '新朋友';
  const d = addDoll({ name, persona: pick(Object.keys(PERSONAS)), job: pick(Object.keys(JOBS)), zodiac: randomZodiac(), mbti: randomMbti(), heart: Math.random() < 0.25 ? 'fickle' : Math.random() < 0.5 ? 'loyal' : 'normal', look: randomLook() });
  G.sel = d.uid; say(d, '大家好，请多关照！'); spawnHeart(d); SFX.play('love');
  HOOK.select(); save(); HOOK.toast(`${name} 搬进来啦！`);
};

/* ---------- 主循环 ---------- */
load(); rebuild(); HOOK.select(); updateClock(); renderLog(); renderShopBar();
let last = performance.now(), uiT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  uiT += dt;
  if (uiT > 0.25) { uiT = 0; updateClock(); tickInfo(); renderShopBar(); }
  if (!$('#wardrobe').hidden) { wdTimer += dt; if (wdTimer > 0.18) { wdTimer = 0; wdFrame = (wdFrame + 1) % 4; drawWdPreview(); } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('beforeunload', save);
