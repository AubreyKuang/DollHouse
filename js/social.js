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
const arePartners = (a, b) => a !== b && G.rel[relKey(a, b)]?.lovers === true;
const confirmedPartners = d => G.dolls.filter(o => arePartners(d, o));
function rel(a, b) {
  const k = relKey(a, b);
  if (!G.rel[k]) G.rel[k] = { f: 10 + Math.round(Math.random() * 15), l: 0, chem: +(0.6 + Math.random() * 0.9).toFixed(2), lovers: false };
  return G.rel[k];
}
const levelOf = (v, table) => table.find(([min]) => v >= min)[1];
function relLabel(r) {
  if (r.lovers) return '💕 恋人';
  if (r.secret) return '🤫 偷偷暧昧';
  const love = levelOf(r.l, LOVE_LEVELS), tags = typeof bondTagsText === 'function' ? bondTagsText(r) : '';
  return levelOf(r.f, REL_LEVELS) + (love ? ' · ' + love : '') + (tags ? ' · ' + tags : '');
}
function loverOf(d) { return G.dolls.find(o => o !== d && rel(d, o).lovers) || null; }

// 改变关系值，跨过关键门槛时弹提示
// 只要有一方是学生，就不进入任何恋爱剧情（表白、亲亲、暧昧、偷情、恋人、吃醋），只当朋友
const isStudent = d => d.job === 'student';
const canRomance = (a, b) => !a.guest && !b.guest && !isStudent(a) && !isStudent(b);
function clearRomance(d) {
  for (const o of G.dolls) if (o !== d) { const r = rel(d, o); r.l = 0; r.lovers = false; r.secret = false; }
  for (const o of G.dolls) if (o.jealousOf && o.jealousOf.who === d) o.jealousOf = null;
  d.jealousOf = null;
}

function bump(a, b, df, dl = 0) {
  if (!canRomance(a, b)) dl = 0;
  const r = rel(a, b), before = levelOf(r.f, REL_LEVELS);
  const cp = compat(a, b);                                    // 星座 + MBTI 缘分
  if (df < 0 && !isF(a) && !isF(b)) df *= 0.7;                // 两个 T 型吵完架不太记仇
  r.f = Math.max(-100, Math.min(100, r.f + (df > 0 ? df * r.chem * cp : df)));
  r.l = Math.max(0, Math.min(100, r.l + (dl > 0 ? dl * r.chem * cp * (isF(a) || isF(b) ? 1.15 : 1) : dl)));
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
  const lv = loverOf(d), lvAway = lv && (lv.state === 'away' || lying(lv));
  return weighted(others.map(o => {
    const r = rel(d, o);
    let w = 12 + Math.max(0, r.f) * 0.6 + r.l * 0.6 + (r.lovers ? 40 : 0);
    if (d.heart === 'fickle' && lv && o !== lv) w += r.l * (lvAway ? 1.6 : 0.5);   // 花心的人趁对象不在去找暧昧对象
    return [o, Math.max(1, w + 5 * NPCMemory.influence(G, d.pid, o.pid)) * compat(d, o)];
  }));
}

function chooseKind(d, p) {
  const r = rel(d, p), cranky = d.needs.fun < 25 || p.needs.fun < 25 || d.needs.hunger < 15;
  // 有对象的人只有“花心”才会去撩别人；对方有对象也只有花心的才会接招
  const ld = loverOf(d), lp = loverOf(p);
  const free_ = (x, l, other) => !l || l === other || x.heart === 'fickle';
  const canFlirt = !r.lovers && r.f >= 45 && r.l >= 15 && free_(d, ld, p) && (free_(p, lp, d) || p.heart !== 'loyal');
  const sneaky = ld && ld !== p && d.heart === 'fickle';
  return weighted([
    ['chat', 34],
    ['joke', 14 + (d.persona === 'genki' ? 12 : 0) + (r.f > 40 ? 8 : 0)],
    ['hug', r.f >= 55 ? 16 + (d.persona === 'social' ? 8 : 0) : 0],
    ['flirt', canFlirt && canRomance(d, p) ? (sneaky ? 14 : 6) + r.l * 0.7 : 0],
    ['kiss', !canRomance(d, p) ? 0 : r.lovers ? 26 : r.secret ? 18 : 0],
    ['argue', (r.f < 15 ? 10 : 1) + (cranky ? 7 : 0)],
  ]);
}

