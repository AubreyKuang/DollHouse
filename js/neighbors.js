// 麦麦住在隔壁，出门做事的时段与关系进度独立于小屋住户。
const NEIGHBOR_PID = 'neighbor-maimai';
const NEIGHBOR_PROFILE = {
  pid: NEIGHBOR_PID, name: '麦麦', persona: 'maker', zodiac: 'virgo', mbti: 'ISFJ', job: 'baker',
  gender: 'f', heart: 'normal', money: 1500, visits: 0,
  look: { skin: 1, hair: 'bob', hairColor: 2, top: 'overall', topColor: 5, bottom: 'shorts', bottomColor: 6, shoes: 1, acc: 'flower' },
};

function neighborProfile() {
  return G.community.friends.find(f => f.pid === NEIGHBOR_PID) || NEIGHBOR_PROFILE;
}

function neighborSchedule() {
  const neighbor = communityDoll(NEIGHBOR_PID);
  if (neighbor) return neighbor.guest ? '正在小屋串门' : '已经搬进小屋';
  if (G.time < 10 * 60 || G.time >= 20 * 60) return '在家休息';
  if (G.time < 14 * 60) return '在面包店忙';
  return '在家，可以串门';
}

function neighborTie(d) {
  return G.community.neighbor.ties[d.pid];
}

function contactNeighbor(d, other, meal = false) {
  const ties = G.community.neighbor.ties;
  const tie = (ties[d.pid] ||= { months: 0, meals: 0, lastMonth: 0, lastMeal: 0 });
  if (tie.lastMonth !== G.day) { tie.lastMonth = G.day; tie.months++; }
  if (meal && tie.lastMeal !== G.day) { tie.lastMeal = G.day; tie.meals++; }
  bump(d, other, meal ? 8 : 5);
  const r = rel(d, other);
  if (tie.meals >= 3 && !r.tags?.meal) {
    (r.tags ||= {}).meal = true;
    HOOK.toast(`🍚 ${d.name}和邻居${other.name}成了饭搭子！`);
  }
  if (tie.months >= 4 && tie.meals >= 2 && r.f >= 60 && !G.community.applications.some(a => a.pid === other.pid)) {
    G.community.applications.push({ pid: other.pid, requestedAt: absNow() });
    HOOK.toast(`📮 邻居${other.name}熟悉了小屋的生活，主动留下了入住申请。`);
  }
  return tie;
}

function tickNeighborVisit() {
  const n = G.community.neighbor;
  if (communityDoll(NEIGHBOR_PID) || G.community.outing || G.time < 14 * 60 || G.time >= 17 * 60 ||
      !autoVisitAllowed() || n.lastRoll === G.day || n.lastMonth === G.day || absNow() < G.community.nextEventAt) return false;
  const host = availableHosts().filter(d => d.act?.type !== 'leave' && d.needs.energy >= 34 && d.needs.hunger >= 25).sort((a, b) => {
    const interest = d => (G.rel[relKey(d, NEIGHBOR_PROFILE)]?.f ?? 25) + (['social', 'foodie', 'maker'].includes(d.persona) ? 8 : 0);
    return interest(b) - interest(a);
  })[0];
  if (!host) return false;
  n.lastRoll = G.day;
  if (Math.random() >= (n.borrowed ? .45 : .20)) return false;
  let friend = neighborProfile();
  if (friend === NEIGHBOR_PROFILE) {
    friend = { ...NEIGHBOR_PROFILE, look: { ...NEIGHBOR_PROFILE.look } };
    G.community.friends.push(friend);
  }
  const exchange = n.borrowed ? 'returnTool' : n.visits % 3 === 1 ? 'borrow' : 'bread';
  if (!startGetTogether(host, 'visit', { friend, exchange })) return false;
  n.lastMonth = G.day;
  G.community.lastAutoVisit = G.day;
  n.visits++;
  save();
  return true;
}

