const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
// Integer-pixel canvas for deterministic sprite regressions; no browser/native dependency.
function raster(width = 40, height = 40) {
  const pixels = Array(width * height).fill(''), stack = [];
  let sx = 1, sy = 1, tx = 0, ty = 0;
  return {
    pixels, outside: [], fillStyle: '',
    save() { stack.push([sx, sy, tx, ty, this.fillStyle]); },
    restore() { [sx, sy, tx, ty, this.fillStyle] = stack.pop(); },
    translate(x, y) { tx += sx * x; ty += sy * y; },
    scale(x, y) { sx *= x; sy *= y; },
    fillRect(x, y, w, h) {
      const a = tx + x * sx, b = ty + y * sy;
      const left = Math.min(a, a + w * sx), top = Math.min(b, b + h * sy);
      for (let yy = top; yy < top + Math.abs(h * sy); yy++) for (let xx = left; xx < left + Math.abs(w * sx); xx++) {
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) this.outside.push([xx, yy]);
        else pixels[yy * width + xx] = this.fillStyle;
      }
    },
    clearRect() { pixels.fill(''); },
  };
}

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex');
function game(code, ui = false) {
  const storage = new Map();
  const ctx = vm.createContext({ assert, raster, hash, setTimeout() {}, clearTimeout() {}, window: { addEventListener() {} },
    document: { body: { dataset: {} }, getElementById: () => ({}) },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
  });
  for (const [,file] of read('index.html').matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) {
    if (file === 'js/view.js') break;
    vm.runInContext(read(file), ctx, { filename: file });
  }
  vm.runInContext('HOOK.resize = () => {}; load(); rebuild();', ctx);
  if (ui) {
    ctx.ids = [...read('index.html').matchAll(/id="([^"]+)"/g)].map(m => m[1]);
    vm.runInContext(`
      function node(tag) {
        const n = { tag, children: [], attributes: {}, style: {}, dataset: {}, scrollTop: 0, width: 20, height: 24,
          classList: {add(){}}, addEventListener(){}, setAttribute(k,v){this.attributes[k]=v},
          append(...a){this.children.push(...a)}, prepend(a){this.children.unshift(a)}, getContext(){return raster()},
          click(){if(!this.disabled)this.onclick?.()}, set innerHTML(v){this.children=[]}, get innerHTML(){return ''} };
        return n;
      }
      const nodes = new Map(ids.map(id=>['#'+id,node('div')]));
      nodes.set('.wd-body',node('div'));
      const dirs=['left','down','right','up'].map(dir=>Object.assign(node('button'),{dataset:{dir}}));
      const pages=['look','profile'].map(wdPage=>Object.assign(node('button'),{dataset:{wdPage}}));
      const $=s=>{assert.ok(nodes.has(s),'existing element '+s);return nodes.get(s)};
      const el=(tag,cls,text)=>Object.assign(node(tag),{className:cls,textContent:text});
      document.querySelector=$; document.querySelectorAll=s=>s==='.wd-dir button'?dirs:s==='[data-wd-page]'?pages:[];
      document.createElement=node; const esc=s=>s; SFX.play=()=>{};
    `, ctx);
    const section = read('js/ui.js').split('/* ---------- 衣橱 ---------- */')[1].split('/* ---------- 串门、派对与入住 ---------- */')[0];
    vm.runInContext(section, ctx, { filename: 'wardrobe-ui' });
  }
  vm.runInContext(code, ctx);
}

test('384 original resident animation frames remain pixel-identical', () => game(`
  const expected = {
    'p-tao':'c20844cd2d89325fe83061883b5e58479160229db131435aed252eed3db32a00',
    'p-lan':'e1a04d7d1ee09a44ce872b988bdfec4892413b55fdf046162262218297eb0b1f',
    'p-jing':'705b8f1b844f521a3852bd7d1727f09e260923a6cd71f30a08532b7565b38721',
    'p-tuan':'3c1851cddf42fe48391646d15dcd22a736aa6e2e13fafefa3a89144f337b50d5',
  };
  for (const d of DEFAULT_SAVE.dolls) {
    const frames=[];
    for(const dir of ['down','left','right','up']) for(const pose of ['stand','walk','sit','lift','dance','head']) for(let frame=0;frame<4;frame++) {
      const c=raster(); drawDoll(c,20,30,d.look,{dir,pose,frame,happy:true}); frames.push(c.pixels);
    }
    assert.equal(hash(JSON.stringify(frames)),expected[d.pid],d.name);
  }
`));

test('every new hair has distinct front, side and back silhouettes and stays inside portraits', () => game(`
  const base={...DEFAULT_SAVE.dolls[0].look,acc:'none',hairColor:1};
  for(const view of ['down','right','up']) {
    const seen=new Set();
    for(const hair of Object.keys(OUTFIT.hair).slice(6)) {
      assert.ok(HAIR[view][hair],view+' '+hair);
      const c=raster(); drawDoll(c,20,30,{...base,hair},{dir:view});
      const signature=hash(JSON.stringify(c.pixels)); assert.ok(!seen.has(signature),view+' '+hair); seen.add(signature);
    }
  }
  for(const hair of Object.keys(OUTFIT.hair)) for(const acc of Object.keys(OUTFIT.acc)) for(const dir of ['down','left','right','up']) {
    // The DOM portrait is 20 by 28 logical pixels, including headroom for hats.
    const c=raster(20,28);drawDoll(c,10,27,{...base,hair,acc},{dir,happy:true});
    assert.equal(c.outside.length,0,hair+' '+acc+' '+dir);
  }
`));