const availableForHouseChat = d => d.state === 'idle' ||
  (d.state === 'walk' && d.act?.type === 'wander');

function houseChatLines(d) {
  if (G.weather === 'rain') return ['听，雨打在窗上。', '听见了，屋里倒是挺暖和。', '等雨小点再出去吧。'];
  if (G.weather === 'snow') return ['窗外开始积雪了。', '难怪屋里一下子亮了起来。', '明早可以去院子看看。'];
  if (d.needs.energy < 35) return ['我今天有点累。', '那就先歇一会儿，我陪你坐坐。', '嗯，安静待一会儿也挺好。'];
  return ({
    foodie: ['下顿吃什么？我在想煮点面。', '好啊，我帮你摆碗。', '那我多煮一点。'],
    nerd: ['我刚看到一段特别有意思。', '讲给我听听？', '等我把那页找出来给你看。'],
    maker: ['我想给窗边做个小架子。', '放几盆花应该挺好看。', '好主意，我给花盆多留点位置。'],
    lazy: ['今天就想窝在家。', '也好，咱们可以慢慢过。', '嗯，先把这杯喝完。'],
  }[d.persona] || ['今天屋里好安静啊。', '嗯，刚好能坐下来聊会儿。', '那我再待一会儿。']);
}

function houseExchangeActive(d) {
  const speaker = d.act?.exchangeFrom;
  return Boolean(d.act?.exchange || (speaker && speaker.act?.exchange?.partnerAct === d.act));
}

function startHouseExchange(d, p, lines) {
  d.act.exchange = { partner: p, partnerAct: p.act, lines, next: 1, delay: 1.6 };
  p.act.exchangeFrom = d;
  say(d, lines[0], 1.55);
}

function tickHouseExchange(d, dt) {
  const talk = d.act.exchange;
  if (!talk || !G.dolls.includes(talk.partner) || talk.partner.act !== talk.partnerAct || talk.partner.state !== 'act' || !canSee(d, talk.partner)) {
    delete d.act.exchange;
    return;
  }
  if (talk.next >= talk.lines.length) return;
  talk.delay -= dt;
  if (talk.delay > 0) return;
  const speaker = talk.next % 2 ? talk.partner : d;
  say(speaker, talk.lines[talk.next++], 1.55);
  talk.delay += 1.6;
}

