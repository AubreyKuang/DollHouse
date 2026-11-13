const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function game(code, mode, withUI = false) {
  const data = new Map(), dialogs = {};
  const ctx = vm.createContext({ assert, dialogs,
    document: { body: { dataset: { mode } }, getElementById: id => dialogs[id] || {} },
    localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }, setTimeout() {},
  });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, script] of html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) {
    if (script === 'js/view.js') break;
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), ctx, { filename: script });
  }
  vm.runInContext(`
    HOOK.resize = () => {}; load(); rebuild();
    G.time = 18 * 60; G.weather = 'sunny'; G.night = false;
    for (const d of G.dolls) { d.job = 'none'; d.state = 'idle'; d.act = null; d.path = [];
      d.needs = { energy: 90, hunger: 45, fun: 50, social: 50, bladder: 90 }; }
    ensureHomeWishes();
    function advanceHome(seconds) {
      for (let t = 0; t < seconds; t += .05) {
        tickHomeStories(.05);
        for (const d of G.dolls) if (inHomeTime(d)) updateDoll(d, .05);
        G.time += .2;
      }
    }
  `, ctx);
  if (withUI) {
    ctx.markupIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    vm.runInContext(`
      function node(tag) {
        return {tag,children:[],attributes:{},classList:{toggle(){}},hidden:false,open:false,
          append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},
          setAttribute(k,v){this.attributes[k]=v},showModal(){this.open=true},close(){this.open=false},click(){this.onclick?.()}};
      }
      const nodes=new Map(markupIds.map(id=>['#'+id,node('div')]));
      nodes.set('label[for="saveFile"]',node('label'));
      const $=s=>{assert.ok(nodes.has(s),'existing UI element '+s);return nodes.get(s)};
      const el=(tag,cls,text)=>Object.assign(node(tag),{className:cls,textContent:text});
      const paperPortrait=d=>{const c=node('canvas');c.look={...d.look};return c};
      document.querySelector=$;
      document.querySelectorAll=selector=>{
        assert.equal(selector,'#homePeople input:checked');
        return $('#homePeople').children.flatMap(n=>n.children).filter(n=>n.tag==='input'&&n.checked);
      };
      function updateClock(){} function renderLog(){} function renderShopBar(){} function saveHousePaperCard(){}
      let awaySince=0;
    `, ctx);
    vm.runInContext(fs.readFileSync(path.join(root, 'js/home-ui.js'), 'utf8'), ctx, { filename: 'home-ui.js' });
  }
  vm.runInContext(code, ctx);
}

test('four people really walk to separate seats and finish a paid dinner once', () => game(`
  const people = residents(), ids = people.map(d => d.pid), before = G.fund;
  people[0].money = 0; people[0].needs.hunger = 5;
  const broke = people[0].money;
  assert.equal(startHomeTime('supper', ids), null);
  const destinations = people.map(d => d.path.at(-1) || { x:d.tx, y:d.ty });
  assert.equal(new Set(destinations.map(t => t.x+','+t.y)).size, 4);
  assert.equal(G.home.album.length, 0);
  assert.equal(G.fund, before, 'invitations are not charged before anyone arrives');
  advanceHome(80);
  assert.equal(G.home.active, null);
  assert.equal(G.home.album.length, 1);
  assert.equal(G.home.album[0].people.length, 4);
  assert.equal(G.fund, before - 30);
  assert.equal(people[0].money, broke);
  assert.ok(people[0].needs.hunger > 30);
  assert.equal(G.npcMemory.sequence > 0, true);
  tickHomeStories(10);
  assert.equal(G.home.album.length, 1);
  assert.ok(G.log.some(e => /在家一起吃顿饭/.test(e.text)));
`));

