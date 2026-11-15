const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.join(__dirname, '..');

function run(scenario, mode = '') {
  const storage = new Map(), attributes = {}, styles = {};
  const canvas = {
    style: {}, getContext: () => ({ scale() {} }), addEventListener() {},
    setAttribute: (key, value) => { attributes[key] = value; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width / 4, height: this.height / 4 }; },
  };
  const context = vm.createContext({
    assert, attributes, styles, canvas, setTimeout() {}, window: { addEventListener() {} },
    document: { body: { dataset: { mode } }, createElement: () => canvas,
      getElementById: id => id === 'cv' ? canvas : { style: { setProperty: (key, value) => { styles[key] = value; } } } },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  for (const [, script] of fs.readFileSync(path.join(root, 'index.html'), 'utf8').matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)) {
    if (script === 'js/ui.js') break;
    vm.runInContext(fs.readFileSync(path.join(root, script), 'utf8'), context, { filename: script });
  }
  vm.runInContext(`
    load(); rebuild();
    function largestTwoStoreys() { G.level = 3; setWorldSize(24); rebuild(); }
    function buildThird() { largestTwoStoreys(); G.fund = 12000; expand(); }
  ` + scenario, context);
}

test('third floor is an affordable final expansion, preserving the old rooms and furniture identities', () => run(`
  largestTwoStoreys();
  const before = G.furniture.map(f => [f.key, f.id, f.x, f.y]);
  const dolls = residents().map(d => d.pid);
  G.fund = 11999; expand();
  assert.equal(G.level, 3); assert.equal(HOUSE_HEIGHT, 310);
  assert.equal(G.fund, 11999); assert.equal(G.thirdFloorReady, false);
  G.fund++; expand();
  assert.equal(G.level, 4); assert.equal(G.fund, 0); assert.equal(LEVELS[G.level].cap, 10);
  assert.equal(HOUSE_HEIGHT, 404); assert.equal(STOREYS.length, 3);
  assert.equal(COLS, 24); assert.equal(canvas.height, 404 * SCENE_SCALE);
  assert.equal(styles['--scene-ratio'], 460 / 404);
  assert.deepEqual(residents().map(d => d.pid), dolls);
  for (const [key, id, x, y] of before) {
    const f = G.furniture.find(f => f.key === key);
    assert.deepEqual([f.id, f.x, f.y], [id, x, y]);
  }
  expand(); assert.equal(G.level, 4); assert.equal(G.fund, 0);
  load(); assert.equal(G.level, 4); assert.equal(G.thirdFloorReady, true);
`));

test('routes use both stair flights and the yard gate, never the adjacent saved row numbers', () => run(`
  buildThird();
  const start = nearestFree(10, 8), destination = nearestFree(18, 32);
  const route = [start, ...findPath(start.x, start.y, [destination])];
  const transitions = route.slice(1).map((to, i) => [route[i], to]).filter(([a,b]) => houseFloor(a.y) !== houseFloor(b.y));
  assert.equal(transitions.length, 2);
  for (const [i, [a,b]] of transitions.entries()) {
    assert.equal(a.x, stairsColumn()); assert.equal(b.x, stairsColumn());
    assert.deepEqual([a.y,b.y], stairLinks()[i]);
  }
  const yard = nearestFree(10, 24), path = [destination, ...findPath(destination.x, destination.y, [yard])];
  assert.equal(path.filter((tile, i) => i && houseFloor(tile.y) !== houseFloor(path[i-1].y)).length, 3);
  assert.ok(wallBetween(10,25,10,26));
  assert.equal(canSee({tx:10,ty:15},{tx:10,ty:29}),false);
  assert.equal(roomOf({tx:2,ty:28}),'loftBedroom');
  assert.equal(roomOf({tx:10,ty:29}),'loftStudio');
  assert.equal(roomOf({tx:10,ty:23}),'yard');
`));

test('third-floor furniture, wall decor and drag targets stay on their own floors', () => run(`
  assert.equal(canPlace('chair', 12, 28), false);
  buildThird();
  assert.equal(G.furniture.filter(f => houseFloor(f.y) === 3).length, 14);
  for (const f of G.furniture.filter(f => houseFloor(f.y) === 3)) {
    assert.ok(canPlace(f.id, f.x, f.y, f), f.id);
    const rect = houseFurnitureRect(f);
    assert.equal(rect.storey, STOREYS[2]);
    assert.ok(rect.top >= STOREYS[2].wall && rect.bottom <= STOREYS[2].front, f.id);
    if (FURNITURE[f.id].use) assert.ok(findPath(10, 8, approachTiles(f)), f.id);
    if (layerOf(f.id) === 'wall') {
      assert.equal(houseTile({x:rect.x+rect.w/2,y:rect.y+FURNITURE[f.id].h*T/2}, f.id).y, f.y);
    }
  }
  for (const [id,x,y] of [['bed',20,33],['gardenSwing',10,28],['chair',10,23],['window',10,-7],['chair',22,33],['chair',22,13]]) {
    assert.equal(canPlace(id,x,y), false, id + ':' + y);
  }
  assert.equal(canPlace('chair',20,31),true);
  const point={x:HOUSE_X+20*T+8,y:houseY(31*T+14,STOREYS[2])};
  assert.deepEqual(dropTile(point),{x:20,y:31});
  assert.equal(cornerRoom(G.furniture.find(f=>f.id==='window'&&f.y===THIRD_WALL)),'loftBedroom');
  assert.equal(inPrivateRoomTile({x:2,y:28}),true);
  assert.equal(inPrivateRoomTile({x:2,y:23}),false);
`));

