// 信任、醋意、饭搭子 / 游戏搭子、“爱美”特质、卧室隐私和会传错的谣言。
// 友好度和恋爱度是两人共享的；信任和醋意是单向的：团子可以信任阿懒，阿懒却未必信任团子。

const BOND_TAGS = { meal: { icon: '🍚', name: '饭搭子' }, game: { icon: '🎮', name: '游戏搭子' } };
const BOND_TAG_AT = 3;                 // 一起吃饭 / 打游戏满 3 次就成了搭子
const PRIVATE_ROOMS = new Set(['bed', 'upperBedroom']);
const clampBond = (v, min, max) => Math.max(min, Math.min(max, v));
const bondKey = (a, b) => a.pid + '>' + b.pid;

function trustOf(a, b) { return (G.trust || {})[bondKey(a, b)] || 0; }
function addTrust(a, b, delta) {
  if (!a || !b || a === b || !delta) return;
  G.trust ||= {};
  const k = bondKey(a, b);
  G.trust[k] = Math.round(clampBond((G.trust[k] || 0) + delta, -100, 100) * 10) / 10;
}
function jealousyOf(a, b) { return (G.jealousy || {})[bondKey(a, b)] || 0; }
function addJealousy(a, b, delta) {
  if (!a || !b || a === b) return;
  G.jealousy ||= {};
  const k = bondKey(a, b);
  G.jealousy[k] = clampBond((G.jealousy[k] || 0) + delta, 0, 100);
  if (G.jealousy[k] < 1) delete G.jealousy[k];
}
// 醋意会慢慢消下去，大约一天降 40 点
function bondsTick(dt) {
  if (!G.jealousy) return;
  for (const k of Object.keys(G.jealousy)) {
    G.jealousy[k] -= dt * 0.11;
    if (G.jealousy[k] <= 0) delete G.jealousy[k];
  }
}
function trustWord(v) {
  if (v >= 40) return '很信任';
  if (v >= 10) return '信任';
  if (v <= -40) return '很提防';
  if (v <= -10) return '不太信任';
  return '';
}

/* ---------- 搭子：一起吃饭、一起打游戏会慢慢变成习惯 ---------- */
function countTogether(kind, a, b) {
  if (!a || !b || a === b || a.guest || b.guest) return;
  G.habits ||= {};
  const store = G.habits[kind] ||= {};
  const k = relKey(a, b);
  store[k] = (store[k] || 0) + 1;
  const r = rel(a, b);
  r.tags ||= {};
  if (store[k] < BOND_TAG_AT || r.tags[kind]) return;
  r.tags[kind] = true;
  const { icon, name } = BOND_TAGS[kind];
  HOOK.toast(`${icon} ${a.name} 和 ${b.name} 成了${name}`);
  addLog(`${icon} ${a.name} 和 ${b.name} 成了${name}`);
  addTrust(a, b, 6); addTrust(b, a, 6);
  NPCMemory.record(G, { type: 'habit-' + kind, time: absNow(), participants: [a.pid, b.pid], outcome: kind }, [
    { person: a.pid, subject: b.pid, emotion: .5, impact: 70, interpretation: `我和${b.name}成了${name}` },
    { person: b.pid, subject: a.pid, emotion: .5, impact: 70, interpretation: `我和${a.name}成了${name}` }
  ]);
}
const bondTagged = (a, b, kind) => !!G.rel[relKey(a, b)]?.tags?.[kind];
function bondTagsText(r) {
  return Object.keys(r.tags || {}).filter(k => BOND_TAGS[k]).map(k => BOND_TAGS[k].icon + ' ' + BOND_TAGS[k].name).join(' · ');
}
// 一顿饭只记一次：同桌的人两两算一次
function noteSharedMeal(d, table) {
  const mates = table.users.filter(o => o !== d && o.state === 'act' && o.act?.type === 'meal');
  for (const o of mates) countTogether('meal', d, o);
  if (mates.length >= 2) {
    G.daily.groupMeal = (G.daily.groupMeal || 0) + 1;
    if (!table.groupLogAt || table.groupLogAt < absNow() - 300) {
      table.groupLogAt = absNow();
      addLog(`🍽 ${[d, ...mates].map(o => o.name).join('、')} 围着大餐桌一起吃饭`);
    }
  }
}
// 有搭子正在用这件家具时，更想凑过去
function companionBonus(d, f, use) {
  const kind = use === 'meal' ? 'meal' : use === 'game' ? 'game' : null;
  if (!kind) return 0;
  return f.users.some(o => o !== d && bondTagged(d, o, kind)) ? 22 : 0;
}