test('wish follows personality and finishes only after its owner attends', () => game(`
  G.home.wishes = []; G.home.lastWishMonth = 0;
  const [a,b,c,d] = residents();
  a.persona = 'foodie'; b.persona = 'nerd'; ensureHomeWishes();
  assert.equal(G.home.wishes[0].kind, 'supper');
  assert.equal(G.home.wishes[1].kind, 'stories');
  assert.equal(startHomeTime('supper', [c.pid,d.pid]), null);
  advanceHome(80);
  assert.equal(G.home.wishes[0].done, 0);
  for (const p of [a,b]) { p.state='idle'; p.act=null; p.needs.energy=90; }
  assert.equal(startHomeTime('supper',[a.pid,b.pid]),null);
  assert.equal(G.home.wishes[0].done,0);
  advanceHome(80);
  assert.equal(G.home.wishes[0].done,G.day);
  assert.equal(G.home.wishes[1].done,0);
  const portrait = JSON.stringify(G.home.album[0].people[0].look);
  c.look.hairColor=9;
  assert.equal(JSON.stringify(G.home.album[0].people[0].look),portrait);
`));

test('a canceled or unreachable invitation grants no memory or relationship reward', () => game(`
  const [a,b] = residents(), before = G.fund, friendship=rel(a,b).f;
  assert.equal(startHomeTime('stories',[a.pid,b.pid]),null);
  cancelHomeTime();
  assert.equal(G.home.album.length,0); assert.equal(rel(a,b).f,friendship);
  assert.equal(G.fund,before);
  assert.ok(!inHomeTime(a)&&!inHomeTime(b));
  G.furniture = G.furniture.filter(f=>!HOME_TIMES.stories.furniture.includes(f.id)); rebuild();
  assert.match(startHomeTime('stories',[a.pid,b.pid]),/先摆好/);
  assert.equal(G.home.active,null);
`));

test('moving an anchor and interrupting a participant cannot award a finished gathering', () => game(`
  const [a,b] = residents();
  assert.equal(startHomeTime('supper',[a.pid,b.pid]),null);
  G.furniture=G.furniture.filter(f=>f.key!==G.home.active.anchor);
  tickHomeStories(.1);
  assert.equal(G.home.active,null); assert.equal(G.home.album.length,0);
  assert.equal(startHomeTime('stories',[a.pid,b.pid]),null);
  advanceHome(1); endAct(b); b.path=[];
  tickHomeStories(.1);
  assert.equal(G.home.active,null); assert.equal(G.home.album.length,0);
`));

test('strained relationships and imminent work are respected without stealing leisure participants', () => game(`
  const [a,b] = residents();
  setRelationshipTension(a,b,'ex',a);
  assert.match(startHomeTime('supper',[a.pid,b.pid]),/需要一点空间/);
  delete rel(a,b).tension;
  a.job='night'; G.time=21*60;
  assert.match(startHomeTime('supper',[a.pid,b.pid]),/出门/);
  a.job='none';
  assert.equal(startHomeTime('supper',[a.pid,b.pid]),null);
  assert.equal(interruptible(a),false);
  assert.equal(availableHosts().includes(a),false);
  assert.equal(readyForKeepsake(a),false);
`));

test('active dinner survives reload, regathers, and never double charges', () => game(`
  const ids=residents().slice(0,2).map(d=>d.pid), before=G.fund;
  assert.equal(startHomeTime('supper',ids),null);
  while(G.home.active.phase!=='sharing') advanceHome(.1);
  assert.equal(G.fund,before-30);
  const saved=JSON.parse(JSON.stringify(houseSaveData()));
  applySave(saved); rebuild();
  assert.equal(G.home.active.resume,true); assert.equal(G.home.album.length,0);
  advanceHome(80);
  assert.equal(G.home.active,null); assert.equal(G.home.album.length,1);
  assert.equal(G.fund,before-30);
`));

test('old saves gain optional wishes without replacing the house, and ignored wishes do not expire', () => game(`
  const before=G.fund, wish=G.home.wishes[0].text;
  for(let month=0;month<8;month++){G.day++;ensureHomeWishes();}
  assert.equal(G.home.wishes[0].text,wish); assert.equal(G.home.wishes[0].done,0);
  assert.equal(G.fund,before);
  const saved=houseSaveData(); delete saved.home; applySave(saved); rebuild();
  ensureHomeWishes(); assert.equal(G.home.album.length,0); assert.equal(residents().length,4);
  assert.equal(G.home.wishes.length,2);
`));

