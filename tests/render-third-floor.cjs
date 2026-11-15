// Render the actual game scene for the README. Requires @napi-rs/canvas.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
process.chdir(path.join(__dirname, '..'));
const { createCanvas } = require(process.env.DOLLHOUSE_CANVAS_MODULE || '@napi-rs/canvas');
const elements = {}, storage = new Map();
function element(tag) {
  return Object.assign(tag === 'canvas' ? createCanvas(460, 404) : {}, {
    style: { setProperty() {} }, children: [], clientWidth: 460, offsetWidth: 40,
    append(...children) { this.children.push(...children); },
    remove() {}, querySelectorAll() { return []; }, setAttribute() {},
    addEventListener() {}, setPointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; },
  });
}
const context = vm.createContext({
  assert, console, setTimeout() {}, window: { addEventListener() {} },
  document: { body: { dataset: { mode: 'test' } },
    createElement: element, getElementById: id => elements[id] ??= element(id === 'cv' ? 'canvas' : 'div') },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
  capture: (canvas, file) => fs.writeFileSync(file, canvas.toBuffer('image/png')),
});
for (const [, script] of fs.readFileSync('index.html', 'utf8').matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) {
  if (script === 'js/ui.js') break;
  vm.runInContext(fs.readFileSync(script, 'utf8'), context, { filename: script });
}
vm.runInContext(`
  load(); rebuild(); G.time=10*60; G.t=1.2; G.weather='sunny'; G.sky='#a9d2e9'; G.dark=0; G.night=false;
  const spots=[[11,29],[16,28],[10,17],[11,9]];
  residents().forEach((d,i)=>{
    const spot=nearestFree(...spots[i]);placeDollAt(d,spot.x,spot.y);
    d.dir=i%2?'left':'right';d.state='idle';d.act=null;d.path=[];d.bubble=null;
  });
  assert.equal(G.level,4);assert.equal(STOREYS.length,3);
  render(); capture(cv,'docs/third-floor.png');
`, context);
console.log('Rendered docs/third-floor.png from the actual game canvas');
