const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function runGame(scenario, { mode, data = new Map(), withView = false } = {}) {
  const pointer = {};
  const canvas = {
    style: {}, getContext: () => ({ scale() {} }), setPointerCapture() {},
    addEventListener: (name, fn) => { pointer[name] = fn; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width / 4, height: this.height / 4 }; },
  };
  const context = vm.createContext({
    assert, pointer, canvas, setTimeout() {}, window: { addEventListener() {} },
    document: { body: { dataset: { mode } }, getElementById: id => id === 'cv' ? canvas : { style: { setProperty() {} } }, createElement: () => canvas },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
  });
  for (const [, script] of read('index.html').matchAll(/<script src="([^"]+)"/g)) {
    if (script === (withView ? 'js/ui.js' : 'js/view.js')) break;
    vm.runInContext(read(script), context, { filename: script });
  }
  if (!withView) vm.runInContext('HOOK.resize = () => {}', context);
  vm.runInContext(scenario, context);
}

test('every purchasable furnishing has one category, a price, and a sprite', () => {
  runGame(`
    const items = Object.values(FURNITURE_GROUPS).flat();
    assert.equal(new Set(items).size, items.length);
    assert.deepEqual(items.slice().sort(), Object.keys(FURNITURE).filter(id => !FURNITURE[id].fixed).sort());
    for (const id of items) {
      assert.ok(SHOP[id]?.[0] > 0, id);
      assert.equal(typeof DRAW[id], 'function', id);
      if (FURNITURE[id].use) assert.ok(ACT_NAMES[FURNITURE[id].use], id);
    }
  `);
});

test('pointer coordinates and overlay anchors use the full scaled canvas in either orientation', () => {
  runGame(`
    load();
    assert.equal(canvas.width, (W + HOUSE_MARGIN) * SCENE_SCALE);
    assert.equal(canvas.height, HOUSE_HEIGHT * SCENE_SCALE);
    for (const width of [300, 720]) {
      const height = width * canvas.height / canvas.width;
      canvas.getBoundingClientRect = () => ({ left: 21, top: 84, width, height });
      const point = toScene({ clientX: 21 + width * .75, clientY: 84 + height * .9 });
      assert.ok(Math.abs(point.x / (W + HOUSE_MARGIN) - .75) < 1e-9);
      assert.ok(Math.abs(point.y / HOUSE_HEIGHT - .9) < 1e-9);
      const marker = { style: {} };
      positionOverlay(marker, point.x, point.y);
      assert.equal(marker.style.left, '75%');
      assert.ok(Math.abs(parseFloat(marker.style.top) - 90) < 1e-9);
    }
  `, { withView: true });
});

test('dropping onto or beside a resident starts a mutual interaction on separate tiles', () => {
  runGame(`
    load();
    const [carried, target] = G.dolls;
    G.dolls = [carried, target];
    const event = ({ x, y }) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });
    for (const offset of [0, T]) {
      placeDollAt(carried, 5, 18);
      placeDollAt(target, 11, 17);
      const from = houseHeadPoint(carried), head = houseHeadPoint(target);
      const release = { x: head.x + offset, y: head.y + (offset ? 2 : 12) };
      pointer.pointerdown(event({ x: from.x, y: from.y + 6 }));
      pointer.pointermove(event(release));
      assert.equal(carried.state, 'lift');
      assert.equal(dropInteraction(release, carried).target, target);
      pointer.pointerup(event(release));
      assert.equal(carried.act.partner, target);
      assert.equal(target.act.partner, carried);
      assert.equal(Math.abs(carried.tx - target.tx), 1);
      assert.equal(carried.ty, target.ty);
      endAct(carried);
    }
  `, { withView: true });
});

