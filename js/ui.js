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
  if (d.act?.type === 'visitStay') {
    if (d.act.theme === 'quiet') return '在二楼书房聊天';
    if (d.act.theme === 'umbrella') return '撑着伞野餐';
    return GET_TOGETHERS[G.community.active?.kind]?.name || '和朋友相聚';
  }
  if (d.act?.type === 'neighborLeave') return '准备去麦麦家';
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
    const m = el('div', 'meta', `<b>${esc(d.name)}${d.guest ? ' <em class="guest-tag">访客</em>' : ''} <span class="g-${d.gender}">${d.gender === 'm' ? '♂' : '♀'}</span> ${P.icon}</b><small class="couple-label" data-partners="${d.uid}" hidden></small><small data-doing="${d.uid}">${esc(doingText(d))}</small>`);
    b.append(c, m);
    b.onclick = () => { G.sel = d.uid === G.sel ? null : d.uid; SFX.play('click'); HOOK.select(); };
    box.append(b);
  }
  const count = G.community.applications.length;
  $('#btnAddDoll').textContent = count ? `＋ 邀请新住户 · ${count} 份申请` : '＋ 邀请新住户';
}

function renderInfo() {
  const card = $('#dollInfo'), d = G.dolls.find(o => o.uid === G.sel);
  if (!d) { card.hidden = true; return; }
  const P = PERSONAS[d.persona];
  card.hidden = false;
  card.innerHTML = `<h3>${esc(d.name)}${d.guest ? ' <em class="guest-tag">访客</em>' : ''}</h3>
    <div id="infoPartners" class="partner-list" hidden></div>
    <div class="persona">${P.icon} ${P.name} · ${P.desc}${isVain(d) ? ' · ✨ 爱美，常照镜子' : ''}</div>
    <div class="persona">${jobLine(d)}</div>
    <div class="persona">${astroLine(d)}</div>
    <div class="persona">MBTI 偏好 · ${(MBTI_INTERESTS[mb(d)] || []).map(use => ACT_NAMES[use]).join('、')}</div>
    <div class="money">💰 存款 <b id="infoMoney"></b></div>
    <div class="persona">${GENDERS[d.gender]} · ${HEARTS[d.heart].icon} ${HEARTS[d.heart].name}：${HEARTS[d.heart].desc}</div>
    ${NEEDS.map(n => `<div class="need"><span>${n.name}</span><div class="bar"><i data-need="${n.key}" style="background:${n.color}"></i></div></div>`).join('')}
    <div class="doing">正在：<b id="infoDoing"></b></div>
    ${G.dolls.length > 1 ? `<div class="rels"><h4>人际关系</h4>${G.dolls.filter(o => o !== d).map(o => `
      <div class="rel" data-rel-row="${o.uid}"><div class="rel-top"><span>${esc(o.name)} <span class="stars" title="星座 + MBTI 缘分">${compatStars(d, o)}</span></span><small data-rl="${o.uid}"></small></div>
      <div class="rel-bars"><span title="友好度">🤝</span><div class="bar"><i data-rf="${o.uid}" style="background:#7cc576"></i></div>
      <span title="恋爱度">💗</span><div class="bar"><i data-rlv="${o.uid}" style="background:#ec6a8a"></i></div></div></div>`).join('')}</div>` : ''}
    <div class="hint" style="margin:4px 0 0">选中后点家具，可以让 TA 去用</div>
    <div class="actions">
      <button class="btn small" id="btnPet">🤚 摸摸头</button>
      <button class="btn small" id="btnDress"${d.guest ? ' hidden' : ''}>👗 换装</button>
      <button class="btn small ghost" id="btnWake">📣 叫 TA</button>
    </div>`;
  $('#infoPartners').onclick = e => {
    const uid = Number(e.target.closest('[data-partner]')?.dataset.partner);
    if (!uid) return;
    G.sel = uid;
    SFX.play('click');
    HOOK.select();
    $('#infoPartners [data-partner]')?.focus();
  };
  $('#btnPet').onclick = () => petDoll(d);
  $('#btnDress').onclick = () => openWardrobe(d.uid);
  $('#btnWake').onclick = () => { if (d.state === 'away') { HOOK.toast(`${d.name} 不在家哦`, true); return; } if (d.act) endAct(d); d.path = []; d.state = 'idle'; d.think = 3; d.dir = 'down'; say(d, '叫我吗？'); };
}

