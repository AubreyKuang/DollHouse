const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
function game(code){
 const data=new Map();
 const ctx=vm.createContext({assert,setTimeout(){},document:{body:{dataset:{}},getElementById:()=>({})},localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}});
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const [,f] of html.matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)){
  if(f==='js/view.js')break;
  vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 }
 vm.runInContext(`
 HOOK.resize=()=>{};load();rebuild();G.time=17*60;G.night=false;
 for(const d of residents()){d.job='none';d.needs={energy:90,hunger:60,fun:70,social:70,bladder:90};d.think=9999;d.act=null;d.state='idle';d.path=[];}
 let cook=residents()[3],guest=residents()[2];cook.persona='foodie';guest.job='office';guest.state='away';guest.lastWorkDay=G.day;guest.awayUntil=21*60;guest.needs.hunger=25;
 rel(cook,guest).f=65;
 const table=G.furniture.find(f=>f.id==='table'),stove=G.furniture.find(f=>f.id==='stove');
 function step(seconds){for(let t=0;t<seconds;t+=.05){tickHomeCare();for(const d of residents())if(d.act||d.state==='away')updateDoll(d,.05);G.time+=.2;}}
 function prepare(){assert.equal(planSavedMeal(cook),true);assert.equal(tryHomeCare(cook),true);step(30);assert.equal(G.care.meals[0]?.phase,'ready');}
 function eat(){comeHome(guest);if(guest.act)endAct(guest);assert.equal(tryHomeCare(guest),true);step(30);assert.equal(G.care.meals[0]?.phase,'eaten');}
 `,ctx);
 vm.runInContext(code,ctx);
}

test('the player can choose a different late worker from the automatic choice',()=>game(`
 const other=residents()[1];
 other.job='office';other.state='away';other.lastWorkDay=G.day;other.awayUntil=22*60;
 other.needs.hunger=50;rel(cook,other).f=65;
 const spot=approachTiles(stove).find(p=>free(p.x,p.y));
 placeDollAt(cook,spot.x,spot.y);
 assert.equal(orderSavedMeal(cook,residents()[0].pid),false);
 assert.equal(orderSavedMeal(cook,other.pid),true);
 assert.equal(G.care.meals.length,0);
 assert.equal(orderSavedMeal(cook,guest.pid),false);
 arrive(cook);
 cook.act.t=.01;
 updateDoll(cook,.02);
 const meal=G.care.meals[0];
 assert.equal(meal.to,other.pid);
 assert.equal(meal.phase,'packing');
 assert.equal(tryHomeCare(cook),true);
 step(30);
 assert.equal(meal.phase,'ready');
 assert.equal(savedMealFor(guest),undefined);
 assert.equal(savedMealFor(other),meal);
 save();load();
 assert.equal(G.care.meals[0].to,other.pid);
`));

test('a finished paid cooking action creates a portion only after the cook walks it to the table',()=>game(`
 const money=cook.money,sp=approachTiles(stove).find(p=>free(p.x,p.y));placeDollAt(cook,sp.x,sp.y);
 assert.equal(startAct(cook,{type:'cook',furn:stove}),true);arrive(cook);assert.equal(cook.money,money-PRICES.cook);
 cook.act.t=.01;updateDoll(cook,.02);
 assert.equal(G.care.meals.length,1);assert.equal(G.care.meals[0].phase,'packing');assert.equal(savedMealNote(table),null);
 assert.equal(tryHomeCare(cook),true);assert.ok(cook.path.length>0);assert.equal(savedMealAt(table),undefined);
 step(30);assert.equal(G.care.meals[0].phase,'ready');assert.equal(cook.money,money-PRICES.cook);
 assert.ok(savedMealNote(table).includes(guest.name));assert.ok(savedMealNote(table).includes(cook.name));
 assert.equal(G.home.album.filter(m=>m.kind==='care').length,0,'preparation is not the completed story');
`));

test('the named late worker eats for free and earns a memory only after actually finishing',()=>game(`
 prepare();const before=guest.needs.hunger;comeHome(guest);const money=guest.money;
 assert.equal(tryHomeCare(guest),true);assert.equal(G.home.album.length,0);assert.equal(guest.needs.hunger,before);
 step(30);assert.equal(G.care.meals[0].phase,'eaten');assert.equal(guest.money,money);
 assert.ok(guest.tx!==cook.tx,'the cook steps to the side so the eater stays visible');
 assert.ok(guest.needs.hunger>before+30);assert.equal(G.home.album.filter(m=>m.kind==='care').length,1);
 assert.equal(savedMealAt(table),undefined);assert.equal(savedMealNote(table),null);
 step(30);assert.equal(G.home.album.filter(m=>m.kind==='care').length,1);
`));

test('an interrupted bite survives save/load without generating a second full meal',()=>game(`
 prepare();comeHome(guest);const spot=approachTiles(table).find(p=>free(p.x,p.y));placeDollAt(guest,spot.x,spot.y);
 assert.equal(tryHomeCare(guest),true);arrive(guest);
 const initial=guest.needs.hunger;tickCareAction(guest,2);assert.equal(G.care.meals[0].bites,2);
 save();load();rebuild();cook=residents().find(d=>d.persona==='foodie');guest=residents().find(d=>d.pid==='p-jing');
 assert.equal(G.care.meals[0].bites,2);assert.equal(tryHomeCare(guest),true);step(30);
 assert.equal(G.care.meals[0].phase,'eaten');assert.ok(guest.needs.hunger<initial+43,'only remaining bites give hunger');
 assert.equal(G.home.album.filter(m=>m.kind==='care').length,1);
 save();load();assert.equal(G.care.meals[0].phase,'eaten');assert.equal(savedMealFor(residents().find(d=>d.pid==='p-jing')),undefined);
`));