test('interaction drops respect walls, busy residents, and canceled drags', () => {
  runGame(`
    load();
    const [carried, target] = G.dolls;
    G.dolls = [carried, target];
    placeDollAt(carried, 5, 18);
    placeDollAt(target, 3, 18);
    const point = houseHeadPoint(carried);
    const event = ({ x, y }) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });
    const bedroom = { x: HOUSE_X + 4 * T + 8, y: houseDollPoint(target).y - 12 };
    assert.equal(dropInteraction(bedroom, carried), null);
    target.act = { type: 'shower' };
    const occupied = houseHeadPoint(target);
    const release = { x: occupied.x, y: occupied.y + 12 };
    pointer.pointerdown(event({ x: point.x, y: point.y + 6 }));
    pointer.pointermove(event(release));
    assert.match(dropInteraction(release, carried).reason, /正在忙/);
    pointer.pointerup(event(release));
    assert.equal(target.act.type, 'shower');
    assert.equal(carried.act, null);
    assert.equal(carried.tx, 5);

    target.act = null;
    pointer.pointerdown(event({ x: point.x, y: point.y + 6 }));
    pointer.pointermove(event(release));
    pointer.pointercancel(event(release));
    pointer.pointerup(event(release));
    assert.equal(carried.state, 'idle');
    assert.equal(carried.tx, 5);
    assert.equal(target.act, null);
  `, { withView: true });
});

test('an urgent resident uses the toilet and the new need survives save and reload', () => {
  runGame(`
    load();
    const doll = G.dolls[0];
    assert.equal(doll.needs.bladder, 85);
    doll.job = 'none';
    doll.needs.bladder = 5;
    G.furniture = [];
    G.dolls = [doll];
    const toilet = addFurniture('toilet', 2, 6);
    rebuild();
    placeDollAt(doll, 2, 7);
    decide(doll);
    assert.equal(doll.act.furn, toilet);
    updateDoll(doll, .05);
    assert.equal(doll.act.type, 'toilet');
    for (let i = 0; i < 120 && doll.state === 'act'; i++) updateDoll(doll, .05);
    assert.equal(doll.needs.bladder, 100);
    assert.equal(toilet.users.length, 0);
    assert.ok(save());
    load();
    assert.equal(G.dolls[0].needs.bladder, 100);
    assert.equal(G.furniture[0].id, 'toilet');
  `);
});

test('the starter bathroom fixtures can all be reached through its open doorway', () => {
  for (const mode of [undefined, 'test']) runGame(`
    load();
    assert.ok(G.bathroom);
    assert.ok(G.furniture.every(f => canPlace(f.id, f.x, f.y, f)));
    const start = doorTile();
    for (const id of ['shower', 'washstand', 'toilet']) {
      const fixture = G.furniture.find(f => f.id === id);
      assert.equal(roomOf({ tx: fixture.x, ty: fixture.y }), 'bathroom');
      const route = findPath(start.x, start.y, approachTiles(fixture));
      assert.ok(route?.some(t => t.x === BATH_X - 1 && t.y === BATH_DOOR_Y), id);
    }
    assert.ok(!canPlace('chair', BATH_X, BATH_DOOR_Y));
    assert.ok(!canPlace('sofa', BATH_X - 1, BATH_DOOR_Y + 1));
    assert.ok(!canSee({ tx: BATH_X - 1, ty: BATH_DOOR_Y }, { tx: BATH_X, ty: BATH_DOOR_Y }));
    assert.ok(save());
    load();
    assert.ok(G.bathroom);
  `, { mode });
});

test('a player introduction becomes news only after a confirmed follow-up', () => {
  runGame(`
    load();
    const [first, second] = G.dolls;
    G.dolls = [first, second];
    const swing = G.furniture.find(f => f.id === 'gardenSwing');
    G.furniture = [swing];
    rebuild();
    G.time = 720;
    placeDollAt(first, 2, 24);
    placeDollAt(second, 1, 24);
    first.act = { kind: 'chat' };
    startSocial(first, second, true);
    const story = G.paperMoments[0];
    assert.equal(story.result, undefined);
    assert.equal(story.people[0].name, first.name);
    endAct(first);
    assert.ok(startAct(second, { type: 'swing', furn: swing }));
    arrive(second);
    assert.equal(paperFollowup(first, swing), story);

    // A manually ordered activity does not inherit the introduction.
    assert.ok(orderUse(first, swing));
    arrive(first);
    assert.equal(story.result, undefined);
    endAct(first);

    // The AI can choose a shared activity because of the introduction.
    first.needs.fun = 5;
    decide(first);
    assert.equal(first.act.paperMoment, story);
    arrive(first);
    assert.match(story.result[2], /又相约荡秋千/);
    assert.equal(story.pending, false);
    assert.ok(save());
    load();
    assert.match(G.paperMoments[0].steps[2], /荡秋千/);
    finishHouseMonth();
    assert.match(G.paper.at(-1).stories[0].text, /被你拉到一起/);
    assert.equal(G.paper.at(-1).stories[0].people.length, 2);
    assert.equal(G.paperMoments.length, 0);
  `);
});