function finishNeighborExchange(event, host, guest) {
  if (event.exchangeDone) return;
  event.exchangeDone = true;
  const state = G.community.neighbor;
  const tie = contactNeighbor(host, guest);
  const lines = {
    bread: '今天烤多了，给你们带了一袋面包。',
    borrow: '我想修一下橱柜，可以借把螺丝刀吗？',
    returnTool: '螺丝刀还给你们。橱柜的门终于不响啦！',
  };
  if (event.exchange === 'borrow') state.borrowed = true;
  if (event.exchange === 'returnTool') state.borrowed = false;
  say(guest, lines[event.exchange]);
  addLog(`🏡 邻居${guest.name}对${host.name}说：「${lines[event.exchange]}」`);
  if (event.exchange === 'bread') {
    host.needs.hunger = Math.min(100, host.needs.hunger + 10);
    if (['foodie', 'social', 'tidy'].includes(host.persona)) {
      say(host, '你等等，我也给你装一份点心。');
      bump(host, guest, 4);
      addLog(`🎁 ${host.name}给邻居${guest.name}回赠了一盒点心。`);
    }
  }
  if (tie.months === 2 && !tie.invited) {
    tie.invited = true;
    tie.inviteMonth = G.day + 1;
    say(guest, '下个月有空来我家坐坐吧。');
    addLog(`🏡 邻居${guest.name}约${host.name}下个月来家里吃点东西。`);
  }
  save();
}

function canVisitNeighbor(d) {
  const tie = d && neighborTie(d);
  return !!tie && tie.invited && tie.lastMeal !== G.day && G.day >= (tie.inviteMonth || 0) &&
    availableHosts().includes(d) && !G.community.outing && !G.community.active && !communityDoll(NEIGHBOR_PID) &&
    G.time >= 14 * 60 && G.time < 20 * 60;
}

function neighborExitRoute(d) {
  const door = doorTile();
  const entry = free(door.x, door.y) ? door : nearestFree(door.x, door.y, 1);
  return entry && findPath(d.tx, d.ty, [entry]);
}

function startNeighborOuting(d) {
  if (!canVisitNeighbor(d)) return false;
  const route = neighborExitRoute(d);
  if (!route) return false;
  if (d.act) endAct(d);
  G.community.outing = { pid: d.pid, phase: 'leaving' };
  d.path = route;
  d.state = route.length ? 'walk' : 'arrive';
  d.act = { type: 'neighborLeave' };
  HOOK.community();
  save();
  return true;
}

function arriveNeighborOuting(d) {
  const outing = G.community.outing;
  if (outing?.pid !== d.pid) { endAct(d); return; }
  outing.phase = 'visiting';
  outing.until = absNow() + 95;
  d.awayUntil = outing.until;
  d.state = 'away'; d.path = []; d.act = null; d.bubble = null;
  const door = doorOf();
  if (door) door.openT = .8;
  addLog(`🚪 ${d.name}去邻居麦麦家串门了。`);
  HOOK.select();
  save();
}

function tickNeighborOuting() {
  const outing = G.community.outing;
  if (!outing) {
    if (G.time >= 17.25 * 60 && G.time < 19 * 60) {
      const visitor = residents().filter(d => d.state === 'idle' && d.needs.energy >= 34 && canVisitNeighbor(d))
        .sort((a, b) => (G.rel[relKey(b, NEIGHBOR_PROFILE)]?.f || 0) - (G.rel[relKey(a, NEIGHBOR_PROFILE)]?.f || 0))[0];
      if (visitor) startNeighborOuting(visitor);
    }
    return;
  }
  const d = communityDoll(outing.pid);
  if (!d || communityDoll(NEIGHBOR_PID)?.guest === false) {
    if (d?.state === 'away' && outing.phase === 'visiting') returnFromNeighbor(d, false);
    else G.community.outing = null;
    return;
  }
  if (outing.phase === 'leaving') {
    if (outing.resume) {
      delete outing.resume;
      G.community.outing = null;
      startNeighborOuting(d);
    } else if (d.act?.type !== 'neighborLeave') G.community.outing = null;
    return;
  }
  if (absNow() >= outing.until) returnFromNeighbor(d, true);
}

function returnFromNeighbor(d, sharedMeal) {
  G.community.outing = null;
  const door = doorTile();
  const entry = nearestFree(door.x, door.y, 1);
  if (entry) placeDollAt(d, entry.x, entry.y);
  d.state = 'idle'; d.dir = 'down'; d.awayUntil = 0; d.think = 2;
  if (sharedMeal) {
    contactNeighbor(d, neighborProfile(), true);
    d.needs.hunger = Math.min(100, d.needs.hunger + 23);
    d.needs.social = Math.min(100, d.needs.social + 16);
    addLog(`🍞 ${d.name}和邻居麦麦在隔壁吃完一顿饭，回到了小屋。`);
  }
  const entrance = doorOf();
  if (entrance) entrance.openT = .8;
  HOOK.select();
  save();
}