test('residents visibly walk both stair flights to use third-floor furniture and return to the yard', () => run(`
  buildThird();
  const d=residents()[0], piano=G.furniture.find(f=>f.id==='piano'&&houseFloor(f.y)===3);
  d.job='none';d.needs.energy=100;d.needs.bladder=100;
  const start=nearestFree(10,8);placeDollAt(d,start.x,start.y);
  const path=findPath(d.tx,d.ty,approachTiles(piano));
  assert.ok(path); d.path=path; d.act={type:'piano',furn:piano};d.state='walk';
  const flights=new Set();
  for(let i=0;i<5000&&d.state==='walk';i++){
    if(takingStairs(d)) flights.add(houseFloor(d.path[0].y));
    updateDoll(d,.05);
    const p=houseDollPoint(d);
    assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
    assert.ok(p.y>=STOREYS[2].wall&&p.y<HOUSE_HEIGHT);
  }
  assert.deepEqual([...flights],[2,3]); assert.equal(d.state,'act');assert.equal(d.act.type,'piano');
  assert.equal(houseFloor(d.ty),3);
  endAct(d);const goal=nearestFree(10,24);d.path=findPath(d.tx,d.ty,[goal]);d.act={type:'wander'};d.state='walk';
  for(let i=0;i<5000&&d.state==='walk';i++)updateDoll(d,.05);
  assert.equal(roomOf(d),'yard');assert.equal(d.ty,goal.y);
`));

test('expansion safely moves furniture off the new landing and stops its occupant before rebuilding', () => run(`
  largestTwoStoreys();
  assert.equal(canPlace('chair',22,13),true);
  const f=addFurniture('chair',22,13),d=residents()[0];rebuild();
  placeDollAt(d,22,13);d.state='act';d.act={type:'sit',furn:f,onFurn:true,back:{x:22,y:14}};f.users=[d];f.active=true;
  G.fund=12000;expand();
  assert.equal(f.users.length,0);assert.equal(d.state,'idle');assert.equal(f.active,false);
  assert.ok(!blocksStairs(f));assert.equal(houseFloor(f.y),2);assert.ok(free(22,13));
  assert.ok(findPath(d.tx,d.ty,[{x:22,y:33}]));
`));

test('portable saves retain the third floor, resident positions and removed furniture without respawning it', () => run(`
  buildThird();
  const chair=G.furniture.find(f=>f.id==='chair'&&houseFloor(f.y)===3);
  const key=chair.key;removeFurniture(chair);rebuild();
  const d=residents()[0];placeDollAt(d,20,31);const pid=d.pid;
  const portable=readPortableHome(exportHomeSave());
  assert.equal(portable.level,4);applySave(portable);rebuild();
  assert.equal(G.furniture.some(f=>f.key===key),false);
  assert.equal(G.furniture.some(f=>f.id==='chair'&&houseFloor(f.y)===3),false);
  assert.equal(residents().find(d=>d.pid===pid).ty,31);
  const previous=JSON.parse(JSON.stringify(DEFAULT_SAVE));previous.level=3;
  applySave(previous);rebuild();
  assert.equal(STOREYS.length,2);assert.equal(HOUSE_HEIGHT,310);assert.equal(free(20,31),false);
  assert.equal(YARD.back,258);
`));

test('an existing sandbox gains the maximum floor once while keeping the normal-save namespace separate', () => run(`
  assert.equal(G.level,4);assert.equal(STOREYS.length,3);
  const previous=JSON.parse(JSON.stringify(DEFAULT_SAVE));previous.level=3;
  applySave(previous);rebuild();
  assert.equal(G.level,4);assert.equal(G.thirdFloorReady,true);
  assert.ok(G.furniture.some(f=>f.y===THIRD_WALL));
  assert.equal(purchasePrice('piano'),0);assert.equal(SAVE_KEY,'pixel-dollhouse-test-v1');
  const count=G.furniture.length;save();load();assert.equal(G.furniture.length,count);
`, 'test'));