test('residents can walk to the yard, share a swing and return indoors', () => {
  runGame(`
    load();
    const [first, second] = G.dolls;
    const swing = G.furniture.find(f => f.id === 'gardenSwing');
    placeDollAt(first, 10, 17);
    placeDollAt(second, 11, 10);
    for (const d of [first, second]) {
      assert.ok(orderUse(d, swing));
      assert.ok(d.path.some(t => t.y === ROWS && yardGate(t.x)));
      for (let i = 0; i < 700 && d.state !== 'act'; i++) updateDoll(d, .05);
      assert.equal(d.act?.type, 'swing');
      assert.equal(roomOf(d), 'yard');
    }
    assert.notEqual(first.act.seat, second.act.seat);
    assert.ok(G.log.some(e => e.text.includes('一起荡秋千')));
    endAct(first);
    assert.ok(findPath(first.tx, first.ty, [{ x: 11, y: 10 }]).some(t => t.y === FLOOR_SPLIT - 1));
    assert.ok(!canPlace('gardenSwing', 1, 6));
    assert.ok(!canPlace('bed', 1, 21));
    assert.ok(save());
    load();
    assert.equal(roomOf(G.dolls[0]), 'yard');
    assert.equal(G.furniture.filter(f => f.id === 'gardenSwing').length, 1);
  `);
});

test('legacy saves gain a furnished yard once while indoor furniture stays in place', () => {
  runGame(`
    const old = defaultHouseSave();
    old.furniture = [{ id: 'sofa', x: 3, y: 15 }];
    old.bathroom = false;
    applySave(old);
    assert.equal(G.furniture.filter(f => f.y >= ROWS).length, 4);
    G.furniture = G.furniture.filter(f => f.id !== 'flowerBox');
    assert.ok(save());
    load();
    assert.equal(G.furniture.filter(f => f.y >= ROWS).length, 3);
    const sofa = G.furniture.find(f => f.id === 'sofa');
    assert.equal(sofa.x, 3);
    assert.equal(sofa.y, 15);
  `);
});

test('older custom houses keep their upstairs floor plan on reload', () => {
  runGame(`
    const custom = defaultHouseSave();
    delete custom.bathroom;
    custom.furniture = [{ id: 'sofa', x: 3, y: 15 }];
    applySave(custom);
    assert.ok(save());
    load();
    assert.equal(G.bathroom, false);
    assert.equal(G.furniture[0].id, 'sofa');
    assert.equal(G.furniture[0].x, 3);
    assert.equal(G.furniture[0].y, 15);
  `);
});

test('only confirmed partners are shown as a couple, including after a breakup', () => {
  runGame(`
    load();
    const [tao, lan, jing, tuan] = G.dolls;
    assert.equal(confirmedPartners(tuan)[0], lan);
    assert.equal(confirmedPartners(lan)[0], tuan);
    Object.assign(rel(jing, tao), { secret: true, l: 100 });
    assert.equal(confirmedPartners(jing).length, 0);
    rel(jing, tao).lovers = true;
    assert.equal(confirmedPartners(jing)[0], tao);
    bump(jing, tao, 0, -100);
    assert.equal(confirmedPartners(tao).length, 0);
  `);
});

test('the chess table gives two residents different positions and records a shared game', () => {
  runGame(`
    load();
    const [first, second] = G.dolls;
    const table = addFurniture('chessTable', 2, 6);
    rebuild();
    placeDollAt(first, 2, 7);
    placeDollAt(second, 3, 7);
    const previous = rel(first, second).f;
    assert.ok(startAct(first, { type: 'chess', furn: table }));
    arrive(first);
    assert.ok(startAct(second, { type: 'chess', furn: table }));
    arrive(second);
    assert.notEqual(first.tx, second.tx);
    assert.ok(!startAct(G.dolls[2], { type: 'chess', furn: table }));
    assert.ok(rel(first, second).f > previous);
    assert.equal(G.daily.chess[first.name + ' 和 ' + second.name], 1);
  `);
});

