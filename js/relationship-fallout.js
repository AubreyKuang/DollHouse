// Romantic changes affect the whole triangle, with saved, time-limited tension.
// Private flirting alone does not inform an absent partner: only a witnessed
// affair or an announced change of partner reaches this module.
function activeTension(r) {
  return r?.tension && r.tension.until > absNow() ? r.tension : null;
}
function tensionBetween(a, b) {
  return a !== b && canRomance(a, b) ? activeTension(G.rel[relKey(a, b)]) : null;
}
function setRelationshipTension(a, b, kind, hurt, through) {
  const r = rel(a, b), current = activeTension(r);
  if (current?.kind === kind && current.through === (through?.pid || null)) return false;
  r.tension = { kind, hurt: hurt.pid, through: through?.pid || null,
    since: absNow(), until: absNow() + 3 * 1440, lastEncounter: -10000, encounters: 0 };
  return true;
}
function markBreakup(a, b, hurt = a) {
  const r = rel(a, b);
  r.lovers = false; r.secret = false; r.ex = true;
  setRelationshipTension(a, b, 'ex', hurt);
}
function recordRivalFallout(hurt, cheater, other, witnessed = false) {
  if (!canRomance(hurt, other) || !setRelationshipTension(hurt, other, 'rival', hurt, cheater)) return false;
  const r = rel(hurt, other), wereFriends = r.f >= 40;
  r.f = Math.max(-100, r.f - (wereFriends ? 45 : 35));
  r.l = 0;
  addTrust(hurt, other, wereFriends ? -40 : -30);
  addTrust(other, hurt, -12);
  addJealousy(hurt, other, 60);
  hurt.needs.fun = Math.max(0, hurt.needs.fun - 25);
  other.needs.fun = Math.max(0, other.needs.fun - 10);
  NPCMemory.record(G, { type: 'rival', time: absNow(),
    participants: [hurt.pid, other.pid, cheater.pid], outcome: witnessed ? 'witnessed' : 'announced' }, [
    { person: hurt.pid, subject: other.pid, channel: witnessed ? 'witness' : 'told',
      emotion: -.95, impact: 95, interpretation: witnessed
        ? `我撞见${other.name}和${cheater.name}亲密，再碰面会很难受`
        : `${cheater.name}告诉我选择了${other.name}，我还不知道该怎么面对他们` },
    { person: other.pid, subject: hurt.pid, emotion: -.6, impact: 85,
      interpretation: `因为${cheater.name}的事，我和${hurt.name}见面很尴尬` },
  ]);
  addLog(`💔 因为 ${cheater.name} 的感情变故，${hurt.name} 和 ${other.name}${wereFriends ? '原本的友情也受了伤' : '之间有了心结'}`);
  return true;
}
function announceChangedHeart(cheater, hurt, other) {
  const old = rel(cheater, hurt);
  markBreakup(cheater, hurt, hurt);
  old.l = Math.max(0, old.l - 40); old.f = Math.max(-100, old.f - 25);
  addTrust(hurt, cheater, -40);
  recordRivalFallout(hurt, cheater, other);
  NPCMemory.record(G, { type: 'breakup', time: absNow(), participants: [cheater.pid, hurt.pid], outcome: 'left' }, [
    { person: hurt.pid, subject: cheater.pid, channel: 'told', emotion: -1, impact: 100,
      interpretation: `${cheater.name}告诉我喜欢上了${other.name}，我们分手了` },
    { person: cheater.pid, subject: hurt.pid, emotion: -.6, impact: 85,
      interpretation: `我选择了${other.name}，伤害了${hurt.name}` },
  ]);
  HOOK.toast(`💔 ${cheater.name} 变心了，和 ${hurt.name} 分手`);
  addLog(`💔 ${cheater.name} 告诉 ${hurt.name} 自己喜欢上了 ${other.name}，两人分手了`);
  if (!['away', 'lift'].includes(hurt.state) && !lying(hurt)) {
    say(hurt, '……让我一个人静一静。', 3); spawnHeart(hurt, '💔');
  }
}
function tensionLines(a, b, confront = false) {
  const tension = tensionBetween(a, b);
  if (!tension) return null;
  const through = G.dolls.find(d => d.pid === tension.through)?.name || '那件事';
  const hurtFirst = a.pid === tension.hurt;
  if (tension.kind === 'rival') {
    if (confront) return hurtFirst
      ? [`关于${through}的事，我还没办法当作没发生。`, '我知道，现在说什么都很难。', '那就先给彼此一点空间吧。']
      : ['我知道我们现在见面很尴尬。', `关于${through}的事，我还需要时间。`, '好，我先不打扰你。'];
    return hurtFirst ? ['……你也在这里。', '嗯，我拿完东西就走。', '我想先安静一会儿。']
      : ['……我可以从这边过去吗？', '嗯。让我先静一静吧。', '好，我先走了。'];
  }
  return hurtFirst ? ['分开以后，我还不知道怎么面对你。', '我知道，我会给你空间。', '嗯，先这样吧。']
    : ['我们……还好吗？', '我还没准备好像以前那样聊天。', '好，我先不打扰你。'];
}
function startTenseExchange(a, b) {
  const tension = tensionBetween(a, b);
  const first = tension.encounters === 0;
  const hurt = a.pid === tension.hurt ? a : b;
  const confront = first && ['genki', 'social', 'active'].includes(hurt.persona);
  const kind = confront ? 'confront' : 'awkward';
  a.state = b.state = 'act'; a.path = []; b.path = [];
  a.act = { type: 'chat', kind, partner: b, t: 5.4, gain: { social: 3 }, tension: true };
  b.act = { type: 'chat', kind, partner: a, t: 5.4, gain: { social: 3 }, tension: true, passive: true };
  face(a, b.x, b.y); face(b, a.x, a.y);
  a.happy = b.happy = 0;
  tension.lastEncounter = absNow(); tension.encounters++;
  if (first) { a.needs.fun = Math.max(0, a.needs.fun - 3); b.needs.fun = Math.max(0, b.needs.fun - 3); }
  startHouseExchange(a, b, tensionLines(a, b, confront));
  spawnHeart(hurt, confront ? '💢' : '…');
  if (first) addLog(`😶 ${a.name} 和 ${b.name} 碰面时${confront ? '谈起了那段感情，决定先给彼此空间' : '有些尴尬，打过照面便各自走开'}`);
}
function tickRelationshipTension() {
  for (const [key, r] of Object.entries(G.rel)) {
    const tension = activeTension(r);
    if (!tension || tension.lastEncounter > absNow() - 900) continue;
    const pair = key.split('|').map(pid => G.dolls.find(d => d.pid === pid));
    if (pair.some(d => !d || !availableForHouseChat(d))) continue;
    const [a, b] = pair;
    if (!canRomance(a, b) || !canSee(a, b) || Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty) > 3) continue;
    const hurt = a.pid === tension.hurt ? a : b, other = hurt === a ? b : a;
    if (startAct(hurt, { type: 'chat', partner: other, kind: 'awkward' })) {
      tension.lastEncounter = absNow();
      break;
    }
  }
}
function stepAwayAfterTension(d, other) {
  const goals = [];
  for (let x = Math.max(0, d.tx - 5); x <= Math.min(COLS - 1, d.tx + 5); x++) {
    for (let y = d.ty - 3; y <= d.ty + 3; y++) {
      if (roomOf({ tx: x, ty: y }) !== roomOf(d) || !free(x, y) || isDoorTile(x, y)) continue;
      if (Math.abs(x - other.tx) + Math.abs(y - other.ty) < 4 || G.dolls.some(o => o !== d && o.tx === x && o.ty === y)) continue;
      goals.push({ x, y });
    }
  }
  const path = findPath(d.tx, d.ty, goals);
  if (path?.length) { d.state = 'walk'; d.path = path; d.act = { type: 'wander' }; }
  else { d.think = 6; d.dir = d.x < other.x ? 'left' : 'right'; }
}
