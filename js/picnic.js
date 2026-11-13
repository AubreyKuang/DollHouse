// A picnic keeps its host and guest when the weather changes its plans.
const PICNIC_PLANS = {
  inside: '搬进客厅',
  study: '和访客去书房',
  postpone: '改天再野餐',
  umbrella: '撑伞继续',
};
const PICNIC_WINDOWS = {
  morning: { label: '上午开场', start: 10 * 60, end: 14 * 60 },
  afternoon: { label: '下午开场', start: 15 * 60, end: 19 * 60 },
};
const PICNIC_WINDOW_LABELS = { morning: '上午', afternoon: '下午', flexible: '第一个可用时段' };
const PICNIC_SHORT_MINUTES = 75;
const picnicDuration = pending => pending.shortTea ? PICNIC_SHORT_MINUTES : GET_TOGETHERS.picnic.minutes;
const PICNIC_PREFERENCE_TRUST = 4;
const PICNIC_GUEST_WISHES = {
  inside: '想进客厅，和大家一起吃点心。',
  study: '想找个安静的地方，和主人聊一会儿。',
  umbrella: '想撑伞留在院子里，听一会儿雨。',
};

function picnicGuestPreference(guest) {
  if (['genki', 'active'].includes(guest.persona)) return 'umbrella';
  if (!isE(guest) || ['nerd', 'lazy'].includes(guest.persona)) return 'study';
  return 'inside';
}

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
  const seats = picnicStudySeats(resident, guest);
  if (!seats) return;
  event.quietPids = [resident.pid, guest.pid];
  event.quietTiles = seats;
}

