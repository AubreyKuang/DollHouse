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

test('adjacent reading corners affect the autonomous choice and restore social needs only once', () => game(`
  const [a,b,...others] = residents();
  for (const other of others) other.state = 'away';
  const first = addFurniture('shelf', 10, 16), second = addFurniture('shelf', 13, 16);
  G.furniture = [first,second];
  for (const [person, furniture] of [[a,first],[b,second]]) {
    G.keepsakes.corners[furniture.key] = {kind:'read', owner:person.pid, regulars:[person.pid], visits:{}};
    placeDollAt(person, furniture.x, 17);
    person.needs.social = 24;
  }
  rebuild();
  rel(a,b).f = 60;
  b.state = 'act'; b.act = {type:'read',furn:second}; second.users = [b];
  assert.ok(readingCornerBonus(a,first) > 0);
  second.x += 2;
  assert.equal(readingCornerBonus(a,first),0);
  second.x -= 2;
  a.needs.fun = 0;
  decide(a);
  assert.equal(a.act?.furn,first);
  for(let i=0;i<50 && a.state!=='act';i++) updateDoll(a,.1);
  assert.equal(a.state,'act');
  const social = b.needs.social;
  assert.equal(social,32);
  noteCornerUse(a,first);
  assert.equal(b.needs.social,social);
`));

test('a reader can decline once, move after a second greeting, or finish in a quiet spot', () => game(`
  const [reader,walker,other] = residents();
  G.dolls = [reader,walker,other];
  const window = addFurniture('window', 10, 0), chair = addFurniture('chair', 11, 4);
  G.furniture = [window,chair];
  rebuild();
  rel(reader,walker).f=55;
  rel(reader,other).f=55;
  function readAt(x,y){
    chair.x=x;chair.y=y;rebuild();
    placeDollAt(reader,x,y+1);
    assert.equal(orderUse(reader,chair),true);
    arrive(reader);
    assert.equal(reader.act.type,'read');
  }
  function walkPast(d=walker){
    placeDollAt(d,10,5);
    d.state='walk';d.path=[{x:11,y:5},{x:12,y:5}];d.act={type:'wander'};
    for(let i=0;i<30&&d.state==='walk';i++)updateDoll(d,.1);
  }
  reader.needs.social=88;
  reader.mbti='INTJ';
  readAt(11,4);
  walkPast();
  assert.equal(reader.act.type,'read');
  assert.equal(reader.bubble.text,'等我读完这一页。');
  const remaining=reader.act.t;
  updateDoll(reader,.5);
  assert.equal(reader.act.t,remaining);
  walkPast();
  assert.equal(reader.act.type,'read');
  assert.equal(G.log.filter(e=>e.text.includes('接着看书')).length,1);
  const spareWindow=addFurniture('window',4,0), spare=addFurniture('chair',5,4);
  rebuild();
  walkPast(other);
  assert.equal(reader.act?.furn,spare);
  assert.ok(G.log.some(e=>e.text.includes('合上了书')));
  assert.equal(JSON.parse(JSON.stringify(houseSaveData())).keepsakes.readingGreetings.month,G.day);
  endAct(reader);
  G.day++;
  readAt(13,7);
  walkPast();
  assert.equal(reader.act.type,'read');
  updateDoll(reader,reader.act.t+.01);
  assert.equal(reader.bubble.text,'这一段读完了。');
  assert.equal(G.log.filter(e=>e.text.includes('合上了书')).length,1);
  G.day++;
  readAt(11,4);
  reader.mbti='ENFP';
  const tv = addFurniture('tv',12,4);
  rebuild();
  placeDollAt(walker,10,5);
  assert.equal(startAct(walker,{type:'tv',furn:tv,path:[{x:11,y:5},{x:12,y:5}]}),true);
  for(let i=0;i<30&&walker.state==='walk';i++)updateDoll(walker,.1);
  assert.equal(walker.act.type,'tv');
  assert.equal(walker.state,'act');
  assert.equal(reader.act.type,'read');
  assert.equal(G.log.filter(e=>e.text.includes('聊了几句书')).length,1);
`));

