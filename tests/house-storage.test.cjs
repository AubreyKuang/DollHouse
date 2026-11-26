// In-app WebViews (TapTap H5 among them) may lack localStorage or refuse its writes.
// The house then moves to the host's key-value storage after a probe; with nowhere
// to save, the game is still playable for the visit.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/house-storage.js'), 'utf8');

// TapTap documents 1MB per key and 10MB in total for tap.setStorageSync. Values are
// kept as UTF-8, so a lone surrogate would come back as U+FFFD.
function fakeTap({perKey = 1024 * 1024, total = 10 * 1024 * 1024} = {}) {
  const data = new Map(), bytes = v => Buffer.byteLength(String(v));
  const used = () => { let n = 0; for (const [k, v] of data) n += bytes(k) + bytes(v); return n; };
  return {data,
    getStorageSync: key => data.has(key) ? data.get(key) : '',
    setStorageSync(key, value) {
      if (bytes(value) > perKey) throw Object.assign(new Error('setStorageSync:fail exceed max size'), {errMsg: 'setStorageSync:fail exceed max size'});
      const old = data.has(key) ? bytes(key) + bytes(data.get(key)) : 0;
      if (used() - old + bytes(key) + bytes(value) > total) throw Object.assign(new Error('setStorageSync:fail storage full'), {errMsg: 'setStorageSync:fail storage full'});
      data.set(key, Buffer.from(String(value), 'utf8').toString('utf8'));
    },
    removeStorageSync: key => { data.delete(key); }};
}
function memoryLocal(initial = []) {
  const data = new Map(initial);
  return {data, getItem: k => data.has(k) ? data.get(k) : null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: k => { data.delete(k); }};
}
function load(globals) {
  const context = vm.createContext({console: {...console, warn() {}}, ...globals});
  vm.runInContext(source, context);
  return vm.runInContext('HouseStorage', context);
}
const chunkKeys = (tap, key) => [...tap.data.keys()].filter(k => k.startsWith(key + '#'));

test('in a browser the save stays in the real localStorage object', () => {
  const localStorage = memoryLocal();
  const store = load({localStorage});
  assert.equal(store.kind, 'local');
  assert.equal(store.storage, localStorage, 'a second tab still sees the same object change');
  assert.deepEqual([...localStorage.data.keys()], [], 'the probe leaves nothing behind');
});

test('inside TapTap the save goes to tap storage and survives a restart', () => {
  const tap = fakeTap();
  const store = load({tap, localStorage: memoryLocal()});
  assert.equal(store.kind, 'tap');
  store.storage.setItem('pixel-dollhouse-v1', '{"day":3}');
  assert.equal(store.storage.getItem('pixel-dollhouse-v1'), '{"day":3}');
  assert.equal(store.storage.getItem('missing'), null);
  const again = load({tap});
  assert.equal(again.kind, 'tap');
  assert.equal(again.storage.getItem('pixel-dollhouse-v1'), '{"day":3}');
  again.storage.removeItem('pixel-dollhouse-v1');
  assert.equal(load({tap}).storage.getItem('pixel-dollhouse-v1'), null);
  assert.deepEqual(chunkKeys(tap, 'pixel-dollhouse-v1'), [], 'removing a value releases its chunks');
});

test('a save larger than one TapTap key is chunked and read back exactly, emoji included', () => {
  const tap = fakeTap(), {storage, CHUNK} = load({tap});
  // Put a surrogate pair right across the chunk boundary.
  const long = 'a'.repeat(CHUNK - 1) + '🏠' + '小屋里的一天，💔分手又和好。'.repeat(60000);
  storage.setItem('pixel-dollhouse-v1', long);
  assert.ok(chunkKeys(tap, 'pixel-dollhouse-v1').length > 1, 'the save should span several keys');
  for (const value of tap.data.values()) assert.ok(Buffer.byteLength(value) <= 1024 * 1024);
  assert.equal(load({tap}).storage.getItem('pixel-dollhouse-v1'), long);
  storage.setItem('pixel-dollhouse-v1', 'short');
  assert.equal(chunkKeys(tap, 'pixel-dollhouse-v1').length, 1, 'chunks of the replaced copy are released');
  assert.equal(load({tap}).storage.getItem('pixel-dollhouse-v1'), 'short');
  storage.setItem('empty', '');
  assert.equal(load({tap}).storage.getItem('empty'), '');
});

