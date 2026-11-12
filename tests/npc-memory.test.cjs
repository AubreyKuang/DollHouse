const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const dollhouse = fs.existsSync(path.join(root, 'js/social.js'));
const palace = !fs.existsSync(path.join(root, 'npc-memory.js')) && !dollhouse;
const html = read('index.html');
const end = 'return { record, influence, recall };\n})();';
const memorySource = palace
  ? html.slice(html.indexOf('const NPCMemory ='), html.indexOf(end) + end.length)
  : read(dollhouse ? 'js/npc-memory.js' : 'npc-memory.js');
function runtime(extra = {}) {
  const context = vm.createContext(extra);
  vm.runInContext(memorySource, context);
  context.memory = vm.runInContext('NPCMemory', context);
  return context;
}
function emit(ctx, world, options = {}) {
  return ctx.memory.record(world, {type:'gift', time:12}, [
    {person:'alice',subject:'bob',interpretation:'Bob helped me',emotion:.4,impact:50,...options}
  ]);
}
function loadFunction(ctx, source, name, next) {
  const start = source.lastIndexOf('function ' + name + '(');
  const finish = source.indexOf(next, start + 1);
  assert.ok(start >= 0 && finish > start, 'function extraction boundary');
  vm.runInContext(source.slice(start, finish), ctx);
}
test('all entry-point scripts parse', () => {
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  for (const match of html.matchAll(/<script src="([^"]+)"/g)) new vm.Script(read(match[1]));
});
test('independent perspectives, unknown observers, duplicate event and sequence gap', () => {
  const ctx=runtime(), world={};
  const event=ctx.memory.record(world,{type:'argue',time:1},[
    {person:'alice',subject:'bob',interpretation:'I confronted Bob',emotion:-1,impact:100},
    {person:'bob',subject:'alice',interpretation:'Alice confronted me',emotion:-.6,impact:90}
  ]);
  assert.notEqual(ctx.memory.recall(world,'alice')[0].interpretation,ctx.memory.recall(world,'bob')[0].interpretation);
  assert.equal(ctx.memory.recall(world,'diana').length,0);
  const before=JSON.stringify(world);
  assert.equal(ctx.memory.record(world,event,[]),null);
  assert.equal(JSON.stringify(world),before);
  assert.throws(()=>ctx.memory.record(world,{sequence:3},[]),/sequence gap/);
  assert.equal(JSON.stringify(world),before);
});
test('structured interpretations survive consolidation', () => {
  const ctx=runtime(), world={};
  for(let i=0;i<3;i++) emit(ctx,world,{interpretation:{type:'gift',object:'cookie'}});
  const entry=world.npcMemory.people.alice.long[0];
  assert.ok(entry);
  assert.equal(typeof entry.interpretation,'object');
  assert.equal(entry.interpretation.object,'cookie');
  assert.equal(entry.sources.length,3);
});
test('capacity, retained sources, confidence and twenty save/load cycles', () => {
  const ctx=runtime(); let world={};
  emit(ctx,world,{emotion:-1,impact:100});
  for(let i=0;i<200;i++) emit(ctx,world,{subject:'person-'+i});
  assert.ok(world.npcMemory.people.alice.short.length<=32);
  assert.ok(ctx.memory.recall(world,'alice').some(entry=>entry.sources.includes('event-1')));
  for(const entry of ctx.memory.recall(world,'alice')) for(const id of entry.sources) assert.ok(world.npcMemory.events[id]);
  const before=JSON.stringify(world), influence=ctx.memory.influence(world,'alice','bob');
  for(let i=0;i<20;i++) world=JSON.parse(JSON.stringify(world));
  assert.equal(JSON.stringify(world),before);
  assert.equal(ctx.memory.influence(world,'alice','bob'),influence);
  const uncertain={}; emit(ctx,uncertain,{emotion:-1,confidence:0,impact:100});
  assert.equal(ctx.memory.influence(uncertain,'alice','bob'),0);
  assert.equal(ctx.memory.influence({},'alice','bob'),0);
});
if(dollhouse) {
  test('actual startSocial applies argument once and respects observer distance/visibility', () => {
    const noop=()=>{};
    const make=(pid,x)=>({pid,name:pid,persona:'normal',heart:'normal',job:'none',x,y:0,tx:x,ty:0,state:'idle',needs:{fun:60,hunger:60,energy:60}});
    const a=make('alice',0), b=make('bob',1), near=make('charlie',2), far=make('diana',50), hidden=make('hidden',2);
    a.act={kind:'argue'};
    const G={dolls:[a,b,near,far,hidden],rel:{}};
    const ctx=runtime({G,PERSONAS:{normal:{}},compat:()=>1,isF:()=>true,isE:()=>true,face:noop,say:noop,spawnHeart:noop,SFX:{play:noop},HOOK:{toast:noop},pick:a=>a[0],absNow:()=>100,lying:()=>false,canSee:n=>n!==hidden,addLog:noop,setTimeout:noop});
    vm.runInContext(read('js/social.js'),ctx);
    ctx.startSocial(a,b);
    assert.equal(ctx.memory.recall(G,'alice').length,1);
    assert.equal(ctx.memory.recall(G,'bob').length,1);
    assert.equal(ctx.memory.recall(G,'charlie').length,1);
    assert.equal(ctx.memory.recall(G,'diana').length,0);
    assert.equal(ctx.memory.recall(G,'hidden').length,0);
    assert.ok(ctx.rel(a,b).f<25);
    vm.runInContext('weighted = list => list',ctx);
    const withMemory=ctx.pickPartner(a,[b])[0][1];
    const saved=G.npcMemory; delete G.npcMemory;
    assert.ok(withMemory<ctx.pickPartner(a,[b])[0][1]);
    G.npcMemory=saved;
  });
} else if(palace) {
  test('actual quarrel and legacy remember entry points produce distinct memories', () => {
    const S={turn:5},ctx=runtime({S,fullName:c=>c.name});
    loadFunction(ctx,html,'remember','function deepLine(');
    const a={id:1,name:'Alice'},b={id:2,name:'Bob'};
    ctx.rememberQuarrel(a,b,a.id);
    assert.match(ctx.memory.recall(S,1)[0].interpretation,/判给了我/);
    assert.match(ctx.memory.recall(S,2)[0].interpretation,/判给了她/);
    assert.equal(ctx.memory.recall(S,3).length,0);
    ctx.remember(a,'hurt','被降位');
    assert.ok(ctx.memory.influence(S,1,'emperor')<0);
    assert.ok(S.npcMemory.events['event-1'].participants.includes(2));
  });
} else {
  test('actual give entry point records gift and charges inventory once', () => {
    const state={day:1,time:480,inv:{cookie:2},need:{mood:50}};
    const relation={done:{},notes:{}},n={id:'alice',x:1,y:2,gifts:{cookie:15}};
    const ctx=runtime({state,D:{},rel:()=>relation,note:()=>{},advanceTime:n=>state.time+=n,updateHud:()=>{},nt:()=>({giftLines:['Thanks {i}']}),tierOf:()=>0,itemLabel:k=>k,talk:(n,t,o,cb)=>cb(),nm:()=> 'Alice',addPts:()=>{},clampN:n=>n,milestone:()=>{}});
    loadFunction(ctx,html,'rememberPlayer','function addPts(');
    loadFunction(ctx,html,'give','function ');
    ctx.give(n,'cookie');
    assert.equal(state.inv.cookie,1);
    assert.equal(relation.done.gift,true);
    assert.equal(ctx.memory.recall(state,'alice')[0].interpretation.object,'cookie');
    assert.equal(state.npcMemory.events['event-1'].type,'gift');
    assert.ok(ctx.memory.influence(state,'alice','player')>0);
  });
}
