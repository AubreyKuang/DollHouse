// A picnic keeps its host and guest when the weather changes its plans.
const PICNIC_PLANS = {
  inside: '搬进客厅',
  postpone: '改天再野餐',
  umbrella: '撑伞继续',
};
const PICNIC_WINDOWS = {
  morning: { label: '上午开场', start: 10 * 60, end: 14 * 60 },
  afternoon: { label: '下午开场', start: 15 * 60, end: 19 * 60 },
};

function preparePicnic(event, rescheduled) {
  if (!rescheduled && G.weather !== 'rain' && seasonOf(G.day).id !== 'winter' && Math.random() < .28) {
    event.showerAt = absNow() + 65;
  }
}

function tickPicnicWeather(event) {
  if (event.kind !== 'picnic' || event.rainMode) return false;
  const now = absNow();
  if (!event.rainDeadline && (G.weather === 'rain' || (event.showerAt && now >= event.showerAt))) {
    event.rainDeadline = now + 72;
    event.endsAt = Math.max(event.endsAt, event.rainDeadline + 25);
    HOOK.toast('🌧 院子野餐遇上下雨了，主人要改计划。');
    HOOK.community();
    save();
  }
  if (!event.rainDeadline) return false;
  if (now >= event.rainDeadline) {
    const host = communityDoll(event.hostPid);
    const plan = ['genki', 'active'].includes(host?.persona) ? 'umbrella' :
      ['tidy', 'lazy'].includes(host?.persona) ? 'postpone' : 'inside';
    if (!choosePicnicPlan(plan) && !choosePicnicPlan('postpone')) choosePicnicPlan('umbrella');
  }
  return true;
}

function picnicQuietPair(event, host, guest) {
  const quiet = d => !isE(d) || ['nerd', 'lazy'].includes(d.persona);
  if (!quiet(guest)) return;
  const resident = availableHosts().filter(d => d !== host && quiet(d))
    .sort((a, b) => Number(b.persona === 'nerd') - Number(a.persona === 'nerd'))[0];
  if (!resident) return;
  const tiles = [];
  for (let y = FLOOR_SPLIT; y < ROWS; y++) for (let x = BX; x < COLS; x++) {
    if (free(x, y) && !isDoorTile(x, y) && !(x === stairsColumn() && y === UPPER_LANDING)) tiles.push({ x, y });
  }
  const corner = tiles.find(tile => tiles.some(other => other.y === tile.y && other.x === tile.x + 1) &&
    [resident, guest].every(d => findPath(d.tx, d.ty, [tile, { x: tile.x + 1, y: tile.y }])));
  if (!corner) return;
  event.quietPids = [resident.pid, guest.pid];
  event.quietTiles = [corner, { x: corner.x + 1, y: corner.y }];
}

function choosePicnicPlan(plan, window) {
  const event = G.community.active;
  if (!event?.rainDeadline || !Object.hasOwn(PICNIC_PLANS, plan)) return false;
  if (plan === 'postpone' && G.community.deferredPicnic) return false;
  const host = communityDoll(event.hostPid), guest = communityDoll(event.guestPid);
  if (!host || !guest) return false;
  if (plan === 'inside') {
    const tiles = gatheringTiles('picnic', { x: guest.tx, y: guest.ty }, true);
    if (tiles.length < 2 || !findPath(host.tx, host.ty, tiles)) return false;
    event.tiles = tiles;
    picnicQuietPair(event, host, guest);
  }
  event.rainMode = plan;
  delete event.rainDeadline;
  const result = {
    inside: '把野餐搬进了客厅，点心还是一样好吃。',
    postpone: '收起野餐篮，约好等雨停了再聚。',
    umbrella: '给大家分了伞，决定在雨里继续野餐。',
  };
  HOOK.toast(`🧺 ${host.name}${result[plan]}`);
  if (plan === 'postpone') {
    event.postponed = true;
    G.community.deferredPicnic = { hostPid: host.pid, guestPid: guest.pid, at: absNow() + 95,
      ...(Object.hasOwn(PICNIC_WINDOWS, window) ? { window } : {}) };
    endGetTogether();
    return true;
  }
  event.endsAt = Math.max(event.endsAt, absNow() + 140);
  G.community.nextEventAt = event.endsAt + 45;
  event.credited ||= [...event.joined];
  for (const d of G.dolls) if (['visitGather', 'visitStay'].includes(d.act?.type)) endAct(d);
  event.joined = [];
  event.reserved = {};
  HOOK.community();
  save();
  return true;
}

function resumePicnic() {
  const pending = G.community.deferredPicnic;
  if (!pending) return false;
  const host = communityDoll(pending.hostPid);
  const friend = G.community.friends.find(f => f.pid === pending.guestPid);
  if (!host || !friend || communityDoll(friend.pid)) { G.community.deferredPicnic = null; return false; }
  if (absNow() < pending.at || absNow() < G.community.nextEventAt || G.time < 10 * 60 || G.time >= 19 * 60 ||
      G.weather === 'rain' || G.weather === 'snow') return false;
  const window = Object.hasOwn(PICNIC_WINDOWS, pending.window) && PICNIC_WINDOWS[pending.window];
  if (window) {
    const duration = GET_TOGETHERS.picnic.minutes, departure = leaveAbs(host);
    if (G.time < window.start || G.time + duration > window.end ||
        (departure != null && departure < absNow() + duration)) return false;
  }
  if (!startGetTogether(host, 'picnic', { friend, rescheduled: true })) return false;
  G.community.deferredPicnic = null;
  addLog(`🧺 雨停了，${host.name}和${friend.name}的野餐重新开场。`);
  HOOK.community();
  save();
  return true;
}

function arrivePicnic(d, event) {
  if (!event.quietPids?.includes(d.pid)) {
    d.act.theme = event.rainMode === 'umbrella' ? 'umbrella' : 'picnic';
    say(d, event.rainMode === 'umbrella' ? '把伞靠过来一点，点心别淋湿了。' : '来吃点三明治吧！');
    return;
  }
  d.act.theme = 'quiet';
  d.act.gain = { fun: 12, social: 14 };
  say(d, '楼上安静多了。');
  const other = communityDoll(event.quietPids.find(pid => pid !== d.pid));
  if (event.quietDone || other?.act?.theme !== 'quiet' || other.state !== 'act') return;
  event.quietDone = true;
  noteRainTradition(d, other);
  bump(d, other, 10);
  addTrust(d, other, 5); addTrust(other, d, 5);
  const text = `${d.name}和${other.name}躲到二楼，在安静的书房聊熟了。`;
  NPCMemory.record(G, { type: 'rain-quiet-chat', time: absNow(), participants: [d.pid, other.pid], outcome: 'bonded' },
    [d, other].map(p => ({ person: p.pid, subject: p === d ? other.pid : d.pid, emotion: .65, impact: 65, interpretation: text })));
  addLog(`🌧 ${text}`);
  say(other, '原来你也喜欢安静一点。');
}