test('clothing and accessories render visibly in four directions and all activity poses', () => game(`
  const base={...DEFAULT_SAVE.dolls[0].look,hair:'pixie',acc:'none',extra:'none',topColor:12,bottomColor:14};
  for(const key of ['top','bottom','acc','extra','shoeStyle']) for(const value of Object.keys(OUTFIT[key])) {
    let visible=false;
    for(const dir of ['down','left','right','up']) for(const pose of ['stand','walk','sit','lift','dance','head']) {
      const c=raster(),old=raster();const opts={dir,pose,frame:1};
      drawDoll(c,20,30,{...base,[key]:value},opts);drawDoll(old,20,30,base,opts);
      assert.equal(c.outside.length,0,key+' '+value+' '+pose);
      if(hash(JSON.stringify(c.pixels))!==hash(JSON.stringify(old.pixels)))visible=true;
    }
    if(value!==(base[key]??'classic'))assert.ok(visible,key+' '+value+' must visibly change the doll');
  }
`));

test('outfit changes retain identity and all presets are complete valid clothing combinations', () => game(`
  const before={...DEFAULT_SAVE.dolls[0].look}, copy=JSON.stringify(before);
  for(const set of OUTFIT_SETS) {
    const look=wearOutfit(before,set.id);
    for(const key of ['skin','hair','hairColor'])assert.equal(look[key],before[key]);
    for(const [key,value] of Object.entries(look)) {
      const options=OUTFIT[{topColor:'clothColor',bottomColor:'clothColor'}[key]||key];
      assert.ok(Array.isArray(options)?options[value]:Object.hasOwn(options,value),key);
    }
  }
  assert.equal(JSON.stringify(before),copy,'presets never mutate the original look');
  assert.equal(JSON.stringify(wearOutfit(before,'unknown')),copy);
`));

test('random newcomers use harmonious preset palettes and can access every hair and clothing style', () => game(`
  let seed=109; Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  const seen={hair:new Set(),top:new Set(),bottom:new Set(),acc:new Set()};
  for(let i=0;i<3000;i++){
    const look=randomLook();
    for(const key of Object.keys(seen))seen[key].add(look[key]);
    for(const [key,value] of Object.entries(look)){const options=OUTFIT[{topColor:'clothColor',bottomColor:'clothColor'}[key]||key];assert.ok(Array.isArray(options)?options[value]:Object.hasOwn(options,value),key);}
    assert.ok(OUTFIT_SETS.some(s=>s.look.topColor===look.topColor&&s.look.bottomColor===look.bottomColor&&s.look.shoes===look.shoes));
  }
  for(const key of Object.keys(seen))assert.equal(seen[key].size,Object.keys(OUTFIT[key]).length,key);
`));

test('new appearance survives saving and keeps the old appearance in an album photo', () => game(`
  const d=residents()[0], old={...d.look};
  G.home.album.push({id:'wardrobe-photo',kind:'supper',title:'一起吃饭',text:'晚饭',month:1,weather:'sunny',people:[{pid:d.pid,name:d.name,look:{...old}}],favorite:false});
  d.look={...wearOutfit(d.look,'trail'),hair:'braids',hairColor:13};
  const updated=JSON.stringify(d.look);save();load();
  assert.equal(JSON.stringify(residents()[0].look),updated);
  assert.equal(JSON.stringify(G.home.album[0].people[0].look),JSON.stringify(old));
`));

test('wardrobe presets, direction, poses and per-resident undo work through their actual buttons', () => game(`
  const [a,b]=residents(), original=JSON.stringify(a.look), second=JSON.stringify(b.look);
  openWardrobe(a.uid);
  assert.equal($('#wdOptions').children[0].children[1].children.length,12);
  $('#wdOptions').children[0].children[1].children[9].click();
  assert.equal(a.look.top,'pinafore');assert.equal(a.look.hair,'twin');
  assert.equal($('#wdUndo').disabled,false);
  dirs[2].click();assert.equal(wdDir,'right');assert.equal(dirs[2].attributes['aria-pressed'],'true');
  $('#wdPose').onchange({target:{value:'sit'}});assert.equal(wdPose,'sit');
  $('#wdTabs').children[1].click();$('#wdShuffle').click();
  assert.notEqual(JSON.stringify(b.look),second);
  $('#wdUndo').click();assert.equal(JSON.stringify(b.look),second);
  $('#wdTabs').children[0].click();$('#wdUndo').click();assert.equal(JSON.stringify(a.look),original);
  pages[1].click();assert.equal($('#wdOptions').children[0].children[0].textContent,'性格');
  pages[0].click();assert.ok($('#wdOptions').children[0].children[0].textContent.includes('今日穿什么'));
  closeWardrobe();assert.equal($('#wardrobe').hidden,true);
`, true));