test('the calendar starts in January, celebrates a birthday once, and crosses a year boundary', () => {
  runGame(`
    load();
    assert.equal(monthLabel(G.day), '1 年 1 月');
    assert.equal(G.time, 0);
    assert.equal(seasonOf(G.day).id, 'winter');
    const jing = G.dolls.find(d => d.pid === 'p-jing');
    assert.equal(birthdayOf(jing), 1);
    assert.match(astroLine(jing), /🎂 1 月/);
    const notifications = [];
    HOOK.toast = message => notifications.push(message);
    update(.05);
    assert.equal(notifications.filter(text => text.includes('眼镜君 的生日')).length, 1);
    load();
    update(.05);
    assert.equal(notifications.filter(text => text.includes('眼镜君 的生日')).length, 1);
    G.day = 12;
    G.monthEvents = 12;
    G.time = 1439.9;
    G.paper = [];
    update(.05);
    assert.equal(monthLabel(G.day), '2 年 1 月');
    assert.equal(G.paper[0].month, '1 年 12 月');
    assert.equal(notifications.filter(text => text.includes('眼镜君 的生日')).length, 2);
    assert.equal(formatSavedPaper('第 13 天 · 周六\\n旧内容'), '2 年 1 月\\n旧内容');
    assert.equal(seasonOf(3).id, 'spring');
    assert.equal(holidayOf(12).name, '圣诞节');
  `);
});

test('16 MBTI types favor different activities and nine base personalities remain selectable', () => {
  runGame(`
    assert.equal(Object.keys(PERSONAS).length, 9);
    assert.equal(Object.keys(MBTI_INTERESTS).length, 16);
    assert.equal(new Set(Object.values(MBTI_INTERESTS).map(list => list[0] + ':' + list[1])).size, 16);
    for (const list of Object.values(MBTI_INTERESTS)) {
      for (const activity of list) assert.ok(ACT_NAMES[activity], activity);
    }
    load();
    const doll = G.dolls[0];
    doll.mbti = 'INTJ';
    assert.ok(traitBonus(doll, 'planChess') > traitBonus({ ...doll, mbti: 'ESFP' }, 'planChess'));
    doll.persona = 'tidy';
    const basket = addFurniture('laundry', 1, 8);
    rebuild();
    placeDollAt(doll, 1, 9);
    assert.ok(startAct(doll, { type: 'tidy', furn: basket }));
    arrive(doll);
    assert.equal(doll.act.type, 'tidy');
    assert.ok(basket.active);
  `);
});

test('situational routines use weather, availability, relationships and saved cooldowns', () => {
  runGame(`
    load();
    const [actor, friend] = G.dolls;
    actor.persona = 'social'; actor.mbti = 'ENFJ';
    actor.needs = { energy: 75, hunger: 75, fun: 75, social: 70, bladder: 85 };
    friend.needs = { ...actor.needs, fun: 50 };
    placeDollAt(actor, 4, 8); placeDollAt(friend, 5, 8);
    rel(actor, friend).f = 55;
    assert.ok(routineOptions(actor, () => 0).some(option => option.type === 'checkIn' && option.partner === friend));
    assert.ok(startAct(actor, { type: 'checkIn', partner: friend }));
    assert.equal(friend.act.partner, actor);
    assert.ok(rel(actor, friend).f > 55);
    assert.equal(G.daily.routine[actor.name + '与' + friend.name + ' · 问问室友近况'], 1);
    endAct(actor);
    assert.equal(friend.state, 'idle');
    assert.ok(save());
    load();
    const restored = G.dolls[0];
    assert.ok(!routineAvailable(restored, 'checkIn'));
    restored.persona = 'lazy';
    G.weather = 'sunny';
    assert.ok(!routineAvailable(restored, 'cloudWatch'));
    G.weather = 'rain';
    assert.ok(routineAvailable(restored, 'cloudWatch'));
    restored.needs.hunger = 10;
    assert.ok(!routineAvailable(restored, 'cloudWatch'));
  `);
});