test('a full TapTap store keeps the save it had and throws like a full localStorage', () => {
  const tap = fakeTap({total: 400000}), {storage} = load({tap});
  storage.setItem('pixel-dollhouse-v1', 'first');
  assert.throws(() => storage.setItem('pixel-dollhouse-v1', 'x'.repeat(500000)), /storage full/);
  assert.equal(storage.getItem('pixel-dollhouse-v1'), 'first');
  assert.equal(load({tap}).storage.getItem('pixel-dollhouse-v1'), 'first');
  assert.equal(chunkKeys(tap, 'pixel-dollhouse-v1').length, 1, 'no half-written copy is left');
});

test('a TapTap store that refuses writes falls through to localStorage', () => {
  const tap = fakeTap(); tap.setStorageSync = () => { throw new Error('setStorageSync:fail'); };
  const localStorage = memoryLocal();
  assert.equal(load({tap, localStorage}).kind, 'local');
  const forgetful = fakeTap(); forgetful.getStorageSync = () => '';
  assert.equal(load({tap: forgetful, localStorage}).kind, 'local', 'a store that does not read back is skipped');
});

test('with no store that reads back, the house is kept for this visit only', () => {
  const localStorage = memoryLocal(); localStorage.getItem = () => null;
  const store = load({localStorage});
  assert.equal(store.kind, 'memory');
  store.storage.setItem('pixel-dollhouse-v1', '{}');
  assert.equal(store.storage.getItem('pixel-dollhouse-v1'), '{}');
  assert.equal(load({localStorage}).storage.getItem('pixel-dollhouse-v1'), null);
  const denied = {};
  Object.defineProperty(denied, 'localStorage', {get() { throw new Error('SecurityError'); }});
  const context = vm.createContext({console: {warn() {}}});
  Object.defineProperty(context, 'localStorage', {get() { throw new Error('SecurityError'); }});
  vm.runInContext(source, context);
  assert.equal(vm.runInContext('HouseStorage.kind', context), 'memory');
});

test('a house a browser visit left behind moves into tap storage once', () => {
  const tap = fakeTap(), localStorage = memoryLocal([
    ['pixel-dollhouse-v1', '{"day":9}'], ['pixel-dollhouse-v1:snapshots', '[]'], ['house-offline', 'off'], ['unrelated', 'x']]);
  const {storage} = load({tap, localStorage});
  assert.equal(storage.getItem('pixel-dollhouse-v1'), '{"day":9}');
  assert.equal(storage.getItem('house-offline'), 'off');
  assert.equal(storage.getItem('unrelated'), null);
  storage.removeItem('house-offline');
  assert.equal(load({tap, localStorage}).storage.getItem('house-offline'), null, 'the copy is not repeated');
  assert.ok(localStorage.data.has('pixel-dollhouse-v1'), 'the browser copy is left alone');
});

// The game's own scripts, as index.html loads them, with only the given storage.
function game(globals) {
  const ctx = vm.createContext({console: {...console, warn() {}}, setTimeout() {},
    document: {body: {dataset: {}}, getElementById: () => ({})}, ...globals});
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, script] of html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) {
    if (script === 'js/view.js') break;
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), ctx, {filename: script});
  }
  vm.runInContext('HOOK.resize = () => {}; load(); rebuild();', ctx);
  return code => vm.runInContext(code, ctx);
}

test('the house, its backup and month snapshots come back after restarting inside the host', () => {
  const tap = fakeTap(), first = game({tap});
  assert.equal(first('HouseStorage.kind'), 'tap');
  assert.equal(first('TapTapHost.inHost'), true);
  first('G.day = 5; G.fund = 1234; G.dolls[0].name = "小满";');
  assert.equal(first('save()'), true);
  first('G.fund = 4321;');
  assert.equal(first('save()'), true);
  first('snapshotHouseMonth()');
  assert.ok(tap.data.has('pixel-dollhouse-v1:backup'));
  const second = game({tap});
  assert.equal(second('G.day'), 5);
  assert.equal(second('G.fund'), 4321);
  assert.equal(second('G.dolls[0].name'), '小满');
  assert.equal(second('SaveManager.status(SaveManager.getStorage(), SAVE_KEY)'), 'ready');
  assert.ok(second('SaveManager.snapshots(SaveManager.getStorage(), SAVE_KEY).length') >= 1);
  assert.equal(second('offlineEnabled()'), true);
});

test('with nowhere to save, the house still runs and saving reports success for the visit', () => {
  const play = game({});
  assert.equal(play('HouseStorage.kind'), 'memory');
  assert.equal(play('save()'), true);
  assert.equal(play('typeof TapTapHost.inHost'), 'boolean');
});
