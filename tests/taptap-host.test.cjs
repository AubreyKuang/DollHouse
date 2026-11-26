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