test('study quiet protects reading without blocking access and preserves the setting across saves', () => game(`
  const [reader,walker,...others] = residents();
  for (const other of others) other.state = 'away';
  const window = addFurniture('window', 9, UPPER_WALL), chair = addFurniture('chair', 10, 16);
  const shelf = addFurniture('shelf', 12, 16);
  G.furniture = [window,chair,shelf];
  placeDollAt(reader,10,17);
  rel(reader,walker).f=55;
  reader.mbti='ENFP';
  reader.needs.social=25;walker.needs.social=25;
  G.keepsakes.corners[chair.key]={kind:'read',regulars:[reader.pid],visits:{}};
  G.keepsakes.corners[shelf.key]={kind:'read',regulars:[walker.pid],visits:{}};
  rebuild();
  orderUse(reader,chair);arrive(reader);
  assert.equal(reader.act?.type,'read');
  assert.equal(G.studyQuiet,false);
  placeDollAt(walker,8,17);
  function pass(){
    placeDollAt(walker,9,17);
    walker.state='walk';walker.path=[{x:10,y:17},{x:11,y:17}];walker.act={type:'wander'};
    for(let i=0;i<40&&walker.state==='walk';i++)updateDoll(walker,.1);
  }
  assert.equal(readingNeighbor(walker,shelf),reader);
  G.studyQuiet=true;
  assert.equal(readingNeighbor(walker,shelf),undefined);
  walker.mbti='INTJ';walker.needs.social=88;
  assert.equal(readingCornerBonus(walker,shelf),12);
  walker.needs.social=25;
  assert.equal(readingCornerBonus(walker,shelf),0);
  assert.ok(findPath(7,UPPER_DOOR_Y,[{x:8,y:UPPER_DOOR_Y}]));
  pass();
  assert.equal(walker.tx,11);
  assert.equal(reader.act.type,'read');
  assert.equal(reader.needs.social,25);
  assert.equal(G.keepsakes.readingGreetings,null);
  G.studyQuiet=false;
  pass();
  assert.equal(reader.needs.social,31);
  G.studyQuiet=true;
  save();load();
  assert.equal(G.studyQuiet,true);
  const legacy=houseSaveData();
  delete legacy.studyQuiet;
  applySave(legacy);
  assert.equal(G.studyQuiet,false);
`));

test('a timed study sign resumes across a save and expires at the hour even across months', () => game(`
  G.time=23*60+40;
  const chair=addFurniture('chair',10,16);
  const until=absNow()+STUDY_QUIET_MINUTES;
  G.studyQuietUntil=until;
  assert.equal(quietStudy(chair),true);
  assert.equal(save(),true);
  load();
  assert.equal(G.studyQuiet,false);
  assert.equal(G.studyQuietUntil,until);
  G.day++;
  G.time=39.99;
  assert.equal(quietStudy(chair),true);
  G.time=40;
  assert.equal(quietStudy(chair),false);
  assert.equal(houseSaveData().studyQuietUntil,null);
  const invalid={...houseSaveData(),studyQuietUntil:absNow()+61};
  applySave(invalid);
  assert.equal(G.studyQuietUntil,null);
  applySave({...invalid,studyQuiet:true});
  assert.equal(quietStudy(chair),true);
  assert.equal(G.studyQuietUntil,null);
`));

test('an individual window seat protects its reader while the next seat can still host conversation', () => game(`
  const [a,b,walker,...others]=residents();
  for(const d of others)d.state='away';
  const window=addFurniture('window',9,UPPER_WALL);
  const quiet=addFurniture('chair',10,16,{soloReading:true}),open=addFurniture('chair',11,16);
  G.furniture=[window,quiet,open];rebuild();
  for(const d of [a,b,walker]) {
    d.mbti='ENFP';d.needs.social=25;d.needs.hunger=80;
  }
  rel(a,walker).f=55;rel(b,walker).f=55;rel(a,b).f=55;
  G.keepsakes.corners[quiet.key]={kind:'read',regulars:[a.pid],visits:{}};
  G.keepsakes.corners[open.key]={kind:'read',regulars:[b.pid],visits:{}};
  placeDollAt(a,10,17);orderUse(a,quiet);arrive(a);
  placeDollAt(b,11,17);orderUse(b,open);arrive(b);
  assert.equal(readingNeighbor(b,open),undefined);
  placeDollAt(walker,11,17);walker.act={type:'wander'};
  greetPassingReader(walker,{x:10,y:17});
  assert.equal(a.needs.social,25);
  assert.equal(b.needs.social,31);
  G.studyQuiet=true;
  assert.equal(quietReading(open),true);
  G.studyQuiet=false;
  save();load();
  assert.equal(quietReading(G.furniture.find(f=>f.key===quiet.key)),true);
  assert.equal(quietReading(G.furniture.find(f=>f.key===open.key)),false);
`));