test('album keeps real portraits, deduplicates events, and retains favorites when bounded', () => game(`
  const a=residents()[0];
  addHomeMemory('corner','角落','故事',[a],'same');
  addHomeMemory('corner','角落','故事',[a],'same');
  assert.equal(G.home.album.length,1);
  G.home.album[0].favorite=true;
  for(let i=0;i<125;i++)addHomeMemory('stories','故事','文字',[a],'story-'+i);
  assert.equal(G.home.album.length,120);assert.equal(G.home.album[0].key,'same');
`));

test('portable saves round trip memories, validate before mutation, and undo restores the original home', () => game(`
  addHomeMemory('stories','第一次','回忆',residents().slice(0,2),'first');
  const exported=exportHomeSave(), old=G.fund;
  G.fund=12345;
  const data=readPortableHome(exported);
  importPortableHome(data);
  assert.equal(G.fund,old); assert.equal(G.home.album.length,1);
  importPortableHome(readPortableHome(localStorage.getItem(HOME_IMPORT_BACKUP)),true);
  assert.equal(G.fund,12345);
  const invalid=JSON.parse(exported); invalid.data.fund=12;
  assert.throws(()=>readPortableHome(JSON.stringify(invalid)),/不完整|改过/);
  assert.equal(G.fund,12345);
  invalid.mode='test';assert.throws(()=>readPortableHome(JSON.stringify(invalid)),/测试模式/);
  assert.throws(()=>readPortableHome('{oops'),/JSON/);
`));

test('import refuses invalid residents and storage failure preserves the current home', () => game(`
  const current=G.fund, data=readPortableHome(exportHomeSave());
  data.dolls[0].needs.hunger=-1;
  assert.throws(()=>importPortableHome(data),/状态数值/);assert.equal(G.fund,current);
  const good=readPortableHome(exportHomeSave()); good.fund=5000;
  localStorage.setItem=()=>{throw Error('quota');};
  assert.throws(()=>importPortableHome(good),/无法保留/);
  assert.equal(G.fund,current); assert.equal(save(),false); assert.equal(G.saveOk,false);
`));

test('failure at the final write preserves the live house, backups and snapshots', () => game(`
  save();
  const good=readPortableHome(exportHomeSave()); good.fund=5000;
  const current=G.fund, resident=G.dolls[0];
  const keys=[SAVE_KEY, SAVE_KEY + ':backup', SAVE_KEY + ':snapshots', HOME_IMPORT_BACKUP];
  const before=keys.map(key=>localStorage.getItem(key));
  const write=localStorage.setItem;
  localStorage.setItem=(key,value)=>{if(key===SAVE_KEY)throw Error('quota');write(key,value);};
  assert.throws(()=>importPortableHome(good),/恢复已取消/);
  assert.equal(restoreHouseSnapshot(0),false);
  assert.equal(G.fund,current);
  assert.equal(G.dolls[0],resident);
  assert.deepEqual(keys.map(key=>localStorage.getItem(key)),before);
`));

test('reading the home journal or save preview pauses simulation, and test dinners are free', () => game(`
  dialogs.homeDialog={open:true}; const time=G.time;
  update(1);assert.equal(G.time,time);
  dialogs.homeDialog.open=false;dialogs.saveDialog={open:true};
  update(1);assert.equal(G.time,time);
  dialogs.saveDialog.open=false;
  const before=G.fund;
  assert.equal(startHomeTime('supper',residents().slice(0,2).map(d=>d.pid)),null);
  advanceHome(80);assert.equal(G.fund,before);assert.equal(G.home.album.length,1);
`, 'test'));

test('home controls render real portraits, launch a selected gathering, and expose saved memories', () => game(`
  $('#btnHome').onclick();
  assert.equal($('#homeDialog').open,true);
  assert.equal($('#homeWishes').children.length,2);
  assert.equal($('#homePeople').children.length,4);
  assert.equal(selectedHomePeople().length,2);
  assert.equal($('#homeStart').disabled,false);
  $('#homeStart').onclick();
  assert.equal($('#homeDialog').open,false);
  assert.equal($('#homeNow').hidden,false);
  advanceHome(80);
  assert.equal($('#homeNow').hidden,true);
  $('#btnHome').onclick();$('#homeAlbum').onclick();
  assert.equal($('#homeTodayPanel').hidden,true);
  assert.equal($('#homeAlbumPanel').hidden,false);
  assert.equal($('#homeMemories').children.length,1);
  const card=$('#homeMemories').children[0];
  assert.equal(card.children[1].children.length,2,'two portrait figures');
  card.children.at(-1).children[0].onclick();
  assert.equal(G.home.album[0].favorite,true);
  $('#btnSaveHome').onclick();assert.match($('#saveState').textContent,/4 位住户/);
`, undefined, true));

