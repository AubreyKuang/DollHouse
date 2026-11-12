const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function runGame(scenario, { mode, data = new Map() } = {}) {
  const context = vm.createContext({
    assert, setTimeout() {}, document: { body: { dataset: { mode } }, getElementById: () => null },
    localStorage: { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
  });
  for (const [, script] of read('index.html').matchAll(/<script src="([^"]+)"/g)) {
    if (script === 'js/view.js') break;
    vm.runInContext(read(script), context, { filename: script });
  }
  vm.runInContext('HOOK.resize = () => {}', context);
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
    assert.match(G.paper[0], /^1 年 12 月/);
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