test('the sandbox grants maximum space and free furniture without changing the normal save', () => {
  const data = new Map();
  runGame(`load(); G.fund = 37; assert.ok(save());`, { data });
  runGame(`
    load();
    assert.equal(G.level, LEVELS.length - 1);
    assert.equal(COLS, 24);
    assert.ok(G.furniture.some(f => f.id === 'craftBench'));
    G.fund = 0; G.inv.vanity = 0;
    for (let i = 0; i < 200; i++) assert.ok(acquire('vanity'));
    assert.equal(G.fund, 0); assert.equal(G.inv.vanity, 0);
    assert.ok(!acquire('door'));
    G.dolls[0].money = 0;
    assert.ok(pay(G.dolls[0], 1000000000, '测试'));
    G.time = 123; assert.ok(save());
    load(); assert.equal(G.time, 123);
  `, { mode: 'test', data });
  runGame(`load(); assert.equal(G.fund, 37); assert.equal(G.level, 1); assert.equal(G.time, 0);`, { data });
});

test('a visiting friend attends a party, applies, and moves in with the same identity', () => {
  runGame(`
    load();
    G.time = 18 * 60;
    const host = G.dolls[0];
    host.job = 'none';
    assert.ok(startGetTogether(host, 'tea'));
    const id = G.community.active.guestPid;
    const friendName = communityDoll(id).name;
    assert.equal(residents().length, 4);
    assert.equal(G.dolls.length, 5);
    assert.equal(workTick(communityDoll(id), .05), false);
    assert.ok(!startGetTogether(host, 'games'));
    assert.ok(save());
    load();
    assert.equal(communityDoll(id).name, friendName);
    const restored = communityDoll(host.pid);
    const guest = communityDoll(id);
    for (const d of [restored, guest]) {
      assert.ok(joinGetTogether(d));
      for (let i = 0; i < 650 && d.act.type === 'visitGather'; i++) updateDoll(d, .05);
      assert.equal(d.act.type, 'visitStay');
      assert.equal(d.act.gain.hunger, 9);
    }
    assert.equal(G.community.active.joined.length, 2);
    assert.notDeepEqual(G.community.active.reserved[restored.pid], G.community.active.reserved[id]);
    const friendship = rel(restored, guest).f;
    assert.ok(friendship >= 53);
    Math.random = () => 0;
    G.time = G.community.active.endsAt;
    communityTick();
    assert.equal(G.community.applications[0].pid, id);
    for (let i = 0; i < 650 && communityDoll(id); i++) updateDoll(guest, .05);
    assert.equal(communityDoll(id), undefined);
    assert.ok(save());
    load();
    const newcomer = moveInApplicant(id);
    assert.equal(newcomer.name, friendName);
    assert.equal(newcomer.pid, id);
    assert.equal(newcomer.guest, false);
    assert.equal(rel(communityDoll(host.pid), newcomer).f, friendship);
    assert.equal(residents().length, 5);
    assert.equal(G.community.applications.length, 0);
    assert.equal(moveInApplicant(id), null);
  `);
});

test('the evening roll is bounded and applications wait when the house is full', () => {
  runGame(`
    load();
    for (const resident of residents()) resident.job = 'none';
    Math.random = () => 0;
    G.time = 12 * 60;
    communityTick();
    assert.equal(G.community.active, null);
    G.time = 18 * 60;
    communityTick();
    assert.equal(G.community.lastRoll, G.day);
    const id = G.community.active.guestPid;
    G.community.applications.push({ pid: id, requestedAt: absNow() });
    addDoll({ ...newcomerProfile(), pid: 'full-house' });
    assert.equal(residents().length, residentLimit());
    assert.equal(moveInApplicant(id), null);
    assert.equal(G.community.applications[0].pid, id);
    G.fund = 9000;
    expand();
    const newcomer = moveInApplicant(id);
    assert.equal(newcomer.pid, id);
    assert.equal(G.dolls.filter(d => d.pid === id).length, 1);
    assert.equal(G.community.active, null);
  `);
});