// 两人到齐后开始互动（由 game.js 的 arrive 调用）
function startSocial(d, p, introduced = false) {
  const jealousTalk = !!(d.act && d.act.jealous);   // 吃醋后来“算账”的那次吵架
  let kind = (d.act && d.act.kind) || chooseKind(d, p);
  if (!canRomance(d, p) && (kind === 'kiss' || kind === 'flirt')) kind = 'chat';
  const exchange = d.act?.exchange;
  const S = SOCIAL[kind], r = rel(d, p);
  const wereLovers = r.lovers;
  const t = 5 + Math.random() * 3;
  d.state = 'act'; d.act = { type: 'chat', kind, partner: p, t, gain: { social: 26, fun: 6 } };
  p.state = 'act'; p.path = []; p.act = { type: 'chat', kind, partner: d, t, gain: { social: 22, fun: 5 }, passive: true };
  face(d, p.x, p.y); face(p, d.x, d.y);
  for (const x of [d, p]) if (!isE(x)) x.needs.energy = Math.max(0, x.needs.energy - 3);   // 内向的人社交会累
  const PD = PERSONAS[d.persona], PP = PERSONAS[p.persona];
  d.act.t = p.act.t = t * ((PD.dur && PD.dur.chat) || 1);
  const lines = exchange?.lines || (kind === 'chat' ? houseChatLines(d) : null);
  if (lines) startHouseExchange(d, p, lines);
  else say(d, kind === 'chat' && PD.chat ? pick(PD.chat) : kind === 'flirt' && loverOf(d) && loverOf(d) !== p ? pick(['你今天……特别好看', '别告诉别人哦', '我们去没人的地方聊聊？']) : pick(S.a));
  let reply = kind === 'chat' && PP.chat ? pick(PP.chat) : pick(S.b.length ? S.b : ['……']);

  const spark = r.f >= 45 ? 1 : 0;   // 足够熟了，日常相处也会慢慢心动
  // 信任是单向的：被拿来开玩笑的人会记仇，吵架两边都会少一分信任
  if (kind === 'chat') { addTrust(d, p, 1); addTrust(p, d, 1); }
  if (kind === 'hug' || kind === 'kiss') { addTrust(d, p, 2); addTrust(p, d, 2); }
  if (kind === 'joke') addTrust(p, d, -3);
  if (kind === 'argue') { addTrust(d, p, -6); addTrust(p, d, -6); }
  if (kind === 'chat') bump(d, p, 5, 1.5 * spark);
  if (kind === 'joke') { bump(d, p, 6, 1.2 * spark); d.needs.fun = Math.min(100, d.needs.fun + 8); p.needs.fun = Math.min(100, p.needs.fun + 8); }
  if (kind === 'hug') { bump(d, p, 5, 3 + 3 * spark); spawnHeart(d); spawnHeart(p); }
  if (kind === 'kiss') { bump(d, p, 2, r.secret ? 8 : 6); for (let i = 0; i < 3; i++) spawnHeart(i % 2 ? d : p, '💕'); d.happy = p.happy = 4; }
  if (kind === 'argue') {
    bump(d, p, -9, -5); d.needs.fun = Math.max(0, d.needs.fun - 6); p.needs.fun = Math.max(0, p.needs.fun - 6);
    d.act.gain = p.act.gain = { social: 6 }; spawnHeart(d, '💢'); spawnHeart(p, '💢'); SFX.play('deny');
  }
  let flirtOk = false;
  if (kind === 'flirt') {
    const lp = loverOf(p), ld = loverOf(d);
    let chance = Math.min(0.9, (0.15 + r.l / 140 + r.f / 260) * r.chem * compat(d, p));
    if (lp && lp !== d) chance = p.heart === 'fickle' ? chance : p.heart === 'loyal' ? 0 : chance * 0.4;
    if (lp && lp !== d && p.heart === 'loyal') {
      bump(d, p, -6, -8); reply = pick(['我已经有对象了！', `我心里只有${lp.name}`, '请你自重一点']);
      spawnHeart(p, '💢');
    } else if (Math.random() < chance) {
      bump(d, p, 3, 14); reply = pick(['嗯……我也是 💕', '其实我也注意你很久了', '好呀 ❤']); flirtOk = true;
      d.happy = p.happy = 4; for (let i = 0; i < 4; i++) spawnHeart(i % 2 ? d : p, '💗');
      if (ld && ld !== p || lp && lp !== d) {
        // 背着对象暧昧：变成“地下情”，玩家能看到，但当事人的恋人不知道……除非被撞见
        if (!r.secret) HOOK.toast(`🤫 ${d.name} 和 ${p.name} 背着别人偷偷暧昧……`);
        r.secret = true; SFX.play('love');
        // 新欢比旧爱更喜欢了：花心的一方干脆变心
        for (const [x, old] of [[d, ld], [p, lp]]) {
          if (old && old !== (x === d ? p : d) && x.heart === 'fickle' && r.l >= 70 && r.l > rel(x, old).l) {
            const o = rel(x, old); o.lovers = false; o.l = Math.max(0, o.l - 40); o.f = Math.max(-100, o.f - 20);
            HOOK.toast(`💔 ${x.name} 变心了，甩了 ${old.name}`);
            const rival = x === d ? p : d;
            NPCMemory.record(G,{type:'breakup',time:absNow(),participants:[x.pid,old.pid],outcome:'left'},[
              {person:old.pid,subject:x.pid,emotion:-1,impact:100,interpretation:`我被${x.name}抛下了`}
            ]);
            NPCMemory.record(G,{type:'rival',time:absNow(),participants:[old.pid,rival.pid,x.pid],outcome:'remembered'},[
              {person:old.pid,subject:rival.pid,emotion:-.9,impact:95,interpretation:`${rival.name}抢走了${x.name}`}
            ]);
            addTrust(old, x, -35); addTrust(old, rival, -30); addJealousy(old, rival, 60);
            say(old, '……怎么会这样'); spawnHeart(old, '💔');
          }
        }
        if (r.l >= 70 && !loverOf(d) && !loverOf(p)) { r.lovers = true; r.secret = false; HOOK.toast(`💕 ${d.name} 和 ${p.name} 在一起了！`); }
      } else if (r.l >= 70 && !r.lovers) { r.lovers = true; HOOK.toast(`💕 ${d.name} 和 ${p.name} 在一起了！`); SFX.play('newday'); }
      else SFX.play('love');
    } else {
      bump(d, p, -2, -4); reply = pick(['诶？我们还是做朋友吧', '让我想想……', '你、你在说什么呀']);
      d.needs.fun = Math.max(0, d.needs.fun - 10);
      setTimeout(() => d.act && d.act.kind === 'flirt' && say(d, '呜……'), 2600);
    }
  }
  // 恋人看到另一半和别人亲密：抱一抱会吃醋；亲亲或地下情就是当场撞破
  if (jealousTalk) say(d, pick(['刚才那是怎么回事？', '😤 你给我解释清楚', '你是不是喜欢上别人了？']));
  const LOGK = { hug: `🤗 ${d.name} 抱了抱 ${p.name}`, kiss: `💋 ${d.name} 亲了 ${p.name}`, argue: `💢 ${d.name} 和 ${p.name} 吵了一架` };
  // 恋人之间的日常亲昵太频繁，几小时内只记一次，免得刷屏
  const routine = r.lovers && (kind === 'hug' || kind === 'kiss') && r.logAt > absNow() - 240;
  if (r.lovers && (kind === 'hug' || kind === 'kiss') && !routine) r.logAt = absNow();
  countHouseActivity('social',d.name+' × '+p.name);
  if (exchange?.log) addLog(exchange.log);
  if (kind === 'chat' && !exchange && Math.random() < .32) shareHouseNews(d, p);
  if (!routine && ['argue', 'hug', 'kiss', 'flirt', 'joke'].includes(kind)) {
    const outcome = kind === 'flirt' ? (flirtOk ? 'accepted' : 'rejected') : 'completed';
    const emotion = kind === 'joke' ? -.38 : kind === 'argue' ? -.9 : outcome === 'rejected' ? -.85 : .55;
    const impact = kind === 'argue' || kind === 'flirt' ? 90 : 45;
    const descriptions = {
      joke: [`我当着大家的面和${p.name}开了玩笑`,`${d.name}拿我开玩笑，我有点难堪`],
      argue: [`我找${p.name}理论，结果吵了起来`, `${d.name}来找我理论，我们吵了一架`],
      hug: [`我拥抱了${p.name}`, `${d.name}拥抱了我`],
      kiss: [`我亲了${p.name}`, `${d.name}亲了我`],
      flirt: [`我向${p.name}表白，${flirtOk ? '对方答应了' : '我被拒绝了'}`,
        `${d.name}向我表白，${flirtOk ? '我接受了' : '我拒绝了'}`]
    };
    const views = [
      { person: d.pid, subject: p.pid, interpretation: descriptions[kind][0], emotion:kind==='joke'?.22:emotion, impact },
      { person: p.pid, subject: d.pid, interpretation: descriptions[kind][1],
        emotion: outcome === 'rejected' ? -.35 : emotion, impact }
    ];
    if (kind === 'argue' || kind === 'joke' || kind === 'kiss') {
      for (const observer of G.dolls) {
        if (observer === d || observer === p || ['away', 'lift'].includes(observer.state) || lying(observer)) continue;
        if (Math.abs(observer.tx - d.tx) + Math.abs(observer.ty - d.ty) > 4 ||
            !canSee(observer, d) || !canSee(observer, p)) continue;
        views.push({ person: observer.pid, subject: d.pid, channel: 'witness',
          interpretation: `我看到${d.name}和${p.name}${kind==='kiss'?'亲吻':kind==='joke'?'开玩笑':'争吵'}`, emotion: kind==='kiss'?-.15:-.3, impact: 55, confidence: .8 });
      }
    }
    NPCMemory.record(G, {
      type: kind, time: absNow(), location: { x: d.x, y: d.y },
      participants: [d.pid, p.pid], outcome
    }, views);
  }
  if (LOGK[kind] && !routine) addLog(jealousTalk ? `😤 ${d.name} 吃醋，找 ${p.name} 吵了一架` : LOGK[kind]);
  if (kind === 'flirt') addLog(`💌 ${d.name} 向 ${p.name} 表白${flirtOk ? '，对方答应了' : '，被拒绝了'}`);
  if (['hug', 'kiss', 'flirt'].includes(kind) && !r.lovers && canRomance(d, p)) witness(d, p, r.secret || kind === 'kiss' ? 'caught' : 'jealous');
  if (introduced) {
    const outcome = !wereLovers && r.lovers ? 'together' : wereLovers && !r.lovers ? 'breakup' :
      kind === 'argue' ? 'argued' : kind === 'flirt' && !flirtOk ? 'rejected' : null;
    recordPaperMeeting(d, p, kind, outcome);
  }
  if (!lines) {
    const replyAct = p.act;
    setTimeout(() => p.act === replyAct && say(p, reply), 1300);
  }
  SFX.play(kind === 'argue' ? 'deny' : 'chat');
}