test('a note never interrupts reading and only pays off on completion with an available writer', () => {
  for (const outcome of ['nearby', 'away', 'interrupted', 'whole-room quiet']) game(`
    const [reader,writer,...others]=residents();
    for(const d of others)d.state='away';
    const window=addFurniture('window',9,UPPER_WALL);
    const chair=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
    G.furniture=[window,chair];rebuild();
    save();load();
    const seat=G.furniture.find(f=>f.key===chair.key);
    const a=communityDoll(reader.pid),b=communityDoll(writer.pid);
    assert.equal(seat.readingNotes,true);
    for(const d of [a,b]) {
      d.job='none';d.needs={energy:90,hunger:90,fun:40,social:25,bladder:90};
    }
    rel(a,b).f=55;
    placeDollAt(a,10,17);assert.ok(orderUse(a,seat));arrive(a);
    const time=a.act.t;
    G.studyQuiet='${outcome}'==='whole-room quiet';
    placeDollAt(b,10,17);b.act={type:'wander'};
    greetPassingReader(b,{x:9,y:17});
    assert.equal(a.act.readingNote,G.studyQuiet?undefined:b.pid);
    assert.equal(a.act.readingPause,undefined);
    assert.equal(a.act.t,time);
    assert.equal(a.needs.social,25);
    b.state='${outcome}'==='away'?'away':'idle';b.act=null;
    if('${outcome}'==='interrupted')endAct(a);
    else { a.act.t=.01;updateDoll(a,.05); }
    assert.equal(Math.round(a.needs.social),'${outcome}'==='nearby'?31:25);
    assert.equal(b.needs.social,'${outcome}'==='nearby'?31:25);
    assert.equal(G.log.filter(entry=>entry.text.includes('留下便条')).length,'${outcome}'==='nearby'?1:0);
  `);
});

test('a missed reading chat leaves one recommendation until the end of the next month', () => game(`
  const [author,writer,other]=residents();
  const window=addFurniture('window',9,UPPER_WALL);
  const chair=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[window,chair];rebuild();
  writer.state='away';
  finishReadingNote(author,{furn:chair,readingNote:writer.pid});
  assert.equal(bookRecommendation(chair)?.to,writer.pid);
  assert.equal(finishBookRecommendation(other,chair),false);
  assert.equal(save(),true);load();
  const seat=G.furniture.find(f=>f.key===chair.key),reader=communityDoll(writer.pid);
  G.day++;
  assert.equal(readingCornerBonus(reader,seat),24);
  const note=bookRecommendation(seat);
  G.day++;
  assert.equal(bookRecommendation(seat),null);
  G.day--;
  assert.equal(bookRecommendation(seat),note);
  reader.job='none';reader.state='idle';reader.needs.fun=50;
  placeDollAt(reader,10,17);assert.ok(orderUse(reader,seat));arrive(reader);
  endAct(reader);assert.equal(bookRecommendation(seat),note);
  assert.ok(orderUse(reader,seat));arrive(reader);
  reader.act.t=.01;updateDoll(reader,.05);
  assert.equal(bookRecommendation(seat),null);
  assert.equal(Math.round(reader.needs.fun),58);
  assert.equal(finishBookRecommendation(reader,seat),false);
`));