test('the same neighbor exchanges bread and tools, then hosts a persistent visit and earns a meal bond', () => {
  runGame(`
    load();
    const host = residents().find(d => d.persona === 'foodie');
    Math.random = () => .5;
    const pid = host.pid;
    G.dolls = [host];
    host.job = 'none';
    for (const [day, exchange] of [[1, 'bread'], [2, 'borrow'], [3, 'returnTool']]) {
      G.day = day; G.time = 14 * 60;
      assert.ok(tickNeighborVisit());
      const event = G.community.active;
      assert.equal(event.exchange, exchange);
      assert.equal(event.guestPid, NEIGHBOR_PID);
      const guest = communityDoll(NEIGHBOR_PID);
      for (const d of [host, guest]) {
        assert.ok(joinGetTogether(d));
        for (let i = 0; i < 600 && d.act?.type === 'visitGather'; i++) updateDoll(d, .05);
        assert.equal(d.act.type, 'visitStay');
      }
      assert.ok(event.exchangeDone);
      endGetTogether();
      finishGuestDeparture();
      assert.equal(G.community.applications.length, 0);
    }
    assert.ok(G.log.some(entry => entry.text.includes('回赠了一盒点心')));
    assert.equal(neighborTie(host).months, 3);
    assert.equal(G.community.neighbor.borrowed, false);
    G.time = 18 * 60;
    assert.ok(startNeighborOuting(host));
    assert.ok(save()); load(); tickNeighborOuting();
    const restored = communityDoll(pid);
    assert.equal(restored.act.type, 'neighborLeave');
    for (let i = 0; i < 600 && restored.state !== 'away'; i++) updateDoll(restored, .05);
    assert.match(awayText(restored), /麦麦家做客/);
    assert.ok(save()); load();
    const visitor = communityDoll(pid);
    G.time += 100;
    tickNeighborOuting();
    assert.equal(visitor.state, 'idle');
    assert.equal(neighborTie(visitor).meals, 1);
    assert.equal(G.community.applications.length, 0);
    for (const day of [4, 5]) {
      G.day = day; G.time = 18 * 60;
      assert.ok(startNeighborOuting(visitor));
      for (let i = 0; i < 600 && visitor.state !== 'away'; i++) updateDoll(visitor, .05);
      G.time += 100; tickNeighborOuting();
    }
    assert.ok(bondTagged(visitor, neighborProfile(), 'meal'));
    assert.equal(G.community.applications[0].pid, NEIGHBOR_PID);
  `);
});

test('rain can reroute a quiet visitor upstairs, keep a picnic outdoors, or postpone it with the same guest', () => {
  for (const plan of ['inside', 'umbrella', 'postpone']) runGame(`
    load();
    G.time = 12 * 60; G.weather = 'sunny';
    const [host, , jing] = G.dolls;
    for (const d of residents()) { d.job = 'none'; d.needs.social = 40; }
    assert.ok(startGetTogether(host, 'picnic'));
    const event = G.community.active;
    const guest = communityDoll(event.guestPid);
    guest.mbti = 'INTJ';
    assert.ok(event.tiles.every(t => t.y >= ROWS));
    G.weather = 'rain'; communityTick();
    assert.ok(event.rainDeadline);
    assert.ok(choosePicnicPlan('${plan}'));
    if ('${plan}' === 'postpone') {
      assert.equal(G.community.deferredPicnic.guestPid, guest.pid);
      assert.ok(save()); load();
      finishGuestDeparture();
      G.time += 360; G.weather = 'sunny';
      assert.ok(resumePicnic());
      assert.equal(G.community.active.guestPid, guest.pid);
      assert.equal(G.community.deferredPicnic, null);
    } else {
      const inside = '${plan}' === 'inside';
      assert.ok(event.tiles.every(t => inside ? t.y < FLOOR_SPLIT : t.y >= ROWS));
      for (const d of inside ? [jing, guest] : [host, guest]) {
        assert.ok(joinGetTogether(d));
        for (let i = 0; i < 720 && d.act?.type === 'visitGather'; i++) updateDoll(d, .05);
        assert.equal(d.act?.theme, inside ? 'quiet' : 'umbrella');
        assert.equal(roomOf(d), inside ? 'study' : 'yard');
      }
      if (inside) {
        assert.ok(event.quietDone);
        assert.ok(G.log.some(entry => entry.text.includes('安静的书房聊熟')));
      }
    }
  `);
});

test('dropping a resident on the piano assigns piano time instead of snapping back', () => {
  runGame(`
    load();
    const [carried] = G.dolls;
    G.dolls = [carried];
    const piano = G.furniture.find(f => f.id === 'piano');
    placeDollAt(carried, 8, 4);
    const rect = houseFurnitureRect(piano);
    const point = { x: rect.x + rect.w / 2, y: (rect.top + rect.bottom) / 2 };
    const from = houseHeadPoint(carried);
    const event = ({ x, y }) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });
    pointer.pointerdown(event({ x: from.x, y: from.y + 6 }));
    pointer.pointermove(event(point));
    assert.equal(carried.state, 'lift');
    pointer.pointerup(event(point));
    assert.equal(carried.act?.furn, piano);
    assert.equal(carried.act?.type, 'piano');
  `, { withView: true });
});