// 有人背着恋人和别人亲密时，看看恋人在不在附近——在的话就被撞见了
function witness(a, b, how = 'caught') {
  for (const [cheater, third] of [[a, b], [b, a]]) {
    const L = loverOf(cheater);
    if (!L || L === third || L.state === 'away' || L.state === 'lift' || lying(L)) continue;
    if (Math.abs(L.tx - cheater.tx) + Math.abs(L.ty - cheater.ty) > 6) continue;
    if (!canSee(L, cheater)) continue;              // 卧室门关着，外面的人看不见
    if (how === 'jealous') jealous(L, cheater, third); else caught(L, cheater, third);
    return;
  }
}

function jealous(L, cheater, third) {
  const r = rel(L, cheater);
  r.l = Math.max(0, r.l - 6); r.f = Math.max(-100, r.f - 3);
  const t = rel(L, third); t.f = Math.max(-100, t.f - 10);
  L.needs.fun = Math.max(0, L.needs.fun - (isF(L) ? 20 : 12) * (zodiacOf(L).el === 'water' ? 1.3 : 1));   // F 型、水象更受伤
  face(L, cheater.x, cheater.y);
  say(L, pick(['😤 哼！抱那么久干嘛', '……我吃醋了', `你和${third.name}关系很好嘛？`]), 3);
  spawnHeart(L, '😤');
  // 记下来：等这次互动结束，就去找恋人算账
  L.jealousOf = { who: cheater, until: absNow() + 240 };
  addJealousy(L, third, 30); addTrust(L, cheater, -6);
  if (L.state === 'idle' || (L.act && !L.act.onFurn && L.act.type !== 'chat')) { if (L.act) endAct(L); L.state = 'idle'; L.think = 0.5; }
  HOOK.toast(`😤 ${L.name} 看到 ${cheater.name} 和 ${third.name} 很亲密，吃醋了`);
}

