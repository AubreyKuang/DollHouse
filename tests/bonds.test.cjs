const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
function load(extra = {}) {
  const logs = [], toasts = [];
  const G = { dolls: [], rel: {}, daily: {}, log: [], day: 5, trust: {}, jealousy: {} };
  const ctx = vm.createContext({
    G, Math, JSON, Object, String, setTimeout: () => {},
    HOOK: { toast: t => toasts.push(t) }, addLog: t => { logs.push(t); G.log.push({ d: G.day, text: t }); },
    absNow: () => 1000, say: () => {}, pick: list => list[0],
    roomOf: d => d.room || 'living', arePartners: () => false,
    FLOOR_SPLIT: 10, BX: 8, BATH_X: 4,
    ...extra,
  });
  vm.runInContext(read('js/npc-memory.js'), ctx);
  vm.runInContext(read('js/calendar.js'), ctx);
  vm.runInContext(`
    function relKey(a,b){return a.pid<b.pid?a.pid+'|'+b.pid:b.pid+'|'+a.pid;}
    function rel(a,b){const k=relKey(a,b);return G.rel[k]||(G.rel[k]={f:20,l:0,lovers:false});}
  `, ctx);
  vm.runInContext(read('js/bonds.js'), ctx);
  for (const name of ['bondTagged', 'canDisturb', 'inPrivateRoom', 'NPCMemory']) ctx[name] = vm.runInContext(name, ctx);
  const doll = (pid, name, more = {}) => { const d = { pid, name, persona: 'normal', state: 'idle', needs: { fun: 50 }, ...more }; G.dolls.push(d); return d; };
  return { G, ctx, logs, toasts, doll };
}

test('playing games together three times makes gaming buddies with mutual trust and a shared memory', () => {
  const { G, ctx, toasts, doll } = load();
  const a = doll('a', '阿懒'), b = doll('b', '团子');
  ctx.countTogether('game', a, b); ctx.countTogether('game', a, b);
  assert.equal(ctx.bondTagged(a, b, 'game'), false);
  ctx.countTogether('game', b, a);
  assert.equal(ctx.bondTagged(a, b, 'game'), true);
  assert.match(ctx.bondTagsText(ctx.rel(a, b)), /游戏搭子/);
  assert.ok(ctx.trustOf(a, b) > 0 && ctx.trustOf(b, a) > 0);
  assert.match(toasts[0], /游戏搭子/);
  assert.ok(ctx.NPCMemory.recall(G, 'a').some(m => /游戏搭子/.test(m.interpretation)));
  ctx.countTogether('game', a, b);
  assert.equal(toasts.length, 1);
});

test('a misheard rumor blames someone else and lowers the listener trust in that person', () => {
  const { G, ctx, doll } = load();
  const speaker = doll('s', '眼镜君'), listener = doll('l', '团子'), subject = doll('x', '阿懒'), other = doll('o', '小桃');
  const wrong = ctx.misheardRumor(speaker, listener, { subject: 'x', interpretation: '我看到阿懒和小桃争吵' });
  assert.equal(wrong.wrong, other);
  assert.match(wrong.interpretation, /小桃/);
  assert.ok(ctx.trustOf(listener, other) < 0);
  assert.equal(ctx.trustOf(listener, subject), 0);
  assert.equal(G.daily.rumor, 1);
  assert.equal(G.daily.rumorWrong, 1);
});

test('trust and jealousy are one-way and jealousy fades', () => {
  const { G, ctx, doll } = load();
  const a = doll('a', '阿懒'), b = doll('b', '团子');
  ctx.addTrust(a, b, -20); ctx.addJealousy(a, b, 30);
  assert.equal(ctx.trustOf(b, a), 0);
  assert.equal(ctx.trustWord(ctx.trustOf(a, b)), '不太信任');
  ctx.bondsTick(1000);
  assert.equal(ctx.jealousyOf(a, b), 0);
  assert.equal(Object.keys(G.jealousy).length, 0);
});