/* ---------- 爱美：镜子前停留更久，照完心情更好 ---------- */
function isVain(d) {
  if (typeof d.vain === 'boolean') return d.vain;
  let h = 0;
  for (const c of String(d.pid)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  d.vain = ['romantic', 'social'].includes(d.persona) ? h % 10 < 6 : h % 10 < 2;
  return d.vain;
}
function groomBonus(d) {
  if (isVain(d)) return 30;
  return ['romantic', 'social', 'genki'].includes(d.persona) ? 8 : 0;
}
function afterGroom(d) {
  if (!isVain(d)) return;
  d.needs.fun = Math.min(100, d.needs.fun + 10);
  if (Math.random() < 0.5) setTimeout(() => d.act && say(d, pick(['今天也很好看✨', '发型完美！', '再照一下下'])), 1600);
}

/* ---------- 卧室隐私：关起门来，别人不会进来打扰 ---------- */
const inPrivateRoom = d => d.state !== 'away' && PRIVATE_ROOMS.has(roomOf(d));
function inPrivateRoomTile(f) {
  if (f.y >= FLOOR_SPLIT) return f.x < BX && !(G.bathroom && f.x < BATH_X);
  return f.x < BX;
}
const canDisturb = (d, o) => !inPrivateRoom(o) || roomOf(d) === roomOf(o) || arePartners(d, o);

/* ---------- 钢琴围观：记下本月围得最多的一次 ---------- */
function notePianoCrowd(performer) {
  const act = performer.act;
  if (!act) return;
  act.crowd = (act.crowd || 0) + 1;
  const best = G.daily.crowdMax;
  if (!best || act.crowd > best.count) G.daily.crowdMax = { name: performer.name, count: act.crowd };
}

/* ---------- 谣言：转述时可能听岔，冤枉到另一个人头上 ---------- */
const MISHEARD = ['在背后说别人坏话', '偷偷和别人约会', '把大家的点心吃光了', '故意不理人'];
function misheardRumor(speaker, listener, source) {
  const pool = G.dolls.filter(o => ![speaker, listener].includes(o) && o.pid !== source.subject && !o.guest && o.state !== 'away');
  const wrong = pool.length ? pick(pool) : G.dolls.find(o => o.pid === source.subject);
  if (!wrong) return null;
  const claim = `${wrong.name}${pick(MISHEARD)}`;
  addTrust(listener, wrong, -6);
  G.daily.rumorWrong = (G.daily.rumorWrong || 0) + 1;
  G.daily.rumor = (G.daily.rumor || 0) + 1;
  return { subject: wrong.pid, interpretation: `听${speaker.name}说，${claim}`, claim, wrong };
}
function heardRumor(listener, subjectPid, emotion) {
  const subject = G.dolls.find(o => o.pid === subjectPid);
  if (subject) addTrust(listener, subject, emotion * 6);
  G.daily.rumor = (G.daily.rumor || 0) + 1;
}

/* ---------- 月报：头条、新发现、围观、信任变化、传闻 ---------- */
const DISCOVERY_VERBS = { study: '使用书桌', read: '看书', groom: '照镜子', piano: '弹钢琴', game: '打游戏', cook: '下厨', paint: '画画',
  exercise: '健身', pc: '用电脑', meal: '坐到大餐桌前吃饭', chess: '下棋', tv: '看电视', water: '浇花', cat: '撸猫' };
function trustSnapshot() { return { ...(G.trust || {}) }; }
function housePaperExtras(lines) {
  const extra = [];
  const monthLog = G.log.filter(e => e.d === G.day);
  // 头条：先看本月最戏剧化的一件事
  const dramatic = [/撞见/, /变心/, /分手/, /在一起/, /闹翻/, /表白/, /搭子/, /派对/, /一起吃饭/];
  let headline = null;
  for (const pattern of dramatic) {
    const hit = monthLog.findLast(e => pattern.test(e.text));
    if (hit) { headline = hit.text.replace(/^\S+\s/, ''); break; }
  }
  const topSocial = Object.entries(G.daily.social || {}).sort((a, b) => b[1] - a[1])[0];
  if (!headline && topSocial) headline = `${topSocial[0].replace(' × ', ' 和 ')} 本月聊了 ${topSocial[1]} 次`;
  if (!headline && G.daily.crowdMax) headline = `${G.daily.crowdMax.name} 的琴声把大家都吸引过来了`;
  if (headline) extra.push(['头条', headline, 'top']);
  // 新发现：上个月几乎不碰、这个月频繁使用的家具
  let found = null;
  for (const [kind, verb] of Object.entries(DISCOVERY_VERBS)) {
    for (const [name, count] of Object.entries(G.daily[kind] || {})) {
      const before = G.lastDaily?.[kind]?.[name] || 0;
      if (count >= 3 && before <= 1 && (!found || count > found.count)) found = { name, verb, count };
    }
  }
  if (found) extra.push(['新发现', `${found.name} 开始频繁${found.verb}（本月 ${found.count} 次）。`]);
  if (G.daily.crowdMax?.count >= 2) extra.push(['小屋趣闻', `${G.daily.crowdMax.name} 弹钢琴时，${G.daily.crowdMax.count} 位住户围了过来。`]);
  if (G.daily.groupMeal) extra.push(['集体用餐', `大餐桌旁本月凑齐了 ${G.daily.groupMeal} 次三人以上的饭局。`]);
  // 信任变化：单向的，选变化最大的一条
  let change = null;
  const before = G.dayTrust || {};
  for (const [k, v] of Object.entries(G.trust || {})) {
    const delta = v - (before[k] || 0);
    if (Math.abs(delta) >= 8 && (!change || Math.abs(delta) > Math.abs(change.delta))) change = { k, delta };
  }
  if (change) {
    const [from, to] = change.k.split('>').map(pid => G.dolls.find(o => o.pid === pid)?.name);
    if (from && to) extra.push(['关系变化', `${from} 对 ${to} 的信任${change.delta > 0 ? '上升' : '下降'}了。`]);
  }
  if (G.daily.rumor) extra.push(['传闻', `本月屋里传了 ${G.daily.rumor} 条闲话${G.daily.rumorWrong ? `，其中 ${G.daily.rumorWrong} 条传岔了` : ''}。`]);
  G.dayTrust = trustSnapshot();
  G.lastDaily = JSON.parse(JSON.stringify(G.daily));
  const top = extra.filter(([, , pos]) => pos === 'top').map(([label, text]) => `${label}　${text}`);
  const rest = extra.filter(([, , pos]) => pos !== 'top').map(([label, text]) => `${label}　${text}`);
  lines.splice(1, 0, ...top);
  lines.push(...rest);
}
