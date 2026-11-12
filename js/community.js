// Visiting friends keep their identity, relationships and housing application.
const residents = () => G.dolls.filter(d => !d.guest);
const residentLimit = () => LEVELS[G.level].cap;
const communityDoll = pid => G.dolls.find(d => d.pid === pid);

const GET_TOGETHERS = {
  visit: { name: '朋友来访', minutes: 120, icon: '☕', places: ['teaTray', 'sofa', 'table'] },
  tea: { name: '茶点派对', minutes: 175, icon: '🫖', places: ['teaTray', 'table', 'coffee', 'sofa'] },
  music: { name: '音乐派对', minutes: 175, icon: '🎵', places: ['recordPlayer', 'speaker', 'piano', 'ukulele'] },
  games: { name: '游戏派对', minutes: 175, icon: '🎲', places: ['chessTable', 'arcade', 'table'] },
};

Object.assign(ACT_NAMES, { visitGather: '去见朋友', visitStay: '和朋友相聚', visitLeave: '准备回家' });
ACT_LINES.visitStay = ['好久没这么热闹了', '有空再一起玩吧'];

function restoreCommunity(saved) {
  return {
    friends: saved?.friends || [],
    applications: saved?.applications || [],
    active: saved?.active || null,
    lastRoll: saved?.lastRoll || 0,
    nextEventAt: saved?.nextEventAt || 0,
  };
}

function newcomerProfile() {
  const used = new Set([...G.dolls, ...G.community.friends].map(d => d.name));
  const name = NAMES.find(n => !used.has(n)) || `新朋友${G.uid}`;
  return { name, persona: pick(Object.keys(PERSONAS)), job: pick(Object.keys(JOBS)), zodiac: randomZodiac(),
    mbti: randomMbti(), heart: pick(['loyal', 'normal', 'normal', 'fickle']), look: randomLook(),
    gender: Math.random() < .5 ? 'f' : 'm' };
}

function availableHosts() {
  return residents().filter(d => d.state !== 'away' && d.state !== 'lift' && !lying(d));
}

function friendFor(host) {
  let friend = G.community.friends.find(f => f.hostPid === host.pid && !communityDoll(f.pid));
  if (friend) return friend;
  friend = { ...newcomerProfile(), pid: `friend-${host.pid}-${G.uid++}-${absNow() | 0}`, hostPid: host.pid, visits: 0 };
  G.community.friends.push(friend);
  return friend;
}

function gatheringTiles(kind, origin) {
  const style = GET_TOGETHERS[kind];
  const furniture = style.places.map(id => G.furniture.find(f => f.id === id && roomOf({ tx: f.x, ty: f.y }) === 'living')).find(Boolean);
  const anchor = furniture ? { x: furniture.x, y: furniture.y + 1 } : { x: BX + 2, y: WALL_ROWS + 3 };
  const tiles = [];
  for (let y = WALL_ROWS + 1; y < FLOOR_SPLIT; y++) for (let x = BX; x < COLS; x++) {
    if (!free(x, y) || isDoorTile(x, y) || (x === stairsColumn() && y === LOWER_LANDING)) continue;
    tiles.push({ x, y, distance: Math.abs(x - anchor.x) + Math.abs(y - anchor.y) - (y - anchor.y) * 1.5 });
  }
  return tiles.sort((a, b) => a.distance - b.distance).slice(0, 22).filter(tile => findPath(origin.x, origin.y, [tile])).slice(0, 8);
}

