const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
function game(code,mode){
  const data=new Map();
  const ctx=vm.createContext({assert,setTimeout(){},document:{body:{dataset:{mode}},getElementById(){return {}}},
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}});
  for(const [,script] of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"?]+)(?:\?[^"]*)?"/g)){
    if(script==='js/view.js')break;
    vm.runInContext(fs.readFileSync(path.join(root,script),'utf8'),ctx,{filename:script});
  }
  vm.runInContext(`
    HOOK.resize=()=>{};load();rebuild();G.time=17*60;G.night=false;G.weather='sunny';
    for(const d of residents()){d.job='none';d.state='idle';d.act=null;d.path=[];d.think=9999;
      d.needs={energy:95,hunger:60,fun:45,social:45,bladder:95};}
    function step(seconds){for(let t=0;t<seconds;t+=.05){tickHomeStories(.05);for(const d of residents())if(inHomeTime(d))updateDoll(d,.05);G.time+=.2;}}
    function untilSharing(){for(let i=0;i<2400&&G.home.active?.phase!=='sharing';i++)step(.05);assert.equal(G.home.active?.phase,'sharing');}
    function practice(d,f){assert.ok(startAct(d,{type:FURNITURE[f.id].use,furn:f}));
      for(let i=0;i<2400&&d.act;i++){updateDoll(d,.05);G.time+=.2;}assert.equal(d.act,null);}
    function resetPair(pair){for(const d of pair){if(d.act)endAct(d);d.path=[];d.state='idle';d.job='none';d.needs.energy=95;d.needs.hunger=60;d.needs.bladder=95;}}
  `,ctx);
  vm.runInContext(code,ctx);
}
test('birthday reminders do not charge, teleport gifts or reward absent people',()=>game(`
  const before=JSON.stringify(residents().map(d=>[d.money,d.needs.fun]));const relations=JSON.stringify(G.rel);
  birthdayCheck();assert.equal(JSON.stringify(residents().map(d=>[d.money,d.needs.fun])),before);
  assert.equal(JSON.stringify(G.rel),relations);assert.equal(G.home.album.length,0);
`));
test('birthday guests meet, wish and celebrate once per year, including after reload',()=>game(`
  const [a,b,h]=residents();h.mbti='INTJ';const before=G.fund;
  assert.equal(startHomeTime('birthday',[h.pid,a.pid],h.pid),null);
  assert.equal(G.home.active.detail.quiet,true);assert.equal(G.fund,before);
  untilSharing();assert.equal(birthdayDone(h),false);assert.equal(G.fund,before-20);
  step(30);assert.ok(birthdayDone(h));assert.equal(G.home.album.filter(m=>m.kind==='birthday').length,1);
  assert.match(G.home.album.at(-1).text,/轻声/);assert.equal(paperLogStory(G.log.at(-1).text).label,'有人记得的生日');
  const saved=JSON.parse(JSON.stringify(houseSaveData()));applySave(saved);rebuild();
  const pair=[communityDoll(h.pid),communityDoll(a.pid)];resetPair(pair);
  assert.match(startHomeTime('birthday',pair.map(d=>d.pid),h.pid),/已经/);
  G.day=13;assert.equal(startHomeTime('birthday',pair.map(d=>d.pid),h.pid),null);step(80);
  assert.equal(G.home.album.filter(m=>m.kind==='birthday').length,2);
`));
test('birthday cannot complete without its honoree even when two guests stay',()=>game(`
  const [a,b,h]=residents();assert.equal(startHomeTime('birthday',[h.pid,a.pid,b.pid],h.pid),null);
  untilSharing();endAct(h);step(.1);
  assert.equal(G.home.active,null);assert.equal(birthdayDone(h),false);assert.equal(G.home.album.length,0);
`));
test('birthday invitations respect date, work, strained relationships and real table access',()=>game(`
  const [a,b,h]=residents();assert.match(startHomeTime('birthday',[a.pid,b.pid],a.pid),/本月/);
  h.state='away';assert.match(startHomeTime('birthday',[h.pid,a.pid],h.pid),/回家/);h.state='idle';
  setRelationshipTension(h,a,'ex',h);assert.match(startHomeTime('birthday',[h.pid,a.pid],h.pid),/空间/);delete rel(h,a).tension;
  // A solid obstacle on every possible floor square prevents actual gathering.
  const original=BLOCK;BLOCK=BLOCK.map(column=>column.map(()=>true));
  assert.ok(prepareHomeTime('birthday',[h.pid,b.pid],h.pid).reason);BLOCK=original;
  assert.equal(G.home.album.length,0);
`));
test('birthdays can be initiated by existing friends without creating extra visitors',()=>game(`
  const [a,b,h]=residents();h.mbti='INTJ';rel(h,a).f=60;G.life.nextInvite=0;
  const count=G.dolls.length;tickLifeMoments();assert.equal(G.home.active.kind,'birthday');
  assert.equal(G.home.active.people.length,2);assert.equal(G.dolls.length,count);
  step(80);G.life.nextInvite=0;tickLifeMoments();assert.equal(G.home.active,null);
`));
test('actual completed furniture sessions grow talents; interruption earns nothing and monthly progress is bounded',()=>game(`
  const d=residents()[0],piano=G.furniture.find(f=>f.id==='piano');
  assert.equal(talentRecord(d,'music').xp,0);
  assert.ok(startAct(d,{type:'piano',furn:piano}));
  for(let i=0;i<2000&&d.state!=='act';i++)updateDoll(d,.05);
  updateDoll(d,.5);endAct(d);assert.equal(talentRecord(d,'music').xp,0);
  for(let i=0;i<4;i++){G.time=800;practice(d,piano);}
  assert.equal(talentRecord(d,'music').xp,18);assert.equal(talentLevel(d,'music'),1);
  assert.equal(G.home.album.filter(m=>m.kind==='growth').length,1);
  const saved=JSON.parse(JSON.stringify(houseSaveData()));applySave(saved);rebuild();
  const reloaded=communityDoll(d.pid);G.time=800;practice(reloaded,G.furniture.find(f=>f.id==='piano'));
  assert.equal(talentRecord(reloaded,'music').xp,18);assert.match(talentSummary(reloaded),/连贯的小旋律/);
  G.day++;gainTalent(reloaded,'music',18);G.day++;gainTalent(reloaded,'music',18);
  assert.equal(talentLevel(reloaded,'music'),2);assert.equal(G.home.album.filter(m=>m.kind==='growth').length,2);
`));
test('cooking lessons charge only when both arrive and teach only after they finish',()=>game(`
  const [learner,,,teacher]=residents();teacher.job='baker';const money=G.fund;
  assert.equal(startHomeTime('learnCooking',[learner.pid,teacher.pid],learner.pid),null);
  assert.equal(G.fund,money);assert.equal(talentRecord(learner,'cooking').xp,0);
  for(const d of [learner,teacher]) {
    const tile=d.path.at(-1)||{x:d.tx,y:d.ty},px=HOUSE_X+tile.x*T+8,py=houseY(tile.y*T+14,storeyOf(tile.y));
    assert.ok(!G.furniture.some(f=>{const r=houseFurnitureRect(f);return layerOf(f.id)==='solid'&&storeyOf(f.y)===storeyOf(tile.y)&&r.bottom>py&&r.top<py-5&&px+4>r.x&&px-4<r.x+r.w}), 'teaching participant is visible in the cutaway');
  }
  untilSharing();assert.equal(G.fund,money-15);assert.equal(talentRecord(learner,'cooking').xp,0);
  step(30);assert.equal(talentRecord(learner,'cooking').xp,10);
  assert.equal(G.home.album.at(-1).kind,'learnCooking');assert.match(G.home.album.at(-1).text,/陪.+一起学做饭/);
`));
test('lesson reload regathers the same roles and never double charges or double rewards',()=>game(`
  const [learner,,,teacher]=residents();teacher.job='baker';const money=G.fund;
  assert.equal(startHomeTime('learnCooking',[learner.pid,teacher.pid],learner.pid),null);untilSharing();step(3);
  const saved=JSON.parse(JSON.stringify(houseSaveData()));applySave(saved);rebuild();
  assert.doesNotThrow(()=>readPortableHome(exportHomeSave()));step(80);
  assert.equal(G.fund,money-15);assert.equal(talentRecord(communityDoll(learner.pid),'cooking').xp,10);
  step(80);assert.equal(G.home.album.filter(m=>m.kind==='learnCooking').length,1);
`));
test('lessons reject invalid roles and stop if the teacher is interrupted or disappears',()=>game(`
  const [a,b,c,d]=residents();d.job='baker';
  assert.match(startHomeTime('learnCooking',[a.pid,b.pid],a.pid),/更熟练/);
  assert.match(startHomeTime('learnCooking',[a.pid,b.pid,d.pid],a.pid),/两个人/);
  rel(a,d).f=-10;assert.match(startHomeTime('learnCooking',[a.pid,d.pid],a.pid),/不太愿意/);rel(a,d).f=50;
  assert.equal(startHomeTime('learnCooking',[a.pid,d.pid],a.pid),null);untilSharing();endAct(d);step(.1);
  assert.equal(G.home.active,null);assert.equal(talentRecord(a,'cooking').xp,0);assert.equal(G.home.album.length,0);
  resetPair([a,d]);assert.equal(startHomeTime('learnCooking',[a.pid,d.pid],a.pid),null);
  G.dolls=G.dolls.filter(o=>o!==d);step(.1);assert.equal(G.home.active,null);
`));
test('all lesson themes have concrete exchanges, real furniture and suitable skill changes',()=>game(`
  const [learner,teacher]=residents();teacher.persona='maker';teacher.job='musicTeacher';
  outer:for(let y=4;y<ROWS;y++)for(let x=1;x<COLS-1;x++)if(canPlace('knitting',x,y)){addFurniture('knitting',x,y);rebuild();break outer;}
  for(const kind of ['learnMusic','learnCraft']){
    G.time=480;resetPair([learner,teacher]);teacher.job='musicTeacher';teacher.lastWorkDay=G.day;
    const skill=LESSON_SKILLS[kind],furn=HOME_TIMES[kind].furniture;
    assert.ok(furn.every(id=>FURNITURE[id]),kind);
    const money=G.fund;assert.equal(startHomeTime(kind,[learner.pid,teacher.pid],learner.pid),null);
    assert.ok(lifeTimeLine(G.home.active,teacher,0));assert.ok(lifeTimeLine(G.home.active,learner,1));
    step(80);assert.equal(talentRecord(learner,skill).xp,10);assert.equal(G.fund,money);
  }
`));
test('canceling a birthday prevents repeated automatic invitations while manual retry remains available',()=>game(`
  const [a,b,h]=residents();rel(h,a).f=60;G.life.nextInvite=0;tickLifeMoments();assert.ok(G.home.active);
  cancelHomeTime();resetPair([a,h]);G.life.nextInvite=0;tickLifeMoments();assert.equal(G.home.active,null);
  assert.equal(startHomeTime('birthday',[a.pid,h.pid],h.pid),null);
`));
test('moving an active table regathers everyone instead of completing at its old position',()=>game(`
  const [a,b,h]=residents();assert.equal(startHomeTime('birthday',[h.pid,a.pid],h.pid),null);untilSharing();
  const table=G.furniture.find(f=>f.key===G.home.active.anchor),fund=G.fund;
  table.x=6;table.y=17;rebuild();step(.05);
  assert.equal(G.home.active.phase,'gather');assert.equal(birthdayDone(h),false);
  step(100);assert.equal(birthdayDone(h),true);assert.equal(G.fund,fund);
`));
test('an unfinished birthday or lesson does not grant rewards in a blocked room',()=>game(`
  const [a,b,h]=residents();assert.equal(startHomeTime('birthday',[h.pid,a.pid],h.pid),null);
  const table=G.furniture.find(f=>f.key===G.home.active.anchor);G.furniture=G.furniture.filter(f=>f!==table);step(.1);
  assert.equal(G.home.active,null);assert.equal(G.home.album.length,0);assert.equal(birthdayDone(h),false);
`));
test('a resident can ask a more skilled friend for help, at most once automatically per month',()=>game(`
  const [learner,,,teacher]=residents();teacher.job='baker';rel(learner,teacher).f=60;
  placeDollAt(learner,11,10);placeDollAt(teacher,12,10);G.time=800;
  G.life.inquiries=[{pid:learner.pid,skill:'cooking',month:G.day,after:0}];
  assert.equal(tryLifeLesson(learner),true);assert.equal(G.home.active.detail.teacher,teacher.pid);
  cancelHomeTime();resetPair([learner,teacher]);
  G.life.inquiries=[{pid:learner.pid,skill:'cooking',month:G.day,after:0}];
  assert.equal(tryLifeLesson(learner),false);
  const saved=JSON.parse(JSON.stringify(houseSaveData()));applySave(saved);rebuild();assert.equal(G.life.lastLessonMonth,G.day);
`));
test('new careers depart and return on their schedules, retain savings, and pay exactly once',()=>game(`
  const worker=residents()[0],jobs=['librarian','florist','nurse','chef','musicTeacher','carpenter','programmer','courier'];
  for(const job of jobs){
    worker.job=job;worker.lastWorkDay=0;worker.leaveJitter=0;worker.overtime=false;worker.state='idle';worker.act=null;worker.money=0;G.fund=0;
    G.day=3;G.time=JOBS[job].start-30;assert.equal(leaveAbs(worker),absNow());
    assert.ok(JOBS[job].go.length>=3&&JOBS[job].back.length>=3);assert.ok(START_MONEY[job]>0);
    startLeave(worker);for(let i=0;i<2000&&worker.state!=='away';i++)updateDoll(worker,.05);
    assert.equal(worker.state,'away',job);const expected=Math.round(JOBS[job].wage*(worker.overtime?1.5:1));
    const returnAt=worker.awayUntil;G.day=Math.floor(returnAt/1440)+1;G.time=returnAt%1440;workTick(worker,.05);
    assert.equal(worker.state,'idle',job);assert.equal(worker.money+G.fund,expected,job);
    const total=worker.money+G.fund;workTick(worker,.05);assert.equal(worker.money+G.fund,total);
    G.day=JOBS[job].off[0];worker.lastWorkDay=0;assert.equal(leaveAbs(worker),null,job+' rest month');
  }
  const saved=JSON.parse(JSON.stringify(houseSaveData()));applySave(saved);assert.equal(communityDoll(worker.pid).job,'courier');
`));
test('chef, music teacher and carpenter start with useful skills; nurses also care for late residents',()=>game(`
  const [a,b,c,d]=residents();a.job='chef';b.job='musicTeacher';c.job='carpenter';d.job='nurse';d.persona='active';d.mbti='ESTP';
  assert.equal(talentLevel(a,'cooking'),1);assert.equal(talentLevel(b,'music'),1);assert.equal(talentLevel(c,'craft'),1);
  rel(d,a).f=10;assert.ok(caringFor(d,a));
  rel(d,a).f=-1;assert.equal(caringFor(d,a),false);
  a.persona='lazy';a.mbti='ESTP';a.job='librarian';assert.equal(routineAvailable(a,'catalogue'),true);
`));
test('changing careers during a shift keeps the current wage and applies the new career after returning',()=>game(`
  const d=residents()[0];d.job='chef';G.time=660;exitHome(d);d.overtime=false;d.money=0;G.fund=0;
  assert.ok(changeResidentJob(d,'musicTeacher'));assert.equal(d.job,'chef');assert.equal(d.nextJob,'musicTeacher');
  const saved=JSON.parse(JSON.stringify(houseSaveData()));applySave(saved);rebuild();const r=communityDoll(d.pid);
  G.day=Math.floor(r.awayUntil/1440)+1;G.time=r.awayUntil%1440;workTick(r,.1);
  assert.equal(r.money+G.fund,JOBS.chef.wage);assert.equal(r.job,'musicTeacher');assert.equal(r.nextJob,undefined);
  assert.equal(leaveAbs(r),null);assert.ok(changeResidentJob(r,'student'));assert.equal(r.job,'student');
  r.lastWorkDay=0;changeResidentJob(r,'student');assert.equal(r.lastWorkDay,0,'selecting the current career does not skip work');
`));
test('old saves migrate and malformed progress or missing event roles cannot be imported',()=>game(`
  const saved=JSON.parse(JSON.stringify(houseSaveData()));delete saved.life;applySave(saved);rebuild();
  assert.doesNotThrow(()=>readPortableHome(exportHomeSave()));
  const data=JSON.parse(JSON.stringify(houseSaveData()));data.life.people.bad={music:{xp:-3,month:1,earned:0}};
  assert.throws(()=>validatePortableHome(data),/本领/);
  delete data.life.people.bad;data.home.active={kind:'birthday',people:residents().slice(0,2).map(d=>d.pid),anchor:'x',deadline:9999,detail:{year:1,honoree:'missing'}};
  assert.throws(()=>validatePortableHome(data),/主角/);
`));
test('test mode waives lesson and birthday costs but still requires participation',()=>game(`
  const [a,b,h]=residents();const fund=G.fund;assert.equal(startHomeTime('birthday',[h.pid,a.pid],h.pid),null);step(80);
  assert.equal(G.fund,fund);assert.equal(birthdayDone(h),true);
`,'test'));