function tickInfo() {
  const d = G.dolls.find(o => o.uid === G.sel);
  if (d && !$('#dollInfo').hidden) {
    const partners = confirmedPartners(d), strip = $('#infoPartners');
    const signature = JSON.stringify(partners.map(o => [o.uid, o.name]));
    if (strip.dataset.pairing !== signature) {
      strip.dataset.pairing = signature;
      strip.hidden = !partners.length;
      strip.innerHTML = partners.map(o => `<button class="partner-link" type="button" data-partner="${o.uid}">♥ 恋人 · ${esc(o.name)}</button>`).join('');
    }
    for (const i of document.querySelectorAll('[data-need]')) i.style.width = d.needs[i.dataset.need].toFixed(0) + '%';
    const s = $('#infoDoing'); if (s) s.textContent = doingText(d);
    const m = $('#infoMoney'); if (m) { m.textContent = TEST_MODE ? '∞' : yuan(d.money); m.classList.toggle('neg', !TEST_MODE && d.money < 0); }
    for (const o of G.dolls) {
      if (o === d) continue;
      const r = rel(d, o), lab = document.querySelector(`[data-rl="${o.uid}"]`);
      if (!lab) continue;
      // 信任和醋意是单向的：这里显示的是“我”对 TA 的看法
      const trust = trustWord(trustOf(d, o)), envy = jealousyOf(d, o) >= 20 ? '😤 醋意' : '';
      lab.textContent = [relLabel(r), trust, envy].filter(Boolean).join(' · ');
      document.querySelector(`[data-rel-row="${o.uid}"]`).classList.toggle('couple-rel', arePartners(d, o));
      document.querySelector(`[data-rf="${o.uid}"]`).style.width = Math.max(0, r.f).toFixed(0) + '%';
      document.querySelector(`[data-rlv="${o.uid}"]`).style.width = r.l.toFixed(0) + '%';
    }
  }
  for (const s of document.querySelectorAll('[data-doing]')) {
    const o = G.dolls.find(x => x.uid === +s.dataset.doing); if (o) s.textContent = doingText(o);
  }
  for (const s of document.querySelectorAll('[data-partners]')) {
    const o = G.dolls.find(x => x.uid === +s.dataset.partners);
    if (!o) continue;
    const names = confirmedPartners(o).map(p => p.name).join('、');
    s.hidden = !names;
    const caption = names ? `♥ 恋人 · ${names}` : '';
    if (s.textContent !== caption) s.textContent = caption;
  }
}

HOOK.select = (reveal = false) => {
  if (reveal) $('#side').open = true;
  renderDollList(); renderInfo(); tickInfo(); updateCommunityStatus();
};