function startGetTogether(host, kind) {
  const style = GET_TOGETHERS[kind], community = G.community;
  if (!style || !availableHosts().includes(host) || community.active || absNow() < community.nextEventAt) return false;
  const door = doorTile();
  const entry = free(door.x, door.y) ? door : nearestFree(door.x, door.y, 1);
  if (!entry) return false;
  const tiles = gatheringTiles(kind, entry);
  if (tiles.length < 2 || !findPath(host.tx, host.ty, tiles)) return false;

  const friend = friendFor(host);
  const guest = addDoll({ ...friend, guest: true, tx: entry.x, ty: entry.y,
    needs: { energy: 84, hunger: 80, fun: 74, social: 63, bladder: 90 } });
  const friendship = rel(host, guest);
  if (!friend.visits) friendship.f = 52;
  friend.visits++;
  community.active = { kind, hostPid: host.pid, guestPid: guest.pid, endsAt: absNow() + style.minutes,
    friendshipAtStart: friendship.f, tiles, joined: [], reserved: {} };
  community.nextEventAt = community.active.endsAt + 45;
  guest.think = .5;
  const entrance = doorOf();
  if (entrance) entrance.openT = .8;
  say(guest, '我来串门啦！');
  countHouseActivity('visitors', `${guest.name} · ${style.name}`);
  HOOK.toast(`${style.icon} ${host.name} 邀请 ${guest.name} 来${kind === 'visit' ? '玩' : '参加' + style.name}了`);
  HOOK.select();
  save();
  return true;
}

function joinGetTogether(d) {
  const event = G.community.active;
  if (!event || event.leavingAt || event.joined.includes(d.pid) || d.needs.energy < 34 || d.needs.hunger < 25
    || (d.needs.bladder < 18 && G.furniture.some(f => f.id === 'toilet'))) return false;
  const principal = d.pid === event.hostPid || d.pid === event.guestPid;
  const participants = new Set([...event.joined, ...Object.keys(event.reserved)]);
  const otherCount = [...participants].filter(pid => pid !== event.hostPid && pid !== event.guestPid).length;
  if (!principal && (event.kind === 'visit' || otherCount >= 3
    || (!isE(d) && d.needs.social > 58) || (isE(d) && d.needs.social > 88))) return false;
  if (absNow() + 12 >= event.endsAt) return false;
  const occupied = Object.values(event.reserved);
  const open = event.tiles.filter(tile => !occupied.some(spot => spot.x === tile.x && spot.y === tile.y));
  const spaced = open.filter(tile => !occupied.some(spot => spot.x === tile.x && Math.abs(spot.y - tile.y) < 3));
  let route = null;
  for (const tile of new Set([...spaced, ...open])) {
    route = findPath(d.tx, d.ty, [tile]);
    if (route) break;
  }
  if (!route) return false;
  const target = route.at(-1) || { x: d.tx, y: d.ty };
  event.reserved[d.pid] = target;
  d.act = { type: 'visitGather' };
  d.path = route;
  d.state = route.length ? 'walk' : 'arrive';
  return true;
}

function arriveAtGathering(d) {
  const event = G.community.active;
  if (!event || !event.reserved[d.pid]) { endAct(d); return; }
  const guest = communityDoll(event.guestPid);
  const host = communityDoll(event.hostPid);
  const companion = d === guest ? host : guest;
  if (companion) bump(d, companion, d === guest || d === host ? 4 : 2);
  event.joined.push(d.pid);
  d.state = 'act';
  d.ft = 0;
  const gain = event.kind === 'tea' ? { fun: 9, social: 12, hunger: 9 } : { fun: 11, social: 15 };
  d.act = { type: 'visitStay', t: event.kind === 'visit' ? 12 : 20,
    gain, theme: event.kind, dance: event.kind === 'music' && (isE(d) || d.persona === 'genki') };
  const lines = {
    visit: d === host ? '进来坐，想喝点什么？' : '你们家坐着真舒服',
    tea: '我给大家留了一份点心',
    music: d.act.dance ? '这首歌好适合跳舞！' : '我在旁边听一会儿',
    games: '这局谁先来？我想试试！',
  };
  say(d, lines[event.kind]);
  if (event.kind === 'music' && d === host) SFX.play('piano');
  if (event.kind === 'games') SFX.play('game');
  HOOK.community();
}

function finishGuestDeparture() {
  const event = G.community.active;
  if (!event) return;
  const guest = communityDoll(event.guestPid);
  G.community.active = null;
  if (guest) {
    const entrance = doorOf();
    if (entrance) entrance.openT = .8;
    for (const d of G.dolls) if (d.act && (d === guest || d.act.partner === guest || d.act.target === guest)) {
      endAct(d); d.path = [];
    }
    G.dolls = G.dolls.filter(d => d !== guest);
    if (G.sel === guest.uid) G.sel = null;
    addLog(`👋 ${guest.name} 结束来访，回家了`);
  }
  HOOK.select();
  save();
}

