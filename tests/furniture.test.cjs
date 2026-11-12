const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function runGame(scenario) {
  const data = new Map();
  const context = vm.createContext({
    assert, setTimeout() {}, document: { getElementById: () => null },
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