test('people in a private bedroom are left alone unless you share the room or are partners', () => {
  const { ctx, doll } = load();
  const reader = doll('r', '阿懒', { room: 'bed' }), visitor = doll('v', '团子', { room: 'living' }), roommate = doll('m', '小桃', { room: 'bed' });
  assert.equal(ctx.canDisturb(visitor, reader), false);
  assert.equal(ctx.canDisturb(roommate, reader), true);
  assert.equal(ctx.canDisturb(reader, visitor), true);
});

test('vain residents get a stable trait and a strong pull toward the mirror', () => {
  const { ctx, doll } = load();
  const vain = doll('v', '小桃', { vain: true }), plain = doll('p', '阿懒', { vain: false });
  assert.ok(ctx.groomBonus(vain) > ctx.groomBonus(plain));
  const fresh = doll('abc', '新人', { persona: 'romantic' });
  const first = ctx.isVain(fresh);
  assert.equal(ctx.isVain(fresh), first);
  assert.equal(typeof fresh.vain, 'boolean');
});

test('monthly highlights pick a new hobby and the piano crowd while keeping simulation snapshots', () => {
  const { G, ctx, doll } = load();
  const a = doll('a', '阿懒'), b = doll('b', '团子');
  G.dayTrust = {}; G.lastDaily = { study: { 阿懒: 1 } };
  G.daily = { study: { 阿懒: 4 }, social: { '阿懒 × 团子': 3 }, crowdMax: { name: '团子', count: 4 }, rumor: 2, rumorWrong: 1 };
  ctx.addTrust(b, a, -12);
  G.log.push({ d: 5, text: '💕 阿懒 和 团子 在一起了！' });
  const highlights = ctx.housePaperExtras();
  assert.equal(highlights.length, 2);
  assert.match(highlights[0].text, /阿懒 本月迷上了使用书桌/);
  assert.match(highlights[1].text, /团子 一弹琴，就有 4 位住户围了过来/);
  assert.equal(G.lastDaily.study.阿懒, 4);
  assert.equal(G.dayTrust['b>a'], -12);
});

test('save manager v2 migrates v1 saves, rejects newer versions and keeps month snapshots', () => {
  const ctx = vm.createContext({ JSON, Date });
  vm.runInContext(read('js/save-manager.js'), ctx);
  const SaveManager = vm.runInContext('SaveManager', ctx);
  const map = new Map(), storage = { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  const valid = s => Array.isArray(s.furniture) && Array.isArray(s.dolls);
  map.set('house', JSON.stringify({ furniture: [], dolls: [], day: 3, saveVersion: 1 }));
  const loaded = SaveManager.load(storage, 'house', valid, (s, from) => ({ ...s, trust: {}, migratedFrom: from }));
  assert.equal(loaded.migratedFrom, 1);
  assert.equal(JSON.stringify(loaded.trust), '{}');
  map.set('house', JSON.stringify({ furniture: [], dolls: [], saveVersion: 9 }));
  assert.equal(SaveManager.load(storage, 'house', valid), null);
  assert.equal(SaveManager.save(storage, 'house', { furniture: [], dolls: [] }, valid), false);
  assert.equal(JSON.parse(map.get('house')).saveVersion, 9);
  map.set('house', JSON.stringify({ furniture: [], dolls: [], saveVersion: 2 }));
  SaveManager.load(storage, 'house', valid, undefined, true);
  for (let day = 1; day <= 6; day++) assert.ok(SaveManager.snapshot(storage, 'house', { furniture: [], dolls: [], day }, valid, { label: 'm-' + day, day }));
  const list = SaveManager.snapshots(storage, 'house');
  assert.equal(JSON.stringify(list.map(s => s.day)), '[3,4,5,6]');
  assert.equal(SaveManager.restore(storage, 'house', 0, valid).day, 3);
});
