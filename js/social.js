// 人际关系与多人互动：友好度 / 恋爱度、聊天打闹拥抱表白吵架、围观别人弹琴打游戏
// 关系存在 G.rel 里，键是两个小人的永久 id（pid）排序后拼起来

const REL_LEVELS = [[90, '挚友'], [70, '好友'], [40, '朋友'], [20, '认识'], [0, '陌生'], [-100, '不和']];
const LOVE_LEVELS = [[75, '喜欢'], [45, '心动'], [20, '有好感'], [-100, '']];

// 别人正在做这些事时，可以凑过去一起
const JOIN = {
  piano: { verb: '听{n}弹琴', like: 'piano', dance: 0.5, lines: ['好好听～', '🎵 ♪', '再来一首！', '是新曲子吗？'], back: ['谢谢捧场！', '为你弹的～'] },
  dance: { verb: '和{n}一起跳舞', like: 'dance', dance: 1, lines: ['一起跳！', '💃 转圈圈', '跟上节奏！'], back: ['跳得不错嘛！', '耶～'] },
  game:  { verb: '围观{n}打游戏', like: 'game', dance: 0, lines: ['加油加油！', '左边左边！', '好厉害！', '下一局我来！'], back: ['看我的！', '别吵别吵'] },
  tv:    { verb: '陪{n}看电视', like: 'tv', dance: 0, lines: ['这集我看过！', '哈哈哈哈', '📺 嘘——'], back: ['一起看嘛', '零食呢？'] },
  cook:  { verb: '等{n}做饭', like: 'snack', dance: 0, lines: ['好香啊～', '能分我一口吗？', '🤤', '我来帮忙！'], back: ['马上就好～', '给你留了一份'] },
  read:  { verb: '凑过去看{n}的书', like: 'read', dance: 0, lines: ['在看什么书？', '这本好看吗？', '借我看看'], back: ['嘘……', '看完借你'] },
};

// 两人面对面的互动种类
const SOCIAL = {
  chat:  { verb: '和{n}聊天', a: ['你好呀！', '聊点什么呢', '今天天气真好', '真的吗？！'], b: ['嗯嗯！', '哈哈哈', '我也觉得！', '然后呢？'] },
  joke:  { verb: '和{n}打闹', a: ['看招！', '哈哈哈哈', '😂 你好好笑'], b: ['哎呀别闹～', '😆', '哈哈哈停不下来'] },
  hug:   { verb: '和{n}抱抱', a: ['抱一个！', '🤗'], b: ['嘿嘿～', '❤'] },
  flirt: { verb: '向{n}表白', a: ['我……我有话想说', '你今天真好看……', '要不要一起看星星？'], b: [] },
  kiss:  { verb: '和{n}亲亲', a: ['💋', '最喜欢你了'], b: ['❤ ❤', '我也是～'] },
  argue: { verb: '和{n}吵架', a: ['💢 哼！', '都怪你！', '你才是！'], b: ['💢 不理你了', '明明是你！', '哼！'] },
};

function relKey(a, b) { return a.pid < b.pid ? a.pid + '|' + b.pid : b.pid + '|' + a.pid; }
function rel(a, b) {
  const k = relKey(a, b);
  if (!G.rel[k]) G.rel[k] = { f: 10 + Math.round(Math.random() * 15), l: 0, chem: +(0.6 + Math.random() * 0.9).toFixed(2), lovers: false };
  return G.rel[k];
}
const levelOf = (v, table) => table.find(([min]) => v >= min)[1];
function relLabel(r) {
  if (r.lovers) return '💕 恋人';
  const love = levelOf(r.l, LOVE_LEVELS);
  return levelOf(r.f, REL_LEVELS) + (love ? ' · ' + love : '');
}
function loverOf(d) { return G.dolls.find(o => o !== d && rel(d, o).lovers) || null; }

// 改变关系值，跨过关键门槛时弹提示
function bump(a, b, df, dl = 0) {
  const r = rel(a, b), before = levelOf(r.f, REL_LEVELS);
  r.f = Math.max(-100, Math.min(100, r.f + (df > 0 ? df * r.chem : df)));
  r.l = Math.max(0, Math.min(100, r.l + (dl > 0 ? dl * r.chem : dl)));
  const after = levelOf(r.f, REL_LEVELS);
  if (after !== before && df > 0 && ['朋友', '好友', '挚友'].includes(after)) HOOK.toast(`🤝 ${a.name} 和 ${b.name} 成为${after}了`);
  if (after === '不和' && before !== '不和') HOOK.toast(`💢 ${a.name} 和 ${b.name} 闹翻了……`);
  if (r.lovers && r.l < 30) { r.lovers = false; HOOK.toast(`💔 ${a.name} 和 ${b.name} 分手了……`); }
}

