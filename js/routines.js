// Short household moments share the usual needs and pathfinding.
const ROUTINES = {
  stretch: { label: '伸个懒腰', personas: ['genki', 'active'], motion: 'stretch', gain: { energy: 5 },
    when: d => G.time >= 360 && G.time < 690 && d.needs.energy >= 35, line: '活动一下肩膀～' },
  rehearse: { label: '对镜练舞', personas: ['genki', 'stylist'], furniture: ['mirror', 'vanity'],
    motion: 'stretch', gain: { fun: 12, energy: -4 }, when: d => !G.night && d.needs.energy >= 50, line: '一、二、三，转身！' },
  clapGame: { label: '拍手游戏', personas: ['genki', 'active'], partner: true, motion: 'stretch',
    gain: { fun: 9, social: 9 }, when: d => !G.night && d.needs.energy >= 48, recipient: p => p.persona !== 'lazy' || p.needs.fun < 55,
    line: '跟得上我的节奏吗？', reply: '再来一次，这回我先！' },
  couchNap: { label: '靠在沙发上打盹', personas: ['lazy'], furniture: ['sofa', 'beanbag'],
    motion: 'doze', seat: true, gain: { energy: 14 }, when: d => !G.night && d.needs.energy < 72, line: '就眯一小会儿…' },
  cloudWatch: { label: '在窗边看雨雪', personas: ['lazy'], furniture: ['window'], motion: 'watch',
    gain: { fun: 10, energy: 3 }, when: () => ['rain', 'snow'].includes(G.weather), line: '在屋里听着还挺舒服' },
  comics: { label: '翻漫画', personas: ['lazy'], furniture: ['shelf'], motion: 'book',
    gain: { fun: 11 }, line: '再翻一页就合上' },
  catalogue: { label: '整理读书笔记', personas: ['nerd', 'tidy'], furniture: ['shelf', 'desk', 'corkboard'],
    motion: 'book', gain: { fun: 14 }, line: '把这一条摘下来' },
  planChess: { label: '研究残局', personas: ['nerd'], furniture: ['chessTable'], motion: 'book',
    gain: { fun: 13 }, line: '如果先走这枚棋子呢？' },
  skyNotes: { label: '在窗边记星图', personas: ['nerd', 'maker'], furniture: ['window'], motion: 'book',
    gain: { fun: 13 }, when: () => G.night && G.weather === 'sunny', line: '那一颗比昨晚还亮' },
  recipeBook: { label: '抄写食谱', personas: ['foodie', 'tidy'], furniture: ['desk', 'table', 'scrapbook'],
    motion: 'book', gain: { fun: 12 }, line: '下次少放一点糖' },
  smellHerbs: { label: '闻闻香草', personas: ['foodie', 'tidy'], furniture: ['herbStand', 'plant'],
    motion: 'watch', gain: { fun: 10 }, line: '闻起来像刚泡好的薄荷茶' },
  recipeSwap: { label: '交换食谱', personas: ['foodie', 'maker'], partner: true, motion: 'book',
    gain: { fun: 8, social: 10 }, when: () => G.time >= 660 && G.time <= 1260, recipient: p => p.persona === 'foodie' || p.needs.hunger <= 80,
    line: '你要不要试试这份配方？', reply: '好呀，下次做给你尝尝' },
  compliment: { label: '夸室友的穿搭', personas: ['social', 'stylist'], partner: true, motion: 'spark',
    gain: { fun: 7, social: 9 }, line: '你今天这一身配色很好看！', reply: '谢谢，我挑了好一会儿呢' },
  checkIn: { label: '问问室友近况', personas: ['social'], partner: true, motion: 'spark',
    gain: { fun: 5, social: 12 }, recipient: p => p.needs.fun <= 68 || p.needs.social <= 65,
    line: '今天过得怎么样？我可以陪你聊一会儿', reply: '有人听我说说，心里好多了' },
  writeCard: { label: '写小卡片', personas: ['social', 'maker', 'stylist'], furniture: ['desk', 'table', 'craftBench'],
    motion: 'book', gain: { fun: 11 }, line: '留一句话，晚点给室友看' },
};

for (const [id, routine] of Object.entries(ROUTINES)) {
  ACT_NAMES[id] = routine.label;
  ACT_LINES[id] = [routine.line];
}

function routineDistance(d, x, y) {
  return Math.abs(d.tx - x) + Math.abs(d.ty - y);
}

function routineAvailable(d, id) {
  const routine = ROUTINES[id];
  const likes = (MBTI_INTERESTS[mb(d)] || []).includes(id);
  return !!routine && (routine.personas.includes(d.persona) || likes)
    && d.needs.energy >= 24 && d.needs.hunger >= 20 && (d.needs.bladder >= 16 || !G.furniture.some(f => f.id === 'toilet'))
    && (d.routineTimes[id] ?? -Infinity) + 220 <= absNow()
    && (!routine.when || routine.when(d));
}