test('holding a recommendation seat blocks other residents, persists and expires automatically', () => game(`
  const [author,reader,other]=residents();
  const window=addFurniture('window',9,UPPER_WALL);
  const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[window,seat];rebuild();
  G.keepsakes.bookRecommendations[seat.key]={from:author.pid,to:reader.pid,until:G.day+1};
  other.state='idle';reader.state='idle';
  placeDollAt(other,10,17);placeDollAt(reader,10,17);
  assert.ok(startAct(other,{furn:seat}));arrive(other);
  assert.equal(toggleBookSeat(seat),false);
  endAct(other);
  G.time=23*60+40;
  assert.equal(toggleBookSeat(seat),true);
  assert.equal(reservedBookReader(seat),reader);
  assert.match(furnitureOrderBlock(other,seat),/暂时留给/);
  assert.equal(startAct(other,{furn:seat}),false);
  assert.ok(startAct(reader,{furn:seat}));arrive(reader);endAct(reader);
  save();load();
  const chair=G.furniture.find(f=>f.key===seat.key);
  assert.equal(reservedBookReader(chair).pid,reader.pid);
  G.day++;G.time=40;
  assert.equal(reservedBookReader(chair),null);
  assert.equal(bookRecommendation(chair).to,reader.pid);
  assert.equal(toggleBookSeat(chair),true);
  assert.equal(toggleBookSeat(chair),true);
  assert.equal(reservedBookReader(chair),null);
`));

test('moving a recommendation carries the original hold to a free window seat and survives reload', () => game(`
  const [author,reader,other]=residents();
  const [source,target]=[[10,16],[11,4]].map(([x,y])=>addFurniture('chair',x,y,{soloReading:true,readingNotes:true}));
  G.furniture=[addFurniture('window',9,UPPER_WALL),addFurniture('window',10,0),source,target];rebuild();
  const note={from:author.pid,to:reader.pid,until:G.day+1};
  const notes=G.keepsakes.bookRecommendations;
  notes[source.key]=note;
  assert.ok(toggleBookSeat(source));
  const deadline=note.seatUntil;
  G.time+=20;
  assert.equal(moveBookRecommendation(source,source),false);
  target.readingNotes=false;
  assert.equal(moveBookRecommendation(source,target),false);
  target.readingNotes=true;
  notes[target.key]={from:other.pid,to:author.pid,until:G.day+1};
  assert.equal(moveBookRecommendation(source,target),false);
  delete notes[target.key];
  target.users.push(other);
  assert.equal(moveBookRecommendation(source,target),false);
  target.users.length=0;
  source.users.push(reader);
  assert.equal(moveBookRecommendation(source,target),false);
  source.users.length=0;
  const realSave=save;
  save=()=>false;
  const staleNote={...note,until:G.day-1};
  notes[target.key]=staleNote;
  assert.equal(moveBookRecommendation(source,target),false);
  assert.equal(notes[target.key],staleNote);
  assert.equal(bookRecommendation(source),note);
  assert.equal(reservedBookReader(source),reader);
  save=realSave;
  assert.equal(moveBookRecommendation(source,target),true);
  assert.equal(bookRecommendation(source),null);
  assert.equal(reservedBookReader(target),reader);
  assert.equal(note.seatUntil,deadline);
  load();
  const moved=G.furniture.find(f=>f.key===target.key),old=G.furniture.find(f=>f.key===source.key);
  assert.equal(bookRecommendation(moved).seatUntil,deadline);
  assert.equal(reservedBookReader(old),null);
  assert.equal(reservedBookReader(moved).pid,reader.pid);
  assert.equal(finishBookRecommendation(communityDoll(reader.pid),moved),true);
  assert.equal(bookRecommendation(moved),null);
  assert.equal(reservedBookReader(moved),null);
`));