function weighted(list) {
  const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
  let x = Math.random() * total;
  for (const [v, w] of list) { x -= Math.max(0, w); if (x <= 0) return v; }
  return list[0][0];
}

// 挑一个想去找的人：越熟、越喜欢越容易被挑中
function pickPartner(d, others) {
  return weighted(others.map(o => { const r = rel(d, o); return [o, 12 + Math.max(0, r.f) * 0.6 + r.l * 0.6 + (r.lovers ? 40 : 0)]; }));
}

function chooseKind(d, p) {
  const r = rel(d, p), cranky = d.needs.fun < 25 || p.needs.fun < 25 || d.needs.hunger < 15;
  const single = !loverOf(d) && !loverOf(p);
  return weighted([
    ['chat', 34],
    ['joke', 14 + (d.persona === 'genki' ? 12 : 0) + (r.f > 40 ? 8 : 0)],
    ['hug', r.f >= 55 ? 16 + (d.persona === 'social' ? 8 : 0) : 0],
    ['flirt', r.f >= 45 && single && r.l >= 15 ? 6 + r.l * 0.7 : 0],
    ['kiss', r.lovers ? 26 : 0],
    ['argue', (r.f < 15 ? 10 : 1) + (cranky ? 7 : 0)],
  ]);
}

// 两人到齐后开始互动（由 game.js 的 arrive 调用）
function startSocial(d, p) {
  const kind = chooseKind(d, p), S = SOCIAL[kind], r = rel(d, p);
  const t = 5 + Math.random() * 3;
  d.state = 'act'; d.act = { type: 'chat', kind, partner: p, t, gain: { social: 26, fun: 6 } };
  p.state = 'act'; p.path = []; p.act = { type: 'chat', kind, partner: d, t, gain: { social: 22, fun: 5 }, passive: true };
  face(d, p.x, p.y); face(p, d.x, d.y);
  say(d, pick(S.a));
  let reply = pick(S.b.length ? S.b : ['……']);

  const spark = r.f >= 45 ? 1 : 0;   // 足够熟了，日常相处也会慢慢心动
  if (kind === 'chat') bump(d, p, 5, 1.5 * spark);
  if (kind === 'joke') { bump(d, p, 6, 1.2 * spark); d.needs.fun = Math.min(100, d.needs.fun + 8); p.needs.fun = Math.min(100, p.needs.fun + 8); }
  if (kind === 'hug') { bump(d, p, 5, 3 + 3 * spark); spawnHeart(d); spawnHeart(p); }
  if (kind === 'kiss') { bump(d, p, 2, 6); for (let i = 0; i < 3; i++) spawnHeart(i % 2 ? d : p, '💕'); d.happy = p.happy = 4; }
  if (kind === 'argue') {
    bump(d, p, -9, -5); d.needs.fun = Math.max(0, d.needs.fun - 6); p.needs.fun = Math.max(0, p.needs.fun - 6);
    d.act.gain = p.act.gain = { social: 6 }; spawnHeart(d, '💢'); spawnHeart(p, '💢'); SFX.play('deny');
  }
  if (kind === 'flirt') {
    const chance = Math.min(0.9, (0.15 + r.l / 140 + r.f / 260) * r.chem);
    if (Math.random() < chance) {
      bump(d, p, 3, 14); reply = pick(['嗯……我也是 💕', '其实我也注意你很久了', '好呀 ❤']);
      d.happy = p.happy = 4; for (let i = 0; i < 4; i++) spawnHeart(i % 2 ? d : p, '💗');
      if (r.l >= 70 && !r.lovers) { r.lovers = true; HOOK.toast(`💕 ${d.name} 和 ${p.name} 在一起了！`); SFX.play('newday'); }
      else SFX.play('love');
    } else {
      bump(d, p, -2, -4); reply = pick(['诶？我们还是做朋友吧', '让我想想……', '你、你在说什么呀']);
      d.needs.fun = Math.max(0, d.needs.fun - 10);
      setTimeout(() => d.act && d.act.kind === 'flirt' && say(d, '呜……'), 2600);
    }
  }
  setTimeout(() => p.act && p.act.partner === d && say(p, reply), 1300);
  SFX.play(kind === 'argue' ? 'deny' : 'chat');
}