function routinePartnerAvailable(d, p, id) {
  const routine = ROUTINES[id];
  return p !== d && p.state === 'idle' && roomOf(d) === roomOf(p)
    && routineDistance(d, p.tx, p.ty) >= 1 && routineDistance(d, p.tx, p.ty) <= 3 && p.needs.energy >= 24
    && p.needs.hunger >= 20 && (p.needs.bladder >= 16 || !G.furniture.some(f => f.id === 'toilet')) && rel(d, p).f >= 25
    && (p.routineTimes[id] ?? -Infinity) + 220 <= absNow()
    && (!routine.recipient || routine.recipient(p));
}

function routineFurnitureRow(f) {
  return layerOf(f.id) === 'wall' ? (f.y < 0 ? FLOOR_SPLIT : WALL_ROWS) : f.y;
}

function routineOptions(d, want) {
  const out = [];
  for (const [type, routine] of Object.entries(ROUTINES)) {
    if (!routineAvailable(d, type)) continue;
    const s = 45 + want(routine.gain) + traitBonus(d, type) + Math.random() * 16 * noiseMul(d);
    if (routine.partner) {
      const partner = G.dolls.filter(p => routinePartnerAvailable(d, p, type))
        .sort((a, b) => rel(d, b).f - rel(d, a).f)[0];
      if (partner) out.push({ type, partner, s });
    } else if (routine.furniture) {
      const venues = G.furniture.filter(f => routine.furniture.includes(f.id) && !f.users.length);
      if (venues.length) out.push({ type, venues, s: s - 1.5 * Math.min(...venues.map(f => routineDistance(d, f.x, routineFurnitureRow(f)))) });
    } else {
      out.push({ type, s });
    }
  }
  return out;
}

function startRoutine(d, { type, partner, venues = [] }) {
  if (!routineAvailable(d, type)) return false;
  const routine = ROUTINES[type];
  if (routine.partner && (!partner || !routinePartnerAvailable(d, partner, type))) return false;
  if (routine.furniture) {
    for (const f of venues.slice().sort((a, b) =>
      routineDistance(d, a.x, routineFurnitureRow(a)) - routineDistance(d, b.x, routineFurnitureRow(b)))) {
      if (!G.furniture.includes(f) || f.users.length) continue;
      const row = routineFurnitureRow(f);
      const targets = layerOf(f.id) === 'wall'
        ? Array.from({ length: FURNITURE[f.id].w }, (_, i) => [{ x: f.x + i, y: row }, { x: f.x + i, y: row + 1 }]).flat()
        : approachTiles(f);
      const route = findPath(d.tx, d.ty, targets);
      if (!route) continue;
      f.users.push(d);
      d.path = route;
      d.act = { type, furn: f };
      d.state = route.length ? 'walk' : 'arrive';
      if (!route.length) beginRoutine(d);
      return true;
    }
    return false;
  }
  d.act = { type, partner };
  beginRoutine(d);
  return true;
}

function beginRoutine(d) {
  const { type, furn, partner } = d.act, routine = ROUTINES[type];
  if (!routineAvailable(d, type)) { endAct(d); return; }
  const t = (routine.seat ? 11 : 5 + Math.random() * 3) * durMul(d);
  d.state = 'act';
  d.ft = 0;
  Object.assign(d.act, { t, gain: routine.gain });
  d.routineTimes[type] = absNow();
  if (furn) {
    furn.active = true;
    face(d, furn.x * T + FURNITURE[furn.id].w * T / 2, routineFurnitureRow(furn) * T);
    if (routine.seat) {
      d.act.back = { x: d.tx, y: d.ty };
      d.act.onFurn = true;
      d.x = furn.x * T + 8; d.y = furn.y * T + 13; d.dir = 'down';
    }
  }
  const accessory = partner && OUTFIT.acc[partner.look.acc];
  const line = type === 'compliment' && accessory && partner.look.acc !== 'none'
    ? `你戴的${accessory}真好看！` : routine.line;
  say(d, line);
  if (partner) {
    partner.ft = 0;
    partner.state = 'act';
    partner.act = { type, partner: d, t, gain: routine.gain };
    partner.routineTimes[type] = absNow();
    face(d, partner.x, partner.y); face(partner, d.x, d.y);
    bump(d, partner, 2);
    const replyAct = partner.act;
    setTimeout(() => { if (partner.act === replyAct) say(partner, routine.reply); }, 850);
  }
  countHouseActivity('routine', partner ? `${d.name}与${partner.name} · ${routine.label}` : `${d.name} · ${routine.label}`);
}