/* ---------- 生活日志 ---------- */
function renderLog() {
  const box = $('#logList'); box.innerHTML = '';
  if (!G.log.length) { box.append(el('div', 'log-empty', '还没有发生什么事～')); return; }
  let day = null;
  for (let i = G.log.length - 1; i >= 0; i--) {
    const e = G.log[i];
    if (e.d !== day) { day = e.d; box.append(el('div', 'log-day', monthLabel(e.d))); }
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
  $('#hint').textContent = m === 'build' ? '选「院子家具」可以布置屋外，住户会自己去使用。' : '👆 先点一位小人，再点家具安排活动 · 拖到另一位身边可互动';
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
  $('#dayLabel').textContent = `${monthLabel(G.day)} · ${S.icon}${S.name}${Hd ? ' · ' + Hd.icon + Hd.name : ''}`;
  const sky = h >= 21 || h < 6 ? '🌙' : h < 8 ? '🌅' : h >= 18 ? '🌇' : '☀️';
  $('#timeIcon').textContent = G.weather && G.weather !== 'sunny' ? WEATHER[G.weather].icon : sky;
  $('#timeIcon').title = WEATHER[G.weather || 'sunny'].name;
}

/* ---------- 布置面板 ---------- */
let tab = 'essentials';
const catalogTabs = document.querySelectorAll('#buildBar [data-tab]');
catalogTabs.forEach(button => button.onclick = () => {
  if (tab === button.dataset.tab) return;
  if (G.build.placing) cancelPlacing();
  tab = button.dataset.tab;
  catalogTabs.forEach(option => {
    option.classList.toggle('on', option === button);
    option.setAttribute('aria-pressed', String(option === button));
  });
  renderPalette();
  SFX.play('click');
});
$('#btnTrash').onclick = () => {
  if (G.build.placing) cancelPlacing();
  G.build.trash = !G.build.trash; $('#btnTrash').classList.toggle('on', G.build.trash);
  $('#buildHint').textContent = G.build.trash ? '删除模式：点击房间里的家具把它移走' : '选择家具后点击房间放置 · 点已有家具可以拿起移动 · 右键/Esc 取消';
  SFX.play('click');
};
$('#btnReset').onclick = () => {
  if (!confirm('把房间恢复成默认布置吗？（住户会保留）')) return;
  const keepDolls = G.dolls.map(d => ({ guest: d.guest, pid: d.pid, name: d.name, gender: d.gender, heart: d.heart, zodiac: d.zodiac, mbti: d.mbti, persona: d.persona, job: d.job, money: d.money, look: d.look, needs: d.needs, routineTimes: d.routineTimes, away: d.state === 'away', awayUntil: d.awayUntil, lastWorkDay: d.lastWorkDay }));
  const keepRel = G.rel;
  const s = defaultHouseSave(); s.dolls = keepDolls; s.time = G.time; s.day = G.day; s.monthEvents = G.monthEvents;
  s.paperMoments = G.paperMoments;
  s.keepsakes = { ...G.keepsakes, corners: {}, project: null };
  s.rel = keepRel; s.npcMemory = G.npcMemory; s.paper=G.paper; s.daily=G.daily; s.dayRelations=G.dayRelations; s.community=G.community; applySave(s); rebuild(); save(); HOOK.select(); renderPalette(); HOOK.toast('房间已恢复默认', true);
};

const iconCache = {};
dollAtlas?.addEventListener('load', () => {
  HOOK.select();
  if (!$('#wardrobe').hidden) drawWdPreview();
  if ($('#paperDialog').open) renderHousePaper(housePaperIndex);
  if ($('#applicationsDialog').open) renderApplications();
  if ($('#neighborDialog').open) {
    delete $('#neighborPorch').dataset.scene;
    updateNeighborDialog();
  }
});
cottageAtlas?.addEventListener('load', () => {
  for (const id of Object.keys(COTTAGE_SPRITES)) delete iconCache[id];
  if (G.mode === 'build') renderPalette();
});
function renderPalette() {
  const pal = $('#palette'); pal.innerHTML = '';
  $('#btnTrash').classList.toggle('on', G.build.trash);
  pal.dataset.category = tab;
  const group = FURNITURE_GROUPS[tab];
  if (tab === 'keepsakes') {
    for (const piece of unplacedKeepsakes()) {
      const b = el('button', 'item' + (G.build.placing?.piece === piece.key ? ' on' : ''));
      b.type = 'button';
      b.append(furnitureIcon('handmadePlanter', 56, { piece: piece.key }), el('span', 'item-name', KEEPSAKE_FINISHES[piece.finish][0] + '花架'),
        el('small', 'item-purpose', piece.makers.join('和')));
      b.title = keepsakeLabel(piece);
      b.onclick = () => {
        if (G.build.placing?.moved) cancelPlacing();
        G.build.trash = false;
        G.build.placing = G.build.placing?.piece === piece.key ? null : { id: 'handmadePlanter', piece: piece.key };
        renderPalette();
      };
      pal.append(b);
    }
    if (!pal.children.length) pal.append(el('p', 'hint', '成品会出现在这里。到「小屋手记」约两位住户一起做花架。'));
  } else if (group) {
    for (const id of group) {
      const F = FURNITURE[id];
      const [price, lv] = SHOP[id], have = G.inv[id] || 0, locked = lv > G.level && !have;
      const b = el('button', 'item' + (G.build.placing && G.build.placing.id === id && !G.build.placing.moved ? ' on' : '') + (locked ? ' locked' : ''));
      iconCache[id] = iconCache[id] || furnitureIcon(id);
      const c = el('canvas'); c.width = c.height = 56 * PIXEL_SCALE; c.getContext('2d').drawImage(iconCache[id], 0, 0);
      const tag = TEST_MODE ? '无限库存' : have ? `仓库 ×${have}` : locked ? `🔒 ${LEVELS[lv].name}` : yuan(price);
      const purpose = F.use ? ACT_NAMES[F.use] : F.layer === 'wall' ? '挂墙' : '摆在地面';
      b.append(c, el('span', 'item-name', F.name), el('small', 'item-purpose', purpose),
        el('small', 'price' + (TEST_MODE || have ? ' own' : price > G.fund && !locked ? ' poor' : ''), tag));
      b.title = `${F.name} · ${purpose}`;
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
  const fund = TEST_MODE ? '∞' : yuan(G.fund);
  $('#fundAmt').textContent = $('#fundTop').textContent = fund;
  const L = LEVELS[G.level], next = LEVELS[G.level + 1];
  $('#houseLv').textContent = `🏠 ${L.name}（Lv${G.level} · 最多 ${L.cap} 人）`;
  const ex = $('#btnExpand');
  ex.textContent = next ? `🔨 扩建成「${next.name}」${yuan(next.cost)}` : '🏰 已经是最大的房子了';
  ex.disabled = !next;
  ex.classList.toggle('ready', !!next && G.fund >= next.cost);
  $('#btnCrowd').disabled = TEST_MODE || G.crowdDay === G.day;
}
$('#btnCrowd').onclick = () => crowdfund();
$('#btnExpand').onclick = () => expand();

/* ---------- 衣橱 ---------- */
let wdUid = null, wdDir = 'down', wdFrame = 0, wdTimer = 0;
const wdDoll = () => G.dolls.find(d => d.uid === wdUid);

function openWardrobe(uid) {
  const resident = residents().find(d => d.uid === uid) || residents()[0];
  if (!resident) return;
  wdUid = resident.uid;
  $('#wardrobe').hidden = false; SFX.play('open');
  renderWardrobe();
}
function closeWardrobe() { $('#wardrobe').hidden = true; HOOK.select(); save(); }
$('#wdClose').onclick = closeWardrobe;
$('#wardrobe').addEventListener('pointerdown', e => { if (e.target.id === 'wardrobe') closeWardrobe(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#wardrobe').hidden) closeWardrobe(); });
document.querySelectorAll('.wd-dir button').forEach(b => b.onclick = () => { wdDir = b.dataset.dir; SFX.play('click'); });
$('#wdName').oninput = e => { const d = wdDoll(); if (d) { d.name = e.target.value.trim() || '无名'; renderWdTabs(); } };
$('#wdName').onchange = () => wdSaved();
$('#wdRandom').onclick = () => {
  const d = wdDoll(); if (!d) return;
  d.look = randomLook(); SFX.play('love'); renderWardrobe(); wdSaved();
};
$('#wdRemove').onclick = () => {
  const d = wdDoll(); if (!d) return;
  if (residents().length <= 1) { HOOK.toast('至少要留一位住户哦', true); return; }
  if (!confirm(`真的要让 ${d.name} 搬走吗？`)) return;
  if (d.act) endAct(d);
  for (const o of G.dolls) if (o.act && o.act.partner === d) endAct(o);
  G.dolls = G.dolls.filter(o => o !== d);
  if (G.sel === d.uid) G.sel = null;
  HOOK.toast(`${d.name} 挥挥手搬走了`); wdUid = residents()[0].uid; renderWardrobe(); HOOK.select(); save();
};

function renderWdTabs() {
  const box = $('#wdTabs'); box.innerHTML = '';
  for (const d of residents()) {
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
      b.onclick = () => { d.look[key] = k; SFX.play('pop'); renderWardrobe(); wdSaved(); };
      w.append(b);
    }
    return w;
  };
  const swatches = (cols, key) => {
    const w = el('div', 'chips');
    cols.forEach((col, i) => {
      const b = el('button', 'swatch' + (d.look[key] === i ? ' on' : ''));
      b.style.background = col; b.setAttribute('aria-label', col);
      b.onclick = () => { d.look[key] = i; SFX.play('pop'); renderWardrobe(); wdSaved(); };
      w.append(b);
    });
    return w;
  };
  const pers = el('div', 'chips');
  for (const [k, P] of Object.entries(PERSONAS)) {
    const b = el('button', 'chip' + (d.persona === k ? ' on' : ''), `${P.icon} ${P.name}<small>${P.desc}</small>`);
    b.onclick = () => { d.persona = k; SFX.play('pop'); say(d, pick(P.lines)); renderWardrobe(); wdSaved(); };
    pers.append(b);
  }
  section('性格', pers);
  const jobs = el('div', 'chips');
  for (const [k, J] of Object.entries(JOBS)) {
    const sub = J.start == null ? (k === 'artist' ? '不用出门 · 偶尔卖画' : '不用出门 · 没有收入') : `${hhmm(J.start)}–${hhmm(J.end)} · ${yuan(J.wage)}/月${k === 'student' ? ' · 不谈恋爱' : ''}`;
    const b = el('button', 'chip' + (d.job === k ? ' on' : ''), `${J.icon} ${J.name}<small>${sub}</small>`);
    b.onclick = () => {
      d.job = k; SFX.play('pop');
      if (k === 'student') { clearRomance(d); HOOK.toast('学生不参与恋爱剧情，和 TA 有关的恋爱关系已清零', true); }
      renderWardrobe(); wdSaved();
    };
    jobs.append(b);
  }
  section('职业', jobs);
  const gen = el('div', 'chips');
  for (const [k, n] of Object.entries(GENDERS)) {
    const b = el('button', 'chip' + (d.gender === k ? ' on' : ''), n);
    b.onclick = () => { d.gender = k; SFX.play('pop'); renderWardrobe(); wdSaved(); };
    gen.append(b);
  }
  section('性别', gen);
  const zs = el('div', 'chips');
  for (const z of ZODIAC) {
    const b = el('button', 'chip' + (d.zodiac === z.id ? ' on' : ''), `${z.icon} ${z.name}<small>${ELEMENTS[z.el].icon}${ELEMENTS[z.el].name}</small>`);
    b.onclick = () => { d.zodiac = z.id; SFX.play('pop'); renderWardrobe(); wdSaved(); };
    zs.append(b);
  }
  section('星座', zs);
  const mbtiPicker = el('select', 'mbti-picker');
  mbtiPicker.setAttribute('aria-label', 'MBTI 类型');
  for (const [code, name] of Object.entries(MBTI_NAMES)) {
    const option = el('option', null, `${code} · ${name}`);
    option.value = code;
    mbtiPicker.append(option);
  }
  mbtiPicker.value = mb(d);
  mbtiPicker.onchange = () => { d.mbti = mbtiPicker.value; SFX.play('pop'); renderWardrobe(); wdSaved(); };
  const mbtiBox = el('div', 'mbti-settings');
  mbtiBox.append(mbtiPicker, el('small', 'hint', `常见偏好 · ${MBTI_INTERESTS[mb(d)].map(use => ACT_NAMES[use]).join('、')}`));
  section('MBTI', mbtiBox);
  const hearts = el('div', 'chips');
  for (const [k, H] of Object.entries(HEARTS)) {
    const b = el('button', 'chip' + (d.heart === k ? ' on' : ''), `${H.icon} ${H.name}<small>${H.desc}</small>`);
    b.onclick = () => { d.heart = k; SFX.play('pop'); renderWardrobe(); wdSaved(); };
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

// 衣橱里每次换装都在预览下方显示一句确认，1.5 秒后消失
let wdSavedTimer = 0;
function wdSaved() {
  const s = $('#wdSaved');
  if (!s) return;
  s.textContent = '✓ 已换好';
  clearTimeout(wdSavedTimer);
  wdSavedTimer = setTimeout(() => { s.textContent = ''; }, 1500);
}

/* ---------- 串门、派对与入住 ---------- */
function updateCommunityStatus() {
  const event = G.community.active;
  const status = $('#communityStatus');
  const pending = G.community.deferredPicnic;
  const outing = G.community.outing;
  status.hidden = !event && !pending && !outing;
  $('#picnicNotice').hidden = !event?.rainDeadline;
  if ($('#neighborDialog').open) updateNeighborDialog();
  if (!event) {
    status.textContent = outing ? `🏡 ${communityDoll(outing.pid)?.name || '住户'}${outing.phase === 'leaving' ? '准备去隔壁' : '正在麦麦家做客'}` : pending ? '🧺 野餐已改期，等天晴再开场' : '';
    return;
  }
  const style = GET_TOGETHERS[event.kind], host = communityDoll(event.hostPid), guest = communityDoll(event.guestPid);
  const plan = event.rainMode && PICNIC_PLANS[event.rainMode];
  const label = event.leavingAt ? `👋 ${guest?.name || '朋友'} 正在回家` : `${style.icon} ${event.exchange ? '邻居来访' : style.name} · ${host?.name || '住户'}和${guest?.name || '朋友'} · ${event.joined.length} 人参与${plan ? ' · ' + plan : ''}`;
  if (status.textContent !== label) status.textContent = label;
}
HOOK.community = updateCommunityStatus;

for (const [plan, label] of Object.entries(PICNIC_PLANS)) {
  const button = el('button', 'btn small', label);
  button.type = 'button';
  button.onclick = () => {
    if (!choosePicnicPlan(plan)) HOOK.toast('现在客厅没有足够的可达空位，可以换一个安排。', true);
  };
  $('#picnicPlans').append(button);
}

function updateNeighborDialog() {
  const select = $('#neighborVisitor');
  const d = communityDoll(select.value), tie = d && neighborTie(d);
  const outing = G.community.outing;
  const visitor = outing?.phase === 'visiting' && communityDoll(outing.pid);
  const neighbor = communityDoll(NEIGHBOR_PID) || neighborProfile();
  const text = visitor ? `${visitor.name}正在门廊陪麦麦吃点心。` : neighborSchedule();
  $('#neighborStatus').textContent = text;
  const porch = $('#neighborPorch');
  const key = JSON.stringify([text, neighbor.look, visitor && visitor.look]);
  if (porch.dataset.scene !== key) {
    porch.dataset.scene = key;
    const cast = [neighbor, visitor].filter(Boolean);
    porch.replaceChildren(...cast.map(person => {
      const figure = el('figure');
      const portrait = el('canvas');
      portrait.width = 20; portrait.height = 24;
      dollPortrait(portrait, person.look, 'down', 0, visitor ? 'sit' : 'stand');
      const caption = el('figcaption'); caption.textContent = person.name;
      figure.append(portrait, caption);
      return figure;
    }));
  }
  $('#neighborTie').textContent = tie
    ? `来往了 ${tie.months} 个月 · 一起吃过 ${tie.meals} 次饭${tie.invited && G.day < tie.inviteMonth ? ' · 下个月可以赴约' : ''}`
    : '麦麦下午回家，有时会来送面包或借工具。';
  $('#neighborGo').disabled = !canVisitNeighbor(d);
}

$('#btnNeighbor').onclick = () => {
  const select = $('#neighborVisitor');
  select.replaceChildren(...residents().map(d => {
    const option = el('option'); option.value = d.pid; option.textContent = d.name; return option;
  }));
  const selected = residents().find(d => d.uid === G.sel);
  if (selected) select.value = selected.pid;
  else {
    const acquainted = residents().find(d => neighborTie(d)?.invited);
    if (acquainted) select.value = acquainted.pid;
  }
  updateNeighborDialog();
  $('#neighborDialog').showModal();
};
$('#neighborVisitor').onchange = updateNeighborDialog;
$('#neighborGo').onclick = () => {
  if (!startNeighborOuting(communityDoll($('#neighborVisitor').value))) HOOK.toast('现在走不到门口，稍后再去吧。', true);
};

$('#btnCommunity').onclick = () => {
  const hosts = availableHosts();
  const select = $('#communityHost');
  select.innerHTML = '';
  for (const d of hosts) {
    const option = el('option');
    option.value = d.pid; option.textContent = d.name; select.append(option);
  }
  if (hosts.some(d => d.uid === G.sel)) select.value = hosts.find(d => d.uid === G.sel).pid;
  const event = G.community.active;
  const ready = !event && !G.community.outing && absNow() >= G.community.nextEventAt && hosts.length > 0;
  $('#communityHelp').textContent = event ? `正在进行${GET_TOGETHERS[event.kind].name}，结束后可以再邀请朋友。`
    : !hosts.length ? '现在没有在家且醒着的住户。'
    : !ready ? '刚送走朋友，让小屋休息一会儿吧。'
    : '选一位住户做东。朋友会从门口进来，有空的室友可以加入派对。';
  const choices = $('#communityChoices');
  choices.innerHTML = '';
  for (const [kind, style] of Object.entries(GET_TOGETHERS)) {
    const button = el('button', 'btn small', `${style.icon} ${kind === 'visit' ? '请朋友来玩' : '办' + style.name}`);
    button.disabled = !ready;
    button.onclick = () => {
      if (startGetTogether(communityDoll(select.value), kind)) $('#communityDialog').close();
      else $('#communityHelp').textContent = '现在办不了。确认主人在家，门口和一楼客厅有通道和空位。';
    };
    choices.append(button);
  }
  $('#communityDialog').showModal();
};

function welcomeResident(d) {
  if (!d) { renderApplications(); return; }
  $('#applicationsDialog').close();
  G.sel = d.uid;
  say(d, '大家好，请多关照！');
  spawnHeart(d);
  SFX.play('love');
  HOOK.select();
  HOOK.toast(`${d.name} 搬进来啦！`);
  save();
}

function renderApplications() {
  const canMove = residents().length < residentLimit();
  $('#applicationSpace').textContent = `住户 ${residents().length} / ${residentLimit()}${canMove ? '' : ' · 小屋已住满，可以扩建或留待有空位时再邀请。'}`;
  const list = $('#applicationList');
  list.innerHTML = '';
  for (const application of G.community.applications) {
    const friend = G.community.friends.find(f => f.pid === application.pid);
    if (!friend) continue;
    const entry = el('div', 'application-row');
    const portrait = el('canvas'); portrait.width = 20; portrait.height = 24;
    dollPortrait(portrait, friend.look);
    const info = el('div', 'application-info');
    const title = el('strong'); title.textContent = friend.name;
    const host = communityDoll(friend.hostPid);
    const detail = el('small');
    detail.textContent = `${PERSONAS[friend.persona].name} · ${host ? host.name + '的朋友' : '来访过的朋友'} · 来访 ${friend.visits} 次`;
    info.append(title, detail);
    const button = el('button', 'btn small', '邀请入住');
    button.setAttribute('aria-label', `邀请 ${friend.name} 入住`);
    button.disabled = !canMove;
    button.onclick = () => welcomeResident(moveInApplicant(friend.pid));
    entry.append(portrait, info, button); list.append(entry);
  }
  if (!list.children.length) list.append(el('p', 'hint', '还没有入住申请。朋友来玩得开心，就可能在离开时留下申请。'));
  $('#btnRandomResident').disabled = !canMove;
}
$('#btnAddDoll').onclick = () => { renderApplications(); $('#applicationsDialog').showModal(); };
$('#btnRandomResident').onclick = () => {
  if (residents().length < residentLimit()) welcomeResident(addDoll(newcomerProfile()));
};

function updateKeepsakeDialog(reset = false) {
  if (reset) {
    for (const [i, id] of ['keepsakeMaker1', 'keepsakeMaker2'].entries()) {
      const select = $('#' + id);
      select.replaceChildren(...residents().map(d => {
        const option = el('option', null, '');
        option.textContent = d.name;
        option.value = d.pid;
        return option;
      }));
      select.selectedIndex = Math.min(i, residents().length - 1);
    }
    $('#keepsakeFinish').replaceChildren(...Object.entries(KEEPSAKE_FINISHES).map(([id, [name]]) => {
      const option = el('option', null, name);
      option.value = id;
      return option;
    }));
  }
  const project = G.keepsakes.project;
  const bench = G.furniture.some(f => f.id === 'craftBench');
  $('#keepsakeStatus').textContent = project ? project.people.map(pid => communityDoll(pid)?.name).join('和') +
    (project.work ? '正在给花架上色。' : '正准备去手工台。') : bench ?
    '选两位住户和一种颜色。等他们一起到手工台，成品就会放进「布置 → 纪念物」。' :
    '先到「布置 → 兴趣家具」摆一张奶糖手工台，台前给两位住户留出空位。';
  $('#keepsakeStart').disabled = !bench || !!project || residents().length < 2;
  const nameOf = pid => (communityDoll(pid) || G.community.friends.find(p => p.pid === pid))?.name;
  const notes = [];
  for (const f of G.furniture) {
    const record = G.keepsakes.corners[f.key], name = nameOf(record?.owner);
    if (!name) continue;
    const companions = record.regulars.filter(pid => pid !== record.owner).map(nameOf).filter(Boolean);
    notes.push(`${name}的${CORNER_NAMES[cornerKind(f) || 'read']} · ${FURNITURE[f.id].name}${companions.length ? ' · 也常来的有 ' + companions.join('、') : ''}`);
  }
  for (const tie of Object.values(G.keepsakes.traditions)) {
    const names = tie.people.map(nameOf);
    if (names.every(Boolean)) notes.push(`${names.join('和')} · 下雨时想再去书房喝茶`);
  }
  const list = (selector, items, empty) => {
    const nodes = (items.length ? items : [empty]).map(text => {
      const item = el('li', null, '');
      item.textContent = text;
      return item;
    });
    $(selector).replaceChildren(...nodes);
  };
  list('#keepsakeNotes', notes, '常来坐坐，过几个月就会有属于自己的小角落。');
  list('#keepsakePieces', G.keepsakes.pieces.map(keepsakeLabel), '还没有一起做过的纪念物。');
}

$('#btnKeepsakes').onclick = () => {
  updateKeepsakeDialog(true);
  $('#keepsakesDialog').showModal();
};
$('#keepsakeStart').onclick = () => {
  const pair = ['#keepsakeMaker1', '#keepsakeMaker2'].map(id => communityDoll($(id).value));
  if (startKeepsakeProject(...pair, $('#keepsakeFinish').value)) {
    $('#keepsakesDialog').close();
    HOOK.toast('🧵 两位住户要去手工台做花架了', true);
  } else $('#keepsakeStatus').textContent = '请选择两位不同的住户。两人要在家有空，手工台前也要有两个能走到的空位。';
};

/* ---------- 主循环 ---------- */
load(); rebuild(); HOOK.select(); updateClock(); renderLog(); renderShopBar();
let last = performance.now(), uiT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  // 月报曾因玩家正忙（拖小人、衣橱、别的弹窗）而挂起：等空闲了再弹出来
  if (G.paperPending && typeof playerBusy === 'function' && !playerBusy()) { G.paperPending = false; updateHousePaperButton(); showHousePaper(); }
  uiT += dt;
  if (uiT > 0.25) { uiT = 0; updateClock(); tickInfo(); renderShopBar(); if ($('#neighborDialog').open) updateNeighborDialog(); }
  if (!$('#wardrobe').hidden) { wdTimer += dt; if (wdTimer > 0.18) { wdTimer = 0; wdFrame = (wdFrame + 1) % 4; drawWdPreview(); } }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('beforeunload', save);

document.getElementById('dailyPaper').onclick=showHousePaper;
document.getElementById('paperOlder').onclick = () => renderHousePaper(housePaperIndex - 1);
document.getElementById('paperNewer').onclick = () => renderHousePaper(housePaperIndex + 1);
document.getElementById('paperCopy').onclick = async () => {
  const issue = currentHousePaper();
  if (!issue) return;
  try {
    await navigator.clipboard.writeText(housePaperText(issue));
    HOOK.toast('已复制本期月报', true);
  } catch { HOOK.toast('可以选中月报文字手动复制', true); }
};
const paperAuto=document.getElementById('paperAuto');
const paperPreference = TEST_MODE ? 'house-test-paper-auto' : 'house-paper-auto';
paperAuto.checked=true;
try{paperAuto.checked=localStorage.getItem(paperPreference)!=='off';}catch{}
paperAuto.onchange=()=>{try{localStorage.setItem(paperPreference,paperAuto.checked?'on':'off');}catch{}};
updateHousePaperButton();

const paperOffline=document.getElementById('paperOffline');
paperOffline.checked=offlineEnabled();
paperOffline.onchange=()=>{try{localStorage.setItem(OFFLINE_KEY,paperOffline.checked?'on':'off');}catch{}};
document.getElementById('paperCard').onclick = () => {
  const issue = currentHousePaper();
  if (issue) saveHousePaperCard(issue);
};
function renderRewind(){
  const list=document.getElementById('rewindList');
  const snaps=SaveManager.snapshots(localStorage,SAVE_KEY).sort((a,b)=>b.day-a.day);
  list.replaceChildren(...snaps.map(snap=>{
    const row=el('div','rewind-row',`<span>${monthLabel(snap.day)} 月初${snap.day===G.day?' · 本月':''}</span>`);
    const button=el('button','btn small ghost','回到这里');
    button.onclick=()=>{
      if(!confirm(`回到${monthLabel(snap.day)}月初？之后发生的事都会被改写。`))return;
      if(restoreHouseSnapshot(snap.index)){
        document.getElementById('paperDialog').close();
        HOOK.select();updateClock();renderLog();renderShopBar();updateHousePaperButton();
        HOOK.toast(`🕰 回到了${monthLabel(G.day)}月初`,true);
      }else HOOK.toast('这份快照读不出来了',true);
    };
    row.append(button);return row;
  }));
  if(!snaps.length)list.textContent='还没有快照。';
}
document.querySelector('.rewind-box').addEventListener('toggle',renderRewind);

// 离线模拟：补上关掉页面期间的生活
const away=catchUpOffline();
if(away){renderLog();HOOK.select();updateClock();if(away.hours>=1)HOOK.toast(`🌙 你不在的 ${away.hours} 小时里，小屋发生了 ${away.happened} 件事`,true);}