test('buying furniture needs a second click on the same tile before money moves', () => {
  runGame(`
    load();
    G.mode = 'build';
    G.fund = 1000;
    G.build.placing = { id: 'coffee' };
    const tile = { x: 2, y: 15 };
    assert.ok(canPlace('coffee', tile.x, tile.y, null));
    assert.equal(purchasePrice('coffee'), SHOP.coffee[0]);
    const point = { x: HOUSE_X + tile.x * T + 8, y: houseY(tile.y * T + 14, storeyOf(tile.y)) };
    const event = ({ x, y }) => ({ clientX: x, clientY: y, pointerId: 1, button: 0 });
    pointer.pointerdown(event(point));
    assert.equal(G.fund, 1000);
    assert.equal(G.furniture.filter(f => f.id === 'coffee').length, 0);
    assert.deepEqual(G.build.placing.confirm, tile);
    pointer.pointerdown(event(point));
    assert.equal(G.fund, 1000 - SHOP.coffee[0]);
    assert.equal(G.furniture.filter(f => f.id === 'coffee').length, 1);
  `, { withView: true });
});

test('the monthly paper waits while the player is mid-drag', () => {
  runGame(`
    load();
    const dialog = { open: false, showModal() { this.open = true; } };
    const paperAuto = { checked: true };
    const button = { textContent: '' };
    const els = {};
    const fakeEl = () => ({ style: { setProperty() {} }, textContent: '', disabled: false,
      replaceChildren() {}, append() {}, classList: { add() {}, toggle() {} } });
    document.getElementById = id => id === 'paperDialog' ? dialog
      : id === 'paperAuto' ? paperAuto : id === 'dailyPaper' ? button : (els[id] ||= fakeEl());
    document.createElement = () => ({ style: {}, className: '', textContent: '', children: [],
      append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = [...kids]; },
      setAttribute() {}, classList: { add() {}, toggle() {} } });
    G.paper = [{ month: monthLabel(G.day), stories: [{ label: '', icon: '🌙', text: '小屋平静地过了一个月。' }] }];
    press = { pointerId: 1 };
    assert.equal(playerBusy(), true);
    finishHouseMonth();
    assert.equal(G.paperPending, true);
    assert.equal(dialog.open, false);
    assert.match(button.textContent, /新一期/);
    press = null;
    assert.equal(playerBusy(), false);
    showHousePaper();
    assert.equal(dialog.open, true);
    assert.equal(G.paperPending, false);
  `, { withView: true });
});

test('a reading corner follows the same chair through a move and reload', () => {
  runGame(`
    load();
    const d = G.dolls[0];
    const f = addFurniture('chair', 11, 18);
    addFurniture('window', 10, -3);
    assert.equal(cornerKind(f), 'read');
    noteCornerUse(d, f);
    noteCornerUse(d, f);
    assert.equal(cornerOwner(f), undefined);
    G.day++;
    noteCornerUse(d, f);
    assert.equal(cornerOwner(f), d.pid);
    removeFurniture(f);
    G.build.placing = { id: f.id, key: f.key, moved: true, orig: { x: f.x, y: f.y } };
    const snapshot = JSON.parse(JSON.stringify(houseSaveData()));
    assert.ok(snapshot.furniture.some(item => item.key === f.key));
    G.build.placing = null;
    addFurniture(f.id, 12, 18, f);
    applySave(JSON.parse(JSON.stringify(houseSaveData())));
    const moved = G.furniture.find(item => item.key === f.key);
    assert.equal(moved.x, 12);
    assert.equal(cornerOwner(moved), d.pid);
  `, { withView: true });
});