// 互动进行中：偶尔再说一句、冒爱心
function tickSocial(d, dt) {
  const a = d.act, S = SOCIAL[a.kind] || SOCIAL.chat;
  if (a.passive || Math.random() > dt * 0.45) return;
  const who = Math.random() < 0.5 ? d : a.partner;
  const lines = who === d ? S.a : (S.b.length ? S.b : S.a);
  say(who, pick(lines), 1.8);
  if (a.kind === 'argue') spawnHeart(who, '💢');
  else if (a.kind !== 'chat' || rel(d, a.partner).l > 40) spawnHeart(who, rel(d, a.partner).lovers ? '💕' : '❤');
}

/* ---------- 围观 / 一起玩 ---------- */
function joinable(o) { return o.state === 'act' && o.act && JOIN[o.act.type] && o.act.t > 3; }

function startJoin(d, o) {
  const goals = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 2; dy++) {
    if (!dx && !dy) continue;
    goals.push({ x: o.tx + dx, y: o.ty + dy });
  }
  goals.sort((a, b) => Math.hypot(a.x - o.tx, a.y - o.ty) - Math.hypot(b.x - o.tx, b.y - o.ty));
  const taken = new Set(G.dolls.filter(x => x !== d).map(x => x.tx + ',' + x.ty));
  const path = findPath(d.tx, d.ty, goals.filter(g => !taken.has(g.x + ',' + g.y)));
  if (!path) return false;
  d.path = path; d.state = path.length ? 'walk' : 'arrive';
  d.act = { type: 'join', target: o, what: o.act.type };
  return true;
}

// 有人开始表演时，闲着的人会更快拿主意（更可能过来凑热闹）
function nudgeAudience(performer) {
  for (const o of G.dolls) if (o !== performer && (o.state === 'idle' || (o.state === 'walk' && o.act && o.act.type === 'wander'))) {
    if (o.state === 'walk') { o.path = []; o.state = 'idle'; o.act = null; }
    o.think = Math.min(o.think, 0.3 + Math.random() * 1.2);
  }
}

function arriveJoin(d) {
  const a = d.act, o = a.target;
  if (!G.dolls.includes(o) || !o.act || o.act.type !== a.what || o.state !== 'act') { say(d, '诶，结束了？'); endAct(d); return; }
  // 位置被别人占了就换个空位（只换一次）
  if (!a.moved && G.dolls.some(x => x !== d && x.tx === d.tx && x.ty === d.ty && x.state !== 'lift')) {
    a.moved = true;
    if (startJoin(d, o)) { d.act.moved = true; return; }
  }
  const J = JOIN[a.what];
  d.state = 'act'; a.t = Math.min(o.act.t + 1, 6 + Math.random() * 4);
  a.dance = Math.random() < J.dance + (d.persona === 'genki' ? 0.3 : 0);
  a.gain = { fun: 16, social: 10 };
  face(d, o.x, o.y);
  say(d, pick(J.lines));
  bump(d, o, 3, rel(d, o).f >= 45 ? 1.5 : 0);
  o.needs.social = Math.min(100, o.needs.social + 6);
  if (Math.random() < 0.6) setTimeout(() => o.act && say(o, pick(J.back)), 1400);
}

function tickJoin(d, dt) {
  const a = d.act, o = a.target;
  if (!o.act || o.act.type !== a.what) { endAct(d); return; }
  if (a.dance) {
    d.ft += dt;
    if (d.ft > 0.25) { d.ft = 0; d.frame = (d.frame + 1) % 4; d.dir = ['down', 'right', 'up', 'left'][d.frame]; }
    d.hop = d.frame % 2 ? 2 : 0;
  } else face(d, o.x, o.y);
  if (Math.random() < dt * 0.3) { say(d, pick(JOIN[a.what].lines), 2); if (rel(d, o).l > 50) spawnHeart(d); }
}

// 状态卡上显示“正在做什么”
function socialDoing(d) {
  const a = d.act;
  if (a.type === 'join') return JOIN[a.what].verb.replace('{n}', a.target.name);
  if (a.type === 'chat' && a.partner) {
    if (a.kind === 'flirt' && a.passive) return `被${a.partner.name}表白`;
    return (SOCIAL[a.kind] || SOCIAL.chat).verb.replace('{n}', a.partner.name);
  }
  return null;
}