function picnicStudySeats(resident, guest) {
  if (![resident, guest].every(d => readyForKeepsake(d) && d.needs.energy >= 34 && d.needs.hunger >= 25) ||
      tensionBetween(resident, guest)) return;
  const leave = leaveAbs(resident);
  if (leave != null && leave < absNow() + 140) return;
  const tiles = [];
  for (let y = FLOOR_SPLIT; y < ROWS; y++) for (let x = BX; x < COLS; x++) {
    if (free(x, y) && !isDoorTile(x, y) && !(x === stairsColumn() && y === UPPER_LANDING)) tiles.push({ x, y });
  }
  for (const tile of tiles) {
    if (!tiles.some(other => other.y === tile.y && other.x === tile.x + 1)) continue;
    const seats = [tile, { x: tile.x + 1, y: tile.y }];
    const routes = pairRoutes(resident, guest, seats);
    if (routes) return routes.map((path,i) => {
      const person = i === 0 ? resident : guest;
      return path.at(-1) || { x: person.tx, y: person.ty };
    });
  }
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
  if (plan === 'study') {
    const seats = picnicStudySeats(host, guest);
    if (!seats) return false;
    event.quietPids = [host.pid, guest.pid];
    event.quietTiles = seats;
  }
  event.rainMode = plan;
  event.guestWishMatched = picnicGuestPreference(guest) === plan;
  delete event.rainDeadline;
  const result = {
    inside: '把野餐搬进了客厅，点心还是一样好吃。',
    study: '请访客一起上楼，在书房听雨。',
    postpone: '收起野餐篮，约好等雨停了再聚。',
    umbrella: '给大家分了伞，决定在雨里继续野餐。',
  };
  HOOK.toast(`🧺 ${host.name}${result[plan]}`);
  if (plan === 'postpone') {
    event.postponed = true;
    G.community.deferredPicnic = { hostPid: host.pid, guestPid: guest.pid, at: absNow() + 95,
      ...(Object.hasOwn(PICNIC_WINDOW_LABELS, window) ? { window } : {}) };
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

function changePicnicWindow(window) {
  const pending = G.community.deferredPicnic;
  if (!pending || !Object.hasOwn(PICNIC_WINDOW_LABELS, window) || pending.window === window) return false;
  const previous = pending.window;
  pending.window = window;
  if (!save()) {
    pending.window = previous;
    return false;
  }
  HOOK.community();
  return true;
}

function changePicnicBackup(pid) {
  const pending = G.community.deferredPicnic;
  if (!pending || (pid && (pid === pending.hostPid || !residents().some(d => d.pid === pid)))) return false;
  const previous = pending.backupPid;
  if (pid) pending.backupPid = pid;
  else delete pending.backupPid;
  if (!save()) {
    if (previous) pending.backupPid = previous;
    else delete pending.backupPid;
    return false;
  }
  HOOK.community();
  return true;
}

function changePicnicFormat(shortTea) {
  const pending = G.community.deferredPicnic;
  if (!pending || !!pending.shortTea === shortTea) return false;
  const previous = pending.shortTea;
  pending.shortTea = shortTea;
  if (!save()) {
    pending.shortTea = previous;
    return false;
  }
  HOOK.community();
  return true;
}

function picnicHostReady(pending, host) {
  if (!host || !availableHosts().includes(host) || host.act?.type === 'leave') return false;
  const checkShift = pending.shortTea || pending.backupPid || Object.hasOwn(PICNIC_WINDOW_LABELS, pending.window);
  const departure = checkShift ? leaveAbs(host) : null;
  return departure == null || departure >= absNow() + picnicDuration(pending);
}

function picnicBackup(pending) {
  return residents().find(d => d.pid === pending.backupPid && d.pid !== pending.hostPid);
}

function picnicWaitReason(pending, host) {
  const now = absNow();
  if (G.community.active || G.community.outing || now < Math.max(pending.at, G.community.nextEventAt)) return '等上场聚会散场和准备时间结束';
  if (!pending.shortTea && (G.weather === 'rain' || G.weather === 'snow')) return '等雨雪停';
  const duration = picnicDuration(pending);
  const windows = pending.window === 'flexible' ? Object.values(PICNIC_WINDOWS)
    : Object.hasOwn(PICNIC_WINDOWS, pending.window) ? [PICNIC_WINDOWS[pending.window]] : [];
  if (windows.length ? !windows.some(slot => G.time >= slot.start && G.time + duration <= slot.end)
    : G.time < 10 * 60 || (pending.shortTea ? G.time + duration > 19 * 60 : G.time >= 19 * 60)) return '等可开场的时间';
  const backup = picnicBackup(pending);
  if (!picnicHostReady(pending, host) && !picnicHostReady(pending, backup)) {
    return backup ? `等${host.name}或${backup.name}有空` : `等${host.name}有空`;
  }
  return '';
}

function resumePicnic() {
  const pending = G.community.deferredPicnic;
  if (!pending) return false;
  const host = communityDoll(pending.hostPid);
  const friend = G.community.friends.find(f => f.pid === pending.guestPid);
  if (!host || !friend || communityDoll(friend.pid)) { G.community.deferredPicnic = null; return false; }
  if (picnicWaitReason(pending, host)) return false;
  const selectedHost = picnicHostReady(pending, host) ? host : picnicBackup(pending);
  G.community.deferredPicnic = null;
  if (!startGetTogether(selectedHost, pending.shortTea ? 'tea' : 'picnic', {
    friend, rescheduled: true, shortTea: !!pending.shortTea,
  })) {
    G.community.deferredPicnic = pending;
    return false;
  }
  addLog(pending.shortTea
    ? `🫖 ${selectedHost.name}和${friend.name}把改期的野餐换成了室内短茶会。`
    : selectedHost === host
    ? `🧺 雨停了，${host.name}和${friend.name}的野餐重新开场。`
    : `🧺 野餐重新开场，${selectedHost.name}替${host.name}接待${friend.name}。`);
  HOOK.community();
  save();
  return true;
}

function creditPicnicGuestWish(d, event, host, guest) {
  if (!event.guestWishMatched || event.guestWishDone || !host || !guest || (d !== host && d !== guest)) return;
  if (![host, guest].every(person => person.state === 'act' && person.act?.type === 'visitStay')) return;
  event.guestWishDone = true;
  addTrust(guest, host, PICNIC_PREFERENCE_TRUST);
  addLog(`🌧 ${guest.name}喜欢${host.name}给这场雨天野餐做的安排。`);
  save();
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
