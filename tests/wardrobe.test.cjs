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
      const pages=['look','profile','presets'].map(wdPage=>Object.assign(node('button'),{dataset:{wdPage}}));
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

test('160 original front/back frames retain the original pixel appearance', () => game(`
  const expected = {
    'p-tao':'f0b307ae13f7835f3b5f47b2ec4f0b4517ee0b1f948d7e5c52be0e590bae31a9',
    'p-lan':'7482238ff6b1ffad705f131a98493cadbc465e8ff93971ebc7d449eb0b89c353',
    'p-jing':'720760f2795e0207259af587d0a8670c3dfc89aecc4cb0c4876c72d768cbd315',
    'p-tuan':'4adc7fb0e398c9af3696811650aecf6a69061ee0094e285396a564636004b626',
  };
  for (const d of DEFAULT_SAVE.dolls) {
    const frames=[];
    for(const dir of ['down','up']) for(const pose of ['stand','walk','sit','lift','dance']) for(let frame=0;frame<4;frame++) {
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

test('24 resident presets have valid complete looks and distinct rendered identities in every direction', () => game(`
  assert.equal(RESIDENT_LOOK_SETS.length,24);
  for(const gender of ['f','m'])assert.equal(RESIDENT_LOOK_SETS.filter(s=>s.gender===gender).length,12);
  for(const dir of ['down','right','up']) {
    const seen=new Set();
    for(const set of RESIDENT_LOOK_SETS){
      const look={...set.look,skin:0}; // Skin alone must never distinguish two templates.
      for(const [key,value] of Object.entries(look)){const options=OUTFIT[{topColor:'clothColor',bottomColor:'clothColor'}[key]||key];assert.ok(Array.isArray(options)?options[value]:Object.hasOwn(options,value),set.id+' '+key);}
      const c=raster();drawDoll(c,20,30,look,{dir});
      const signature=hash(JSON.stringify(c.pixels));assert.ok(!seen.has(signature),set.id+' '+dir);seen.add(signature);
      assert.equal(c.outside.length,0,set.id+' '+dir);
    }
  }
`));

test('newcomer generation chooses gender first and avoids residents and returning friends under repeated RNG', () => game(`
  const original=JSON.stringify(G.dolls.map(d=>d.look));
  const matchPool=p=>RESIDENT_LOOK_SETS.some(s=>s.gender===p.gender && s.hairTones.includes(p.look.hairColor) && Object.entries(s.look).every(([k,v])=>['skin','hairColor'].includes(k)||p.look[k]===v));
  for(const roll of [0,.99]){
    Math.random=()=>roll;
    for(let i=0;i<8;i++){
      const before=knownResidentLooks(),profile=newcomerProfile();
      assert.equal(profile.gender,roll===0?'f':'m');assert.ok(matchPool(profile));
      const c=raster();drawDoll(c,20,30,{...profile.look,skin:0});
      for(const old of before){const o=raster();drawDoll(o,20,30,{...old,skin:0});assert.notDeepEqual(c.pixels,o.pixels,'not an existing person with a new gender or skin');}
      const candidates=RESIDENT_LOOK_SETS.filter(s=>s.gender===profile.gender).flatMap(s=>s.hairTones.map(hairColor=>({...s.look,hairColor})));
      if(candidates.some(l=>before.every(other=>lookDistance(l,other)>=4)))assert.ok(before.every(other=>lookDistance(profile.look,other)>=4));
      G.community.friends.push({...profile,pid:'remembered-'+roll+'-'+i});
    }
  }
  assert.equal(JSON.stringify(G.dolls.map(d=>d.look)),original,'existing people never change');
  const f=G.community.friends[0],savedLook=JSON.stringify(f.look);save();load();
  const visitor=G.community.friends.find(d=>d.pid===f.pid);
  assert.equal(JSON.stringify(addDoll({...visitor,guest:true}).look),savedLook,'returning friend retains their identity');
`));

test('appearance diversity ignores tiny details and has a bounded best-choice fallback', () => game(`
  const base=RESIDENT_LOOK_SETS[0].look;
  assert.equal(lookDistance(base,{...base,skin:4,features:'mole',shoes:3,acc:'bow',extra:'scarf'}),0);
  let seed=109;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  for(const gender of ['f','m']){
    const seen=new Set();
    for(let i=0;i<250;i++){
      const look=randomLook(gender);
      const s=RESIDENT_LOOK_SETS.find(s=>s.gender===gender&&s.look.hair===look.hair&&s.look.top===look.top&&s.look.topColor===look.topColor);
      assert.ok(s);seen.add(s.id);
    }
    assert.equal(seen.size,12);
  }
  const saturated=RESIDENT_LOOK_SETS.flatMap(s=>s.hairTones.map(hairColor=>({...s.look,hairColor})));
  const before=JSON.stringify(saturated);assert.ok(randomLook('m',saturated));assert.equal(JSON.stringify(saturated),before);
  // Even after meeting every template, the new person must not look like a current housemate.
  G.community.friends=saturated.map((look,i)=>({pid:'old-'+i,name:'旧友'+i,look}));
  for(const roll of [0,.99]){Math.random=()=>roll;const p=newcomerProfile();assert.ok(G.dolls.every(d=>lookDistance(p.look,d.look)>=4));}
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


test('face details and held bowls remain readable and within bounds while walking, eating and sleeping', () => game(`
  const base={...DEFAULT_SAVE.dolls[0].look,hair:'pixie',acc:'none'};
  for(const features of Object.keys(OUTFIT.features))for(const dir of ['down','left','right','up'])for(const pose of ['stand','walk','sit','head'])for(let frame=0;frame<4;frame++){
    const c=raster(24,28);drawDoll(c,12,pose==='head'?18:27,{...base,features},{dir,pose,frame,prop:pose==='head'?null:'bowl',gesture:'eat',expression:'content'});
    assert.equal(c.outside.length,0,features+' '+dir+' '+pose);
  }
  for(const features of ['freckles','rosy','mole']){
    const c=raster(),plain=raster();drawDoll(c,20,30,{...base,features});drawDoll(plain,20,30,base);
    assert.notEqual(hash(JSON.stringify(c.pixels)),hash(JSON.stringify(plain.pixels)));
    assert.deepEqual(wearOutfit({...base,features},'mint').features,features);
  }
  const left=raster(),right=raster();
  drawDoll(right,20,30,base,{dir:'right',pose:'head'});
  assert.equal(right.pixels[27*40+21],DOLL_INK,'side sleeping eyes are closed at y + 6');
  const empty=raster(),back=raster();drawDoll(empty,20,30,base,{dir:'up'});drawDoll(back,20,30,base,{dir:'up',prop:'bowl'});
  assert.deepEqual(back.pixels,empty.pixels,'bowl is hidden behind the body from the back');
`));


test('preset gallery, gender filters, randomize and undo preserve identity and work through buttons', () => game(`
  const [a,b]=residents(),before=JSON.stringify(a.look),identity=JSON.stringify([a.pid,a.name,a.gender,a.persona,a.job,a.money]);
  openWardrobe(a.uid);pages[2].click();
  assert.equal(wdPresetGender,'f');
  let gallery=$('#wdOptions').children.at(-1).children[1];assert.equal(gallery.children.length,12);
  gallery.children[0].click();assert.equal(a.look.hair,'sidebraid');assert.equal(a.look.skin,JSON.parse(before).skin);
  $('#wdOptions').children[0].children[1].children[1].click();assert.equal(wdPresetGender,'m');
  gallery=$('#wdOptions').children.at(-1).children[1];gallery.children[0].click();assert.equal(a.look.hair,'curtain');
  assert.equal(JSON.stringify([a.pid,a.name,a.gender,a.persona,a.job,a.money]),identity,'opposite pool is an outfit choice, not a gender change');
  $('#wdRandom').click();assert.ok(RESIDENT_LOOK_SETS.some(s=>s.gender==='f'&&s.look.hair===a.look.hair&&s.look.top===a.look.top));
  assert.equal(a.look.skin,JSON.parse(before).skin);assert.ok(lookDistance(a.look,b.look)>=4);
  $('#wdUndo').click();assert.equal(JSON.stringify(a.look),before);
  $('#wdTabs').children[1].click();assert.equal(wdPresetGender,'m');
  closeWardrobe();openWardrobe(a.uid);pages[2].click();assert.equal(wdPresetGender,'f');
`,true));