test('a shared project resumes after reload and only finishes once both reach the bench', () => {
  runGame(`
    load();
    const [a, b] = G.dolls;
    const bench = addFurniture('craftBench', 10, 6);
    rebuild();
    const [one, two] = approachTiles(bench);
    placeDollAt(a, one.x, one.y);
    placeDollAt(b, two.x + 1, two.y);
    assert.ok(startKeepsakeProject(a, b, 'sage'));
    arrive(a);
    tickKeepsakes(8);
    assert.equal(G.keepsakes.pieces.length, 0);
    applySave(JSON.parse(JSON.stringify(houseSaveData())));
    const [c, d] = G.dolls;
    tickKeepsakes(0);
    for (const person of [c, d]) {
      const last = person.path.at(-1);
      if (last) placeDollAt(person, last.x, last.y);
      person.path = [];
      arrive(person);
    }
    assert.notEqual(c.tx, d.tx);
    tickKeepsakes(5);
    tickKeepsakes(10);
    const [piece] = G.keepsakes.pieces;
    assert.equal(G.keepsakes.pieces.length, 1);
    assert.equal(piece.finish, 'sage');
    assert.equal(unplacedKeepsakes().length, 1);
    const placed = addFurniture('handmadePlanter', 4, 7, { piece: piece.key });
    assert.equal(unplacedKeepsakes().length, 0);
    applySave(JSON.parse(JSON.stringify(houseSaveData())));
    const saved = G.furniture.find(f => f.key === placed.key);
    assert.equal(saved.piece, piece.key);
    assert.deepEqual(keepsakePiece(saved.piece).makers, [c.name, d.name]);
    G.furniture = G.furniture.filter(f => f !== saved);
    assert.equal(unplacedKeepsakes().length, 1);
  `);
});

test('rainy picnic companions reunite on a later rainy month and both appear in the paper', () => {
  runGame(`
    load();
    const [a, b] = G.dolls;
    noteRainTradition(a, b);
    G.weather = 'rain';
    G.time = 14 * 60;
    tickKeepsakes(1);
    assert.equal(a.act, null);
    G.day++;
    tickKeepsakes(1);
    assert.equal(a.act.type, 'rainTea');
    for (const person of [a, b]) {
      const last = person.path.at(-1);
      if (last) placeDollAt(person, last.x, last.y);
      person.path = [];
      arrive(person);
      assert.equal(roomOf(person), 'study');
    }
    assert.equal(Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty), 1);
    tickKeepsakes(1);
    tickKeepsakes(1);
    assert.equal(G.log.filter(e => e.text.includes('又下雨了')).length, 1);
    finishHouseMonth();
    const story = G.paper.at(-1).stories.find(s => s.label === '两人的小传统');
    assert.ok(story);
    assert.deepEqual(story.people.map(p => p.name), [a.name, b.name]);
  `);
});

test('a rainy tradition invites the same former guest back after a save', () => {
  runGame(`
    load();
    const [host] = G.dolls;
    const friend = { ...newcomerProfile(), name: '老朋友', pid: 'rain-guest', hostPid: host.pid, visits: 1 };
    G.community.friends.push(friend);
    noteRainTradition(host, friend);
    G.day += 2;
    G.weather = 'rain';
    G.time = 15 * 60;
    applySave(JSON.parse(JSON.stringify(houseSaveData())));
    tickKeepsakes(0);
    assert.equal(G.community.active.guestPid, friend.pid);
    assert.equal(G.community.active.hostPid, host.pid);
    tickKeepsakes(0);
    const guest = communityDoll(friend.pid);
    assert.equal(guest.act.type, 'rainTea');
    assert.equal(G.keepsakes.traditions[relKey(host, friend)].last, G.day - 2);
  `);
});

test('starter wardrobe updates once and preserves custom outfits', () => {
  runGame(`
    const old = defaultHouseSave();
    const tao = old.dolls.find(d => d.pid === 'p-tao');
    const jing = old.dolls.find(d => d.pid === 'p-jing');
    tao.look = { ...ORIGINAL_STARTER_LOOKS[tao.pid] };
    jing.look = { ...ORIGINAL_STARTER_LOOKS[jing.pid], shoes: 1 };
    applySave(old);
    assert.equal(communityDoll(tao.pid).look.top, 'dress');
    assert.equal(communityDoll(jing.pid).look.top, 'suit');
    assert.equal(communityDoll(jing.pid).look.shoes, 1);
    const saved = JSON.parse(JSON.stringify(houseSaveData()));
    saved.dolls.find(d => d.pid === tao.pid).look = { ...ORIGINAL_STARTER_LOOKS[tao.pid] };
    applySave(saved);
    assert.equal(communityDoll(tao.pid).look.top, 'tee');
  `);
});