test('a saved discussion exchanges solo fun for shared social recovery only when both residents can talk', () => {
  for (const situation of ['together', 'away', 'busy', 'quiet room', 'unplanned']) game(`
    const [author,reader]=residents();
    const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
    G.furniture=[addFurniture('window',9,UPPER_WALL),seat];rebuild();
    G.keepsakes.bookRecommendations[seat.key]={from:author.pid,to:reader.pid,until:G.day+1};
    const planned='${situation}'!=='unplanned';
    if(planned)assert.ok(toggleBookDiscussion(seat));
    assert.ok(save());load();
    const a=communityDoll(author.pid),r=communityDoll(reader.pid),chair=G.furniture.find(f=>f.key===seat.key);
    const relationship=rel(r,a),expectedFriendship=relationship.f+2*relationship.chem*compat(r,a);
    assert.equal(bookRecommendation(chair).discuss===true,planned);
    for(const d of [a,r]){
      d.state='idle';d.job='none';d.needs={energy:80,hunger:80,bladder:80,fun:40,social:30};
    }
    placeDollAt(r,10,17);placeDollAt(a,11,17);
    if('${situation}'==='away')a.state='away';
    if('${situation}'==='busy')a.state='walk';
    G.studyQuiet='${situation}'==='quiet room';
    assert.ok(orderUse(r,chair));arrive(r);
    r.act.t=.01;updateDoll(r,.05);
    const together='${situation}'==='together';
    assert.deepEqual([Math.round(r.needs.fun),Math.round(r.needs.social),a.needs.social,rel(r,a).f],
      [together?40:48,together?36:30,together?36:30,expectedFriendship]);
    assert.equal(bookRecommendation(chair),null);
    assert.equal(finishBookRecommendation(r,chair),false);
  `);
});

test('a public recommendation rewards two distinct residents across reloads and releases the private hold', () => game(`
  const [author,reader,other]=residents();
  const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[addFurniture('window',9,UPPER_WALL),seat];rebuild();
  const note={from:author.pid,to:reader.pid,until:G.day+1,discuss:true};
  G.keepsakes.bookRecommendations[seat.key]=note;
  assert.ok(toggleBookSeat(seat));
  const write=save;
  save=()=>false;
  assert.equal(togglePublicBook(seat),false);
  assert.equal(bookRecommendation(seat),note);
  assert.equal(reservedBookReader(seat),reader);
  save=write;
  assert.ok(togglePublicBook(seat));
  assert.equal(reservedBookReader(seat),null);
  assert.equal(toggleBookDiscussion(seat),false);
  assert.ok(togglePublicBook(seat));
  assert.equal(publicBookReaders(bookRecommendation(seat)),null);
  assert.ok(togglePublicBook(seat));
  assert.equal(finishBookRecommendation(author,seat),false);
  assert.equal(readingCornerBonus(other,seat),12);
  assert.ok(finishBookRecommendation(reader,seat));
  assert.equal(reader.needs.fun,54);
  assert.equal(togglePublicBook(seat),false);
  assert.ok(save());load();
  const chair=G.furniture.find(f=>f.key===seat.key),first=communityDoll(reader.pid),second=communityDoll(other.pid);
  assert.equal(finishBookRecommendation(first,chair),false);
  assert.ok(finishBookRecommendation(second,chair));
  assert.equal(second.needs.fun,54);
  assert.equal(bookRecommendation(chair),null);
`));

test('a picked second reader persists, can be released, and exclusively earns the larger reward', () => game(`
  const [author,first,chosen,other]=residents();
  const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[addFurniture('window',9,UPPER_WALL),seat];rebuild();
  const note={from:author.pid,to:first.pid,until:G.day+1,readBy:[]};
  G.keepsakes.bookRecommendations[seat.key]=note;
  assert.equal(pickNextBookReader(seat,chosen.pid),false);
  assert.ok(finishBookRecommendation(first,seat));
  assert.equal(pickNextBookReader(seat,first.pid),false);
  assert.equal(pickNextBookReader(seat,author.pid),false);
  const write=save;
  save=()=>false;
  assert.equal(pickNextBookReader(seat,chosen.pid),false);
  assert.equal(bookRecommendation(seat),note);
  save=write;
  assert.ok(pickNextBookReader(seat,chosen.pid));
  assert.equal(finishBookRecommendation(other,seat),false);
  assert.ok(pickNextBookReader(seat,''));
  assert.equal(pickedBookReader(bookRecommendation(seat)),null);
  assert.ok(pickNextBookReader(seat,chosen.pid));
  load();
  const chair=G.furniture.find(f=>f.key===seat.key),reader=communityDoll(chosen.pid),bystander=communityDoll(other.pid);
  assert.equal(bookRecommendation(chair).until,note.until);
  assert.equal(pickedBookReader(bookRecommendation(chair)),reader);
  assert.equal(finishBookRecommendation(bystander,chair),false);
  const day=G.day;
  G.day=note.until+1;assert.equal(finishBookRecommendation(reader,chair),false);G.day=day;
  assert.ok(finishBookRecommendation(reader,chair));
  assert.equal(reader.needs.fun,56);
  assert.equal(bystander.needs.fun,50);
  assert.equal(bookRecommendation(chair),null);
`));