function caught(L, cheater, third) {
  const r = rel(L, cheater), r3 = rel(cheater, third);
  r.f = Math.max(-100, r.f - 35); r.l = Math.max(0, r.l - 45);
  const t3 = rel(L, third); t3.f = Math.max(-100, t3.f - 40); t3.l = 0;
  r3.secret = false;
  L.needs.fun = Math.max(0, L.needs.fun - 40);
  face(L, cheater.x, cheater.y);
  say(L, pick(['💢 你们在干什么！', `${cheater.name}！你太过分了！`, '我都看见了！']), 3);
  spawnHeart(L, '💔'); spawnHeart(L, '💢');
  setTimeout(() => say(cheater, pick(['我、我可以解释！', '不是你想的那样……', '……'])), 1200);
  setTimeout(() => say(third, pick(['……', '对不起……', '我先走了'])), 2200);
  SFX.play('deny');
  if (r.l < 30 && r.lovers) {
    r.lovers = false;
    HOOK.toast(`💔 ${L.name} 撞见 ${cheater.name} 和 ${third.name}，两人分手了！`);
  } else HOOK.toast(`💢 ${L.name} 撞见 ${cheater.name} 和 ${third.name} 在一起！`);
  NPCMemory.record(G, {
    type: 'caught-affair', time: absNow(), location: { x: L.x, y: L.y },
    participants: [L.pid, cheater.pid, third.pid], outcome: r.lovers ? 'confronted' : 'separated'
  }, [
    { person: L.pid, subject: cheater.pid, channel: 'witness',
      interpretation: `我撞见${cheater.name}和${third.name}亲密`, emotion: -1, impact: 100 },
    { person: cheater.pid, subject: L.pid,
      interpretation: `${L.name}撞见了我和${third.name}`, emotion: -.9, impact: 90 },
    { person: third.pid, subject: L.pid,
      interpretation: `${L.name}撞见了我和${cheater.name}`, emotion: -.7, impact: 80 }
  ]);
  // 恋人单独记下“第三者”：这份记忆的主角是抢走恋人的人
  NPCMemory.record(G, {
    type: 'rival', time: absNow(), participants: [L.pid, third.pid, cheater.pid], outcome: 'remembered'
  }, [
    { person: L.pid, subject: third.pid, channel: 'witness',
      interpretation: `${third.name}想抢走${cheater.name}`, emotion: -.95, impact: 95 }
  ]);
  addTrust(L, cheater, -40); addTrust(L, third, -30); addJealousy(L, third, 60);
}