test('all three activities finish with personality lines and no unexpected costs', () => game(`
  for (const kind of ['stories','music']) {
    const pair=residents().slice(0,2);
    for(const d of pair){d.state='idle';d.act=null;d.path=[];d.needs.energy=90;d.needs.hunger=60;}
    const before=G.fund;
    assert.equal(startHomeTime(kind,pair.map(d=>d.pid)),null);
    advanceHome(80);
    assert.equal(G.fund,before);assert.equal(G.home.active,null);
    assert.equal(G.home.album.at(-1).kind,kind);
  }
  for(const theme of Object.values(HOME_LINES))for(const persona of Object.keys(PERSONAS))assert.equal(theme[persona].length,2);
`));

test('birthday and teaching controls select real roles and show the correct material cost', () => game(`
  const [learner,,,teacher]=residents();teacher.job='chef';teacher.lastWorkDay=G.day;
  $('#btnHome').onclick();
  assert.equal($('#homeOccasions').children.length,1);
  $('#homeOccasions').children[0].children.at(-1).onclick();
  assert.equal(homeKind,'birthday');assert.equal($('#homeFocus').value,'p-jing');
  assert.ok(selectedHomePeople().includes('p-jing'));assert.match($('#homePlanStatus').textContent,/¥20/);
  $('#homeKinds').children.find(n=>n.textContent.includes('教我一道菜')).onclick();
  assert.equal($('#homeFocusLabel').hidden,false);assert.equal($('#homeFocus').value,learner.pid);
  assert.ok(selectedHomePeople().includes(teacher.pid));assert.equal($('#homeStart').disabled,false);
  assert.match($('#homePlanStatus').textContent,/¥15/);
  $('#homeStart').onclick();assert.equal(G.home.active.detail.learner,learner.pid);
  assert.equal(G.home.active.detail.teacher,teacher.pid);assert.equal($('#homeDialog').open,false);
`, undefined, true));

test('import isolates monthly snapshots and undo brings back the prior timeline', () => game(`
  const exported=exportHomeSave();
  G.day=9;snapshotHouseMonth();
  const original=localStorage.getItem(SAVE_KEY+':snapshots');
  importPortableHome(readPortableHome(exported));
  assert.equal(SaveManager.snapshots(localStorage,SAVE_KEY).length,1);
  assert.equal(SaveManager.snapshots(localStorage,SAVE_KEY)[0].day,1);
  importPortableHome(readPortableHome(localStorage.getItem(HOME_IMPORT_BACKUP)),true);
  assert.equal(G.day,9);assert.equal(localStorage.getItem(SAVE_KEY+':snapshots'),original);
`));

test('shared activities coexist with several months of normal household simulation', () => game(`
  G.time=480; const initial=G.day;
  let invitations=0;
  for(let i=0;i<7200;i++) {
    if(i%900===0&&!G.home.active){
      const pair=residents().filter(d=>!homeAvailability(d,'stories')).slice(0,2);
      if(pair.length===2&&!startHomeTime('stories',pair.map(d=>d.pid)))invitations++;
    }
    update(.25);
  }
  assert.ok(G.day>=initial+5);assert.ok(invitations>0);
  for(const d of G.dolls)for(const value of Object.values(d.needs))assert.ok(Number.isFinite(value)&&value>=0&&value<=100);
  assert.ok(G.home.album.length<=120);assert.ok(G.home.wishes.length<=8);
  assert.ok(G.furniture.every(f=>new Set(f.users).size===f.users.length));
  assert.doesNotThrow(()=>readPortableHome(exportHomeSave()));
`));