test('the first public reader can send a private reply with the original deadline', () => game(`
  const [author,reader,other]=residents();
  const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[addFurniture('window',9,UPPER_WALL),seat];rebuild();
  const note={from:author.pid,to:other.pid,until:G.day+1,readBy:[]};
  G.keepsakes.bookRecommendations[seat.key]=note;
  assert.equal(replyToBookRecommendation(seat),false);
  assert.ok(finishBookRecommendation(reader,seat));
  seat.users.push(other);
  assert.equal(replyToBookRecommendation(seat),false);
  seat.users.pop();
  const write=save;
  save=()=>false;
  assert.equal(replyToBookRecommendation(seat),false);
  assert.equal(bookRecommendation(seat),note);
  save=write;
  assert.ok(replyToBookRecommendation(seat));
  load();
  const chair=G.furniture.find(f=>f.key===seat.key);
  const a=communityDoll(author.pid),r=communityDoll(reader.pid),o=communityDoll(other.pid);
  const reply=bookRecommendation(chair);
  assert.deepEqual({...reply},{from:r.pid,to:a.pid,until:note.until,reply:true});
  assert.equal(replyToBookRecommendation(chair),false);
  assert.equal(togglePublicBook(chair),false);
  assert.equal(toggleBookDiscussion(chair),false);
  assert.equal(submitBookToPaper(chair),false);
  assert.equal(finishBookRecommendation(o,chair),false);
  const day=G.day;
  G.day=reply.until+1;assert.equal(finishBookRecommendation(a,chair),false);G.day=day;
  const relationship=rel(a,r),expectedFriendship=relationship.f+2*relationship.chem*compat(a,r);
  assert.ok(finishBookRecommendation(a,chair));
  assert.deepEqual([a.needs.fun,r.needs.fun,o.needs.fun,relationship.f],[58,54,50,expectedFriendship]);
  assert.equal(bookRecommendation(chair),null);
  assert.equal(finishBookRecommendation(a,chair),false);
  assert.match(G.log.at(-1).text,/荐书回信/);
`));

test('a partially shared book can reserve a monthly paper slot instead of a second reading', () => game(`
  const [author,reader,other]=residents();
  const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[addFurniture('window',9,UPPER_WALL),seat];rebuild();
  G.keepsakes.bookRecommendations[seat.key]={from:author.pid,to:reader.pid,until:G.day+1,readBy:[]};
  assert.equal(submitBookToPaper(seat),false);
  assert.ok(finishBookRecommendation(reader,seat));
  const write=save;
  save=()=>false;
  assert.equal(submitBookToPaper(seat),false);
  assert.equal(bookPaperDraft(),undefined);
  assert.equal(bookRecommendation(seat).readBy.length,1);
  save=write;
  assert.ok(submitBookToPaper(seat));
  assert.equal(finishBookRecommendation(other,seat),false);
  load();
  const draft=bookPaperDraft();
  assert.ok(draft);
  const chair=G.furniture.find(f=>f.key===seat.key);
  const replacement={from:author.pid,to:other.pid,until:G.day+1,readBy:[other.pid]};
  G.keepsakes.bookRecommendations[seat.key]=replacement;
  assert.equal(submitBookToPaper(chair),false);
  assert.equal(submitBookToPaper(chair,{...draft}),false);
  save=()=>false;
  assert.equal(submitBookToPaper(chair,draft),false);
  assert.equal(bookPaperDraft(),draft);
  assert.equal(bookRecommendation(chair),replacement);
  save=write;
  assert.ok(submitBookToPaper(chair,draft));
  load();
  assert.equal(G.paperMoments.filter(moment=>moment.result?.[0]==='窗边书摘').length,1);
  for(let i=0;i<30;i++)recordPaperMeeting(communityDoll(author.pid),communityDoll(reader.pid),'chat','together');
  addLog('甲和乙分手了');addLog('甲陪乙过了生日');addLog('甲慢慢练出了新本领');
  finishHouseMonth();
  const issue=G.paper.at(-1);
  assert.equal(issue.stories.length,3);
  const story=issue.stories.find(story=>story.label==='窗边书摘');
  assert.equal(story.steps.length,3);
  assert.deepEqual(story.people.map(d=>d.name),[author.name,other.name]);
`));