// 能被打断去做别的事（不在睡觉、不在聊天、不在出门路上）
const interruptible = x => x.state === 'idle' || (x.state === 'walk' && x.act && x.act.type === 'wander') ||
  (x.state === 'act' && x.act && !x.act.onFurn && !Object.hasOwn(ROUTINES, x.act.type) && x.act.type !== 'chat' && x.act.type !== 'leave' && !['visitStay', 'makeKeepsake', 'rainTea'].includes(x.act.type));

// 每帧：花心的人对恋人的感情会慢慢变淡；专一的人反而越来越深
function socialTick(dt) {
  // 保险：学生和任何人之间都不留恋爱关系
  for (const d of G.dolls) if (isStudent(d)) for (const o of G.dolls) if (o !== d) {
    const r = rel(d, o); if (r.l || r.lovers || r.secret) { r.l = 0; r.lovers = false; r.secret = false; }
  }
  // 吃醋的人：等双方都有空，就立刻去找恋人算账
  for (const d of G.dolls) {
    const j = d.jealousOf;
    if (!j) continue;
    if (j.until < absNow() || !G.dolls.includes(j.who)) { d.jealousOf = null; continue; }
    if (!interruptible(d) || !interruptible(j.who)) continue;
    if (d.act) endAct(d);
    d.state = 'idle'; d.path = [];
    startAct(d, { type: 'chat', partner: j.who, kind: 'argue', jealous: true });
  }
  for (const k in G.rel) {
    const r = G.rel[k];
    if (!r.lovers && !r.secret) continue;
    const [pa, pb] = k.split('|');
    const a = G.dolls.find(d => d.pid === pa), b = G.dolls.find(d => d.pid === pb);
    if (!a || !b) continue;
    const fickle = (a.heart === 'fickle') + (b.heart === 'fickle');
    if (r.lovers && fickle) r.l = Math.max(0, r.l - 0.05 * fickle * dt);
    if (r.lovers && !fickle && a.heart === 'loyal' && b.heart === 'loyal') r.l = Math.min(100, r.l + 0.02 * dt);
    if (r.lovers && r.l < 30) { r.lovers = false; HOOK.toast(`💔 ${a.name} 和 ${b.name} 感情淡了，分手了`); }
  }
}

