// A cooked portion has a physical journey: stove → table → late return → thanks.
// Keep progress in world state so reloading cannot create extra food or rewards.
const CARE_ACTIONS = ['leaveMeal', 'savedMeal'];
Object.assign(ACT_NAMES, { leaveMeal: '给晚归的人留饭', savedMeal: '吃室友留下的饭' });
const carePerson = pid => residents().find(d => d.pid === pid);
const careTable = meal => G.furniture.find(f => f.key === meal.table && f.id === 'table');

function restoreHomeCare(saved) {
  const meals = Array.isArray(saved?.meals) ? saved.meals.filter(m => m &&
    typeof m.id === 'string' && typeof m.from === 'string' && typeof m.to === 'string' &&
    typeof m.table === 'string' && ['packing', 'ready', 'eaten', 'thanked'].includes(m.phase) &&
    Number.isFinite(m.created) && Number.isFinite(m.expires)).slice(-12).map(m => ({ ...m,
      bites: Math.max(0, Math.min(6, Number(m.bites) || 0)), nextTry: 0 })) : [];
  const prepared = Array.isArray(saved?.prepared) ? saved.prepared.filter(p => p && typeof p.pid === 'string' && Number.isInteger(p.month)).slice(-16) : [];
  return { next: Math.max(1, Math.floor(Number(saved?.next) || 1)), meals, prepared };
}
function caringFor(cook, guest) {
  if (tensionBetween(cook, guest) || rel(cook, guest).f < 0) return false;
  return JOBS[cook.job]?.caring || ['foodie', 'tidy', 'social'].includes(cook.persona) ||
    ['ISFJ', 'ESFJ', 'ENFJ', 'INFP'].includes(mb(cook)) || arePartners(cook, guest) || rel(cook, guest).f >= 55;
}
function lateWorker(d) {
  if (d.guest || d.state !== 'away' || G.community?.outing?.pid === d.pid || !JOBS[d.job]?.wage) return false;
  const wait = d.awayUntil - absNow(), hour = ((d.awayUntil % 1440) + 1440) % 1440;
  return wait > 0 && wait <= 12 * 60 && (hour >= 18 * 60 || d.job === 'night' || d.overtime);
}
function savedMealGuests(cook) {
  if (cook.guest || !G.care || G.care.prepared.some(p => p.pid === cook.pid && p.month === G.day)) return [];
  if (G.care.meals.filter(m => ['packing', 'ready'].includes(m.phase)).length >= 2) return [];
  return residents().filter(d => d !== cook && lateWorker(d) && caringFor(cook, d) &&
    !G.care.meals.some(m => m.to === d.pid && ['packing', 'ready'].includes(m.phase)));
}
function savedMealTable(cook) {
  return G.furniture.find(f => f.id === 'table' && !homeFurnitureReserved(f) &&
    !G.care.meals.some(m => m.table === f.key && ['packing', 'ready'].includes(m.phase)) &&
    findPath(cook.tx, cook.ty, approachTiles(f)));
}
function planSavedMeal(cook, recipient) {
  const guests = savedMealGuests(cook);
  const guest = recipient ? guests.find(d => d.pid === recipient)
    : guests.sort((a, b) => Number(arePartners(cook, b)) - Number(arePartners(cook, a)) || a.needs.hunger - b.needs.hunger)[0];
  if (!guest) return false;
  const table = savedMealTable(cook);
  if (!table) return false;
  const note = cook.persona === 'foodie' ? '多盛了一份，回来慢慢吃。' : cook.persona === 'tidy' ? '饭盖好了，碗筷也放在旁边。'
    : isE(cook) ? '辛苦啦！给你留了饭，吃饱再休息。' : '桌上这份是你的。不急，慢慢吃。';
  G.care.meals.push({ id: `meal-${G.care.next++}`, from: cook.pid, to: guest.pid, table: table.key,
    phase: 'packing', note, created: absNow(), expires: guest.awayUntil + 8 * 60, bites: 0, nextTry: 0 });
  G.care.prepared = G.care.prepared.filter(p => p.pid !== cook.pid && p.month >= G.day - 1);
  G.care.prepared.push({ pid: cook.pid, month: G.day });
  while (G.care.meals.length > 12) G.care.meals.splice(G.care.meals.findIndex(m => ['eaten', 'thanked'].includes(m.phase)), 1);
  return true;
}
function stoveForSavedMeal(cook) {
  if (!cook || !canAfford(cook, PRICES.cook) || cook.act?.mealRecipient || !savedMealTable(cook)) return;
  const back = cook.act?.onFurn && cook.act.back;
  return G.furniture.find(f => f.id === 'stove' && !homeFurnitureReserved(f) && !furnitureOrderBlock(cook, f) &&
    (back ? furniturePath(cook, f, back.x, back.y) : furniturePath(cook, f)));
}
function orderSavedMeal(cook, recipient) {
  const stove = stoveForSavedMeal(cook);
  if (!stove || !savedMealGuests(cook).some(d => d.pid === recipient) || !orderUse(cook, stove)) return false;
  cook.act.mealRecipient = recipient;
  return true;
}
function savedMealFor(d, table) {
  return G.care?.meals.find(m => m.to === d.pid && m.phase === 'ready' && m.expires > absNow() &&
    (!table || table.key === m.table) && carePerson(m.from) && !tensionBetween(d, carePerson(m.from)));
}
function beginCareAction(d, meal, type) {
  const table = careTable(meal); if (!table) return false;
  if (homeFurnitureReserved(table) || table.users.length >= FURNITURE.table.cap) return false;
  const tiles = approachTiles(table).filter(t => free(t.x, t.y) && !G.dolls.some(o => {
    if (o === d || o.state === 'away') return false;
    const dest = o.path.at(-1);
    return (o.tx === t.x && o.ty === t.y) || (dest?.x === t.x && dest?.y === t.y);
  }));
  const path = findPath(d.tx, d.ty, tiles); if (!path) return false;
  table.users.push(d); d.path = path; d.state = path.length ? 'walk' : 'arrive';
  d.act = { type, careId: meal.id, furn: table, gain: null };
  return true;
}
function stepAsideAfterServing(d, table) {
  const front = approachTiles(table);
  const kitchen = G.furniture.filter(f => f.id === 'stove').flatMap(approachTiles);
  const tiles = [...kitchen, {x:d.tx-2,y:d.ty+1},{x:d.tx+2,y:d.ty+1},{x:d.tx-2,y:d.ty},{x:d.tx+2,y:d.ty}].filter(t =>
    t.x !== d.tx && free(t.x,t.y) && !front.some(p => p.x === t.x && p.y === t.y) &&
    !G.dolls.some(o => o !== d && o.state !== 'away' && o.tx === t.x && o.ty === t.y));
  const path = findPath(d.tx,d.ty,tiles);
  if (path?.length) { d.path=path;d.state='walk';d.act={type:'wander'}; }
}
function tryHomeCare(d) {
  if (d.guest || !G.care || d.needs.bladder < 12 || d.needs.energy < 8 || inHomeTime(d)) return false;
  const leave = leaveAbs(d);
  if (leave != null && leave - absNow() < 35 && leave - absNow() > -180) return false;
  const pending = G.care.meals.find(m => m.from === d.pid && m.phase === 'packing');
  if (pending && beginCareAction(d, pending, 'leaveMeal')) return true;
  const meal = savedMealFor(d);
  if (meal && d.needs.hunger < 85 && beginCareAction(d, meal, 'savedMeal')) return true;
  const thanks = G.care.meals.find(m => m.to === d.pid && m.phase === 'eaten' &&
    G.day > m.eatenMonth && (m.nextTry || 0) <= absNow());
  if (!thanks || G.time < 7 * 60 || G.time > 21 * 60) return false;
  const cook = carePerson(thanks.from);
  thanks.nextTry = absNow() + 30;
  if (!cook || !availableForHouseChat(cook) || !canSee(d, cook) || !canDisturb(d, cook) || tensionBetween(d, cook)) return false;
  const line = d.persona === 'foodie' ? '上次给我留的饭，连最后一口都吃光了。' : d.persona === 'nerd' ? '上次回来看到那张便签，忽然就没那么累了。'
    : d.persona === 'lazy' ? '那天还以为得饿着睡呢……谢谢你的饭。' : '上次晚归的那份饭，谢谢你。我都记着呢。';
  return startAct(d, { type: 'chat', partner: cook, kind: 'chat', exchange: {
    careId: thanks.id, lines: [line, isE(cook) ? '吃好了就好，下次也一起吃呀。' : '嗯，回来有口饭吃就好。', '有你在家，真好。']
  } });
}
function arriveHomeCare(d) {
  if (!CARE_ACTIONS.includes(d.act?.type)) return;
  const a = d.act, meal = G.care.meals.find(m => m.id === a.careId), table = meal && careTable(meal);
  const expected = a.type === 'leaveMeal' ? 'packing' : 'ready';
  if (!meal || meal.phase !== expected || table !== a.furn ||
      !approachTiles(table).some(t => t.x === d.tx && t.y === d.ty)) { endAct(d); return; }
  d.state = 'act'; d.dir = 'down'; a.t = a.type === 'leaveMeal' ? 2.4 : 6 - meal.bites;
  a.careElapsed = 0;
  say(d, a.type === 'leaveMeal' ? '这份留给晚回家的人。' : `是${carePerson(meal.from).name}留给我的……`, 2.5);
}
function tickCareAction(d, dt) {
  if (!CARE_ACTIONS.includes(d.act?.type)) return;
  const a = d.act, meal = G.care.meals.find(m => m.id === a.careId), cook = meal && carePerson(meal.from), guest = meal && carePerson(meal.to);
  if (!meal || !cook || !guest || careTable(meal) !== a.furn || tensionBetween(cook, guest)) { endAct(d); return; }
  a.careElapsed += dt;
  if (a.type === 'savedMeal') {
    const bite = Math.min(dt, 6 - meal.bites);
    meal.bites += bite;
    d.needs.hunger = Math.min(100, d.needs.hunger + bite * 7);
    d.needs.energy = Math.min(100, d.needs.energy + bite);
  }
  a.t -= dt;
  if (a.t > .00001) return;
  if (a.type === 'leaveMeal') {
    meal.phase = 'ready';
    addLog(`🍲 ${cook.name} 给晚归的 ${guest.name} 留了一份饭和便签，还亮起了餐桌上的小灯`);
    NPCMemory.record(G, { type: 'saved-meal-left', time: absNow(), participants: [cook.pid, guest.pid], outcome: 'waiting' }, [
      { person: cook.pid, subject: guest.pid, emotion: .45, impact: 48, interpretation: `${guest.name} 还没回家，我把饭和便签留在了桌上` }
    ]);
  } else {
    meal.phase = 'eaten'; meal.eatenMonth = G.day; d.happy = 5;
    bump(cook, d, 3); addTrust(d, cook, 5);
    const text = `${d.name} 晚归后吃完了 ${cook.name} 留的饭，收好了那张便签`;
    addLog(`🕯 ${text}`);
    NPCMemory.record(G, { type: 'saved-meal', time: absNow(), participants: [cook.pid, d.pid], outcome: 'eaten' }, [
      { person: d.pid, subject: cook.pid, emotion: .8, impact: 78, interpretation: `晚归时，${cook.name} 给我留了饭和一盏灯` }
    ]);
    addHomeMemory('care', '回家时，有人为我留了饭', text, [cook, d], meal.id);
    say(d, '吃饱了，好像也没那么累了。');
  }
  endAct(d);
  if (a.type === 'leaveMeal') stepAsideAfterServing(d, a.furn);
}
function finishCareThanks(d, cook, id) {
  const meal = G.care?.meals.find(m => m.id === id && m.phase === 'eaten' && m.to === d.pid && m.from === cook.pid);
  if (!meal || tensionBetween(d, cook)) return;
  meal.phase = 'thanked';
  addLog(`💛 ${d.name} 当面谢谢 ${cook.name} 上次留下的饭，两人提起了那张便签`);
  NPCMemory.record(G, { type: 'saved-meal-thanks', time: absNow(), participants: [d.pid, cook.pid], outcome: 'thanked' }, [
    { person: cook.pid, subject: d.pid, emotion: .65, impact: 58, interpretation: `${d.name} 记着我留的饭，今天特意来道谢` }
  ]);
}
function noticeSavedMeal(d) {
  if (!savedMealFor(d)) return false;
  d.think = .3;
  say(d, '终于回来了，先找点吃的。');
  return true;
}
function tickHomeCare() {
  if (!G.care) return;
  G.care.meals = G.care.meals.filter(m => {
    const from = carePerson(m.from), to = carePerson(m.to);
    if (!from || !to) return false;
    if (['packing', 'ready'].includes(m.phase)) return !!careTable(m) && m.expires > absNow() &&
      (m.phase !== 'packing' || m.created + 240 > absNow()) && !tensionBetween(from, to);
    return m.eatenMonth >= G.day - 3;
  });
}
function savedMealAt(f) { return G.care?.meals.find(m => m.table === f.key && m.phase === 'ready'); }
function savedMealNote(f) {
  const m = savedMealAt(f), cook = m && carePerson(m.from), guest = m && carePerson(m.to);
  return cook && guest ? `📝 给${guest.name}：${m.note} ——${cook.name}` : null;
}
function drawSavedMeal(c, f, x, y) {
  const meal = savedMealAt(f); if (!meal) return;
  // Table-top props share the furniture's projection and occlusion; no floating sticker.
  const eating = f.users.some(d => d.state === 'act' && d.act?.type === 'savedMeal');
  if (!eating) {
    R(c, x + 9, y - 3, 12, 2, '#765854'); R(c, x + 10, y - 4, 10, 1, '#fff5d9');
    R(c, x + 11, y - 7, 8, 3, '#a7c9b7'); R(c, x + 13, y - 8, 4, 1, '#cce2d0');
    R(c, x + 14, y - 10, 2, 2, '#765854');
  }
  R(c, x + 23, y - 5, 6, 5, '#fff4c8'); R(c, x + 24, y - 4, 3, 1, '#b48f72');
  R(c, x + 24, y - 2, 2, 1, '#bc8390');
  R(c, x + 3, y - 4, 4, 4, '#916e5b'); R(c, x + 3, y - 7, 4, 3, '#f7d68b');
  R(c, x + 4, y - 6, 2, 2, '#fff4cf');
}