test('a kept book records both readers and can replace a draft after reload', () => game(`
  const [author,first,second,other]=residents();
  const seat=addFurniture('chair',10,16,{soloReading:true,readingNotes:true});
  G.furniture=[addFurniture('window',9,UPPER_WALL),seat];rebuild();
  const note={from:author.pid,to:first.pid,until:G.day+1,readBy:[first.pid]};
  G.keepsakes.bookRecommendations[seat.key]=note;
  const write=save;
  save=()=>false;assert.equal(keepSharedBookForPaper(seat),false);
  assert.equal(bookRecommendation(seat),note);
  save=write;
  assert.ok(keepSharedBookForPaper(seat));
  assert.ok(keepSharedBookForPaper(seat));
  assert.equal(bookRecommendation(seat).keepForPaper,false);
  assert.ok(keepSharedBookForPaper(seat));
  assert.equal(bookPaperDraft(),undefined);
  assert.ok(pickNextBookReader(seat,second.pid));
  assert.ok(finishBookRecommendation(second,seat));
  assert.equal(second.needs.fun,56);
  assert.equal(finishBookRecommendation(other,seat),false);
  assert.equal(keepSharedBookForPaper(seat),false);
  assert.equal(replyToBookRecommendation(seat),false);
  const existing={month:G.day,result:[BOOK_PAPER_LABEL,'📖','已有书摘',77]};
  G.paperMoments=[existing];
  assert.ok(save());load();
  const chair=G.furniture.find(f=>f.key===seat.key);
  assert.equal(bookPaperReaders(chair).length,2);
  assert.equal(submitBookToPaper(chair),false);
  const draft=bookPaperDraft();
  assert.ok(submitBookToPaper(chair,draft));
  assert.equal(bookRecommendation(chair),null);
  finishHouseMonth();
  const excerpts=G.paper.at(-1).stories.filter(story=>story.label===BOOK_PAPER_LABEL);
  assert.equal(excerpts.length,1);
  assert.deepEqual(excerpts[0].people.map(d=>d.name),[author.name,first.name,second.name]);
  assert.equal(excerpts[0].steps.length,4);
`));

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

test('deferring a wish lets another resident speak and survives a reload', () => game(`
  const [a,b,c,d] = residents();
  $('#btnHome').onclick();
  $('#homeWishes').children[0].children[1].children.at(-1).onclick();
  assert.equal(homeWishLine(a),null);
  assert.ok(homeWishLine(b) && homeWishLine(c));
  G.home=restoreHomeStories(JSON.parse(JSON.stringify(G.home)));
  ensureHomeWishes();
  assert.equal(homeWishLine(a),null);
  renderHomeWishes();
  $('#homeWishes').children[0].children[1].children.at(-1).onclick();
  assert.ok(homeWishLine(c) && homeWishLine(d));
  G.day++;
  ensureHomeWishes();
  assert.equal(G.home.wishes.some(w=>w.deferred),false);
`, undefined, true));

test('two-person gatherings build more trust for the same pair than group gatherings', () => game(`
  const all=residents(), [a,b]=all;
  assert.equal(startHomeTime('stories',all.map(d=>d.pid)),null);
  advanceHome(80);
  const groupTrust=trustOf(a,b);
  assert.ok(groupTrust>0);
  assert.equal(startHomeTime('stories',[a.pid,b.pid]),null);
  advanceHome(80);
  assert.equal(trustOf(a,b)-groupTrust,2);
  assert.ok(groupTrust<2);
`));

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