// 互动进行中：偶尔再说一句、冒爱心
function tickSocial(d, dt) {
  const a = d.act, S = SOCIAL[a.kind] || SOCIAL.chat;
  if (a.passive || a.exchange || Math.random() > dt * 0.45) return;
  const who = Math.random() < 0.5 ? d : a.partner;
  const lines = who === d ? S.a : (S.b.length ? S.b : S.a);
  say(who, pick(lines), 1.8);
  if (a.kind === 'argue') spawnHeart(who, '💢');
  else if (a.kind !== 'chat' || rel(d, a.partner).l > 40) spawnHeart(who, rel(d, a.partner).lovers ? '💕' : '❤');
}

// 先躺上双人床的人会叫恋人一起来睡
function inviteLover(d, f) {
  const lv = loverOf(d);
  if (!lv || f.users.length >= 2 || lv.state === 'lift' || lying(lv)) return;
  if (!G.night && lv.needs.energy > 70) return;
  if (lv.act && (lv.act.type === 'chat' || lv.act.onFurn)) return;
  if (lv.act) endAct(lv);
  lv.path = []; lv.state = 'idle';
  if (startAct(lv, { type: 'sleep', furn: f })) {
    setTimeout(() => say(d, `${lv.name}，一起睡吧～`), 900);
    setTimeout(() => lv.act && say(lv, pick(['来啦 💕', '马上就来～', '好～'])), 2000);
  }
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
  for (const o of G.dolls) if (o !== performer && canSee(o,performer) && (o.state === 'idle' || (o.state === 'walk' && o.act && o.act.type === 'wander'))) {
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
  if (a.what === 'game') countTogether('game', d, o);
  if (a.what === 'piano') notePianoCrowd(o);
  if(a.what==='game'||a.what==='piano'){
    addTrust(o, d, 2);
    countHouseActivity(a.what==='piano'?'audience':'partners',o.name);
    NPCMemory.record(G,{type:'company',time:absNow(),participants:[o.pid,d.pid],outcome:a.what},[
      {person:o.pid,subject:d.pid,emotion:.55,impact:55,interpretation:`${d.name}来陪我${a.what==='game'?'玩游戏':'弹琴'}`},
      {person:d.pid,subject:o.pid,emotion:.55,impact:55,interpretation:`我和${o.name}一起${a.what==='game'?'玩游戏':'听钢琴'}`}
    ]);
  }
  if (a.what === 'piano' && !o.act.logged) { o.act.logged = true; addLog(`🎵 ${o.name} 弹起了钢琴，${d.name} 过来听`); }
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
