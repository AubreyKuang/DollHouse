const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'taptap.js'), 'utf8');
function run(globals) {
  const classes = new Set(), listeners = {};
  const context = vm.createContext({document: {documentElement: {classList: {add: c => classes.add(c)}}},
    addEventListener: (name, fn) => { listeners[name] = fn; }, ...globals});
  vm.runInContext(source, context);
  return {context, classes, listeners, host: vm.runInContext('TapTapHost', context)};
}

test('outside TapTap the module stays inert', () => {
  const {host, classes} = run({});
  assert.equal(host.inHost, false); assert.equal(classes.size, 0);
});

test('inside TapTap the page is marked, without logging in or sending anything', () => {
  const calls = [];
  const tap = {setStorageSync() {}, getStorageSync() {}, login() { calls.push('login'); }};
  const {host, classes} = run({tap});
  assert.equal(host.inHost, true); assert.ok(classes.has('taptap-host'));
  assert.deepEqual(calls, [], 'tap.login is never called');
  assert.doesNotMatch(source, /\.login\(|fetch\(|XMLHttpRequest|sendBeacon/);
});

test('a host injected after the scripts ran is picked up on load', () => {
  const {context, host, classes, listeners} = run({});
  context.tap = {getSystemInfoSync() {}};
  listeners.load();
  assert.equal(host.inHost, true); assert.ok(classes.has('taptap-host'));
});

test('the game makes no network requests and loads nothing from outside the package', () => {
  const root = path.join(__dirname, '..');
  const files = ['index.html', 'style.css', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)];
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource|@import|tap\.login\(/, file);
    assert.doesNotMatch(text, /(?:src|href)\s*=\s*["']?(?:https?:)?\/\//, file);
    assert.doesNotMatch(text, /url\(\s*["']?(?:https?:)?\/\//, file);
  }
});

/* ---------- rewarded video ---------- */
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function fakeVideo({loaded = true, loadFails = false} = {}) {
  const video = {calls: [], created: 0,
    onClose(fn) { video.close = fn; }, onError(fn) { video.error = fn; },
    show() { video.calls.push('show'); return loaded ? Promise.resolve() : Promise.reject(new Error('not loaded')); },
    load() { video.calls.push('load'); if (loadFails) return Promise.reject(new Error('no fill')); loaded = true; return Promise.resolve(); }};
  const tap = {setStorageSync() {}, createRewardedVideoAd(options) { video.created++; video.options = options; return video; }};
  return {video, tap};
}
function runAds(globals, unitId = 'unit-1') {
  const withId = source.replace("const AD_UNIT_ID = '';", `const AD_UNIT_ID = '${unitId}';`);
  assert.equal(source.split("const AD_UNIT_ID = '';").length, 2, 'the ad unit id is one constant in js/taptap.js');
  const context = vm.createContext({document: {documentElement: {classList: {add() {}}}}, addEventListener() {}, ...globals});
  vm.runInContext(unitId ? withId : source, context);
  return vm.runInContext('TapTapAds', context);
}

test('without an ad unit id, or outside TapTap, no ad is offered', () => {
  const {tap, video} = fakeVideo();
  assert.equal(runAds({tap}, '').available, false, 'no id');
  assert.equal(runAds({}).available, false, 'no host');
  assert.equal(runAds({tap: {setStorageSync() {}}}).available, false, 'host without the ad API');
  const results = [];
  runAds({tap}, '').show(r => results.push(r));
  assert.deepEqual(results, ['none']); assert.equal(video.created, 0);
});

test('a video watched to the end is rewarded once; one closed early is not', async () => {
  const {tap, video} = fakeVideo();
  const ads = runAds({tap}), results = [];
  assert.equal(ads.available, true);
  ads.show(r => results.push(r)); await tick();
  assert.equal(video.options.adUnitId, 'unit-1');
  assert.equal(ads.busy, true);
  assert.equal(ads.show(r => results.push('second ' + r)), false, 'a second request while one is open is ignored');
  video.close({isEnded: true}); video.close({isEnded: true});
  assert.deepEqual(results, ['watched']); assert.equal(ads.busy, false);
  ads.show(r => results.push(r)); await tick(); video.close({isEnded: false});
  ads.show(r => results.push(r)); await tick(); video.close(undefined);
  assert.deepEqual(results, ['watched', 'closed', 'closed']);
  assert.equal(video.created, 1, 'the host keeps one instance; it is reused');
});

test('a video that is not loaded yet is loaded once and then played', async () => {
  const {tap, video} = fakeVideo({loaded: false});
  const results = [];
  runAds({tap}).show(r => results.push(r)); await tick(); await tick();
  assert.deepEqual(video.calls, ['show', 'load', 'show']);
  video.close({isEnded: true});
  assert.deepEqual(results, ['watched']);
});

test('no fill, a broken video or a throwing host end with no reward and leave the game usable', async () => {
  const empty = fakeVideo({loaded: false, loadFails: true}), results = [];
  const ads = runAds({tap: empty.tap});
  ads.show(r => results.push(r)); await tick(); await tick();
  assert.deepEqual(results, ['none']); assert.equal(ads.busy, false);

  const broken = fakeVideo(), ads2 = runAds({tap: broken.tap});
  ads2.show(r => results.push(r)); await tick(); await tick();
  broken.video.error({errCode: 1});
  assert.deepEqual(results, ['none', 'none']); assert.equal(ads2.busy, false);

  const ads3 = runAds({tap: {createRewardedVideoAd() { throw new Error('host'); }}});
  ads3.show(r => results.push(r));
  assert.deepEqual(results, ['none', 'none', 'none']);
});

test('the shipped source has no ad unit id until ads are opened for the game', () => {
  assert.match(source, /const AD_UNIT_ID = '';/);
});