function sendGuestHome(guest) {
  const door = doorTile();
  const entry = free(door.x, door.y) ? door : nearestFree(door.x, door.y, 1);
  const route = entry && findPath(guest.tx, guest.ty, [entry]);
  if (!route?.length) { finishGuestDeparture(); return; }
  if (guest.act) endAct(guest);
  guest.act = { type: 'visitLeave' };
  guest.path = route;
  guest.state = 'walk';
}

function endGetTogether() {
  const community = G.community, event = community.active;
  if (!event || event.leavingAt) return;
  const guest = communityDoll(event.guestPid), host = communityDoll(event.hostPid);
  const friend = community.friends.find(f => f.pid === event.guestPid);
  if (guest && host && friend && event.joined.includes(guest.pid) &&
    (event.joined.includes(host.pid) || rel(guest, host).f >= event.friendshipAtStart + 4)) {
    const friendship = rel(guest, host).f;
    if (friendship >= 53 && guest.needs.fun >= 55 && !community.applications.some(a => a.pid === guest.pid) &&
      Math.random() < (event.kind === 'visit' ? .52 : .68)) {
      community.applications.push({ pid: guest.pid, requestedAt: absNow() });
      HOOK.toast(`📮 ${guest.name} 想搬进小屋，已经留下入住申请`);
    }
  }
  event.leavingAt = absNow() + 50;
  for (const d of G.dolls) if (d.act && ['visitGather', 'visitStay'].includes(d.act.type)) {
    endAct(d); d.path = [];
  }
  if (!guest) { finishGuestDeparture(); return; }
  say(guest, '今天玩得很开心，下次见！');
  sendGuestHome(guest);
  HOOK.select();
  save();
}

function communityTick() {
  const community = G.community;
  const event = community.active;
  if (event) {
    const guest = communityDoll(event.guestPid);
    if (!guest) { endGetTogether(); finishGuestDeparture(); return; }
    if (event.leavingAt) {
      if (absNow() >= event.leavingAt) finishGuestDeparture();
      else if (guest.act?.type !== 'visitLeave' && guest.state !== 'lift') sendGuestHome(guest);
    } else if (absNow() >= event.endsAt || !communityDoll(event.hostPid)) endGetTogether();
    return;
  }
  if (G.time < 17.5 * 60 || G.time >= 21 * 60 || community.lastRoll === G.day || absNow() < community.nextEventAt) return;
  const hosts = availableHosts();
  if (!hosts.length) return;
  community.lastRoll = G.day;
  if (Math.random() >= .67) return;
  const host = weighted(hosts.map(d => [d, isE(d) ? 2.5 : 1]));
  const party = isE(host) ? .48 : .22;
  const kind = Math.random() < party ? weighted([
    ['tea', ['foodie', 'lazy'].includes(host.persona) ? 3 : 1],
    ['music', ['genki', 'social', 'stylist'].includes(host.persona) ? 3 : 1],
    ['games', ['nerd', 'genki'].includes(host.persona) ? 3 : 1],
  ]) : 'visit';
  startGetTogether(host, kind);
}

function moveInApplicant(pid) {
  const community = G.community;
  const friend = community.friends.find(f => f.pid === pid);
  if (!friend || !community.applications.some(a => a.pid === pid) || residents().length >= residentLimit()) return null;
  let doll = communityDoll(pid);
  if (doll?.guest) doll.guest = false;
  else if (!doll) doll = addDoll(friend);
  else return null;
  community.applications = community.applications.filter(a => a.pid !== pid);
  community.friends = community.friends.filter(f => f.pid !== pid);
  if (community.active?.guestPid === pid) {
    community.active.guestPid = null;
    if (doll.act?.type === 'visitLeave') { endAct(doll); doll.path = []; }
    endGetTogether();
    finishGuestDeparture();
  }
  return doll;
}