test('no free meal or memory if the route is blocked, furniture removed or recipient moves out',()=>game(`
 const oldPath=findPath;findPath=()=>null;
 assert.equal(planSavedMeal(cook),false);assert.equal(G.care.meals.length,0);findPath=oldPath;
 prepare();G.furniture=G.furniture.filter(f=>f!==table);tickHomeCare();assert.equal(G.care.meals.length,0);assert.equal(G.home.album.length,0);
 G.furniture.push(table);G.care.prepared=[];prepare();G.dolls=G.dolls.filter(d=>d!==guest);tickHomeCare();assert.equal(G.care.meals.length,0);
`));

test('guests, daytime outings, grudges and full residents are not pulled into the late meal',()=>game(`
 guest.guest=true;assert.equal(planSavedMeal(cook),false);guest.guest=false;
 G.community.outing={pid:guest.pid,phase:'visiting'};assert.equal(planSavedMeal(cook),false);G.community.outing=null;
 guest.awayUntil=17*60+30;assert.equal(planSavedMeal(cook),false);guest.awayUntil=21*60;
 rel(cook,guest).f=-20;assert.equal(planSavedMeal(cook),false);rel(cook,guest).f=65;
 prepare();comeHome(guest);guest.needs.hunger=100;assert.equal(tryHomeCare(guest),false);assert.equal(G.care.meals[0].phase,'ready');
 const other=residents()[0];assert.equal(savedMealFor(other),undefined);
`));

test('portions expire quietly and cooks do not repeatedly fill the table',()=>game(`
 prepare();assert.equal(planSavedMeal(cook),false);assert.equal(G.care.meals.length,1);
 const expires=G.care.meals[0].expires;G.day=Math.floor(expires/1440)+1;G.time=expires%1440+1;
 tickHomeCare();assert.equal(G.care.meals.length,0);assert.equal(G.home.album.length,0);
`));

test('discarding a portion cannot bypass the cook cooldown, including after reloading',()=>game(`
 prepare();G.care.meals=[];assert.equal(planSavedMeal(cook),false);
 save();load();cook=residents().find(d=>d.pid==='p-tuan');guest=residents().find(d=>d.pid==='p-jing');
 assert.equal(planSavedMeal(cook),false);
`));

test('an interrupted thank-you has no completed dialogue or invented shared memory',()=>game(`
 prepare();eat();guest.job='none';cook.job='none';G.day++;G.time=9*60;
 placeDollAt(guest,9,10);placeDollAt(cook,10,10);
 assert.equal(tryHomeCare(guest),true);arrive(guest);tickHouseExchange(guest,.5);endAct(cook);
 assert.equal(G.care.meals[0].phase,'eaten');assert.equal(G.log.filter(l=>l.text.includes('当面谢谢')).length,0);
`));

test('thanks waits until the next cycle and the real face-to-face exchange finishes',()=>game(`
 prepare();eat();guest.job='none';cook.job='none';guest.think=9999;cook.think=9999;
 assert.equal(tryHomeCare(guest),false);
 G.day++;G.time=9*60;placeDollAt(guest,9,10);placeDollAt(cook,10,10);
 for(const d of [guest,cook]){d.act=null;d.state='idle';d.path=[];}
 assert.equal(tryHomeCare(guest),true);assert.equal(G.care.meals[0].phase,'eaten');
 assert.equal(G.log.filter(l=>l.text.includes('当面谢谢')).length,0);
 step(12);assert.equal(G.care.meals[0].phase,'thanked');
 assert.equal(G.log.filter(l=>l.text.includes('当面谢谢')).length,1);
 finishCareThanks(guest,cook,G.care.meals[0].id);assert.equal(G.log.filter(l=>l.text.includes('当面谢谢')).length,1);
`));

test('moving a table retains its note but an arrival at its old location cannot deliver or eat',()=>game(`
 assert.equal(planSavedMeal(cook),true);assert.equal(tryHomeCare(cook),true);
 table.x=0;table.y=8;rebuild();placeDollAt(cook,12,8);arriveHomeCare(cook);
 assert.equal(cook.act,null);assert.equal(G.care.meals[0].phase,'packing');
 assert.equal(G.home.album.length,0);
`));

test('a new grudge interrupts care without silently repairing the relationship',()=>game(`
 prepare();comeHome(guest);const spot=approachTiles(table).find(p=>free(p.x,p.y));placeDollAt(guest,spot.x,spot.y);
 assert.equal(tryHomeCare(guest),true);arrive(guest);
 const tension=tensionBetween;tensionBetween=()=>true;tickHomeCare();tickCareAction(guest,.1);tensionBetween=tension;
 assert.equal(guest.act,null);assert.equal(G.care.meals.length,0);assert.equal(G.home.album.length,0);
`));

test('night workers crossing the month boundary can receive breakfast and old saves need no care data',()=>game(`
 guest.job='night';G.time=23*60;guest.awayUntil=1440+6*60;
 assert.equal(lateWorker(guest),true);prepare();assert.ok(G.care.meals[0].expires>1440);
 const s=houseSaveData();delete s.care;applySave(s);assert.equal(G.care.meals.length,0);
 assert.deepEqual(restoreHomeCare({meals:[null,{phase:'invented'}]}).meals,[]);
`));
