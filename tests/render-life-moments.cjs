// Optional actual-game documentation renderer, requires @napi-rs/canvas.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const { createCanvas, GlobalFonts, loadImage } = require(process.env.DOLLHOUSE_CANVAS_MODULE || '@napi-rs/canvas');
const font = process.env.DOLLHOUSE_FONT || '/System/Library/Fonts/Hiragino Sans GB.ttc';
if (fs.existsSync(font)) GlobalFonts.registerFromPath(font, 'PingFang SC');
const callbacks = {};
const storage = new Map();
const elements = {};
function element(tag) {
  const canvas = tag === 'canvas' ? createCanvas(324, 352) : {};
  Object.assign(canvas, {
    style: { setProperty() {} }, children: [], clientWidth: 324, offsetWidth: 40,
    append(...children) { this.children.push(...children); },
    remove(){}, querySelectorAll(){return []},
    addEventListener(name, fn){callbacks[name]=fn;}, setPointerCapture(){},
    getBoundingClientRect(){return {left:0,top:0,width:this.width,height:this.height};}
  });
  return canvas;
}
async function main() {
const html = fs.readFileSync('index.html','utf8');
const context = vm.createContext({
  document: {body: {dataset: {mode: html.includes('data-mode="test"') ? 'test' : ''}},getElementById(id) { return elements[id] ??= element(id === 'cv' ? 'canvas' : 'div'); }, createElement:element},
  localStorage: {getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  setTimeout(){}, window:{addEventListener(){}}, console
});
for (const [, source, content] of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
  if (source?.split('?')[0] === 'js/ui.js' || content.includes('function updateKeepsakeDialog')) break;
  const path = source?.split('?')[0];
  const script = path ? fs.readFileSync(path,'utf8') : content;
  vm.runInContext(script, context, {filename:path || 'bundle'});
}
context.callbacks = callbacks;
context.assert = assert;


context.makeCanvas = (w, h) => Object.assign(createCanvas(w, h), { style: {} });
context.capture = (c, path) => fs.writeFileSync(path, c.toBuffer('image/png'));
vm.runInContext(`
  load();rebuild();G.time=18*60;G.weather='sunny';G.sky='#c9c0cd';G.dark=.12;G.night=false;
  for(const d of residents()){d.job='none';d.state='idle';d.act=null;d.path=[];d.think=9999;d.needs={energy:95,hunger:55,fun:65,social:65,bladder:95};}
  const [learner,other,honoree,teacher]=residents();
  const poster=makeCanvas(1024,645),p=poster.getContext('2d');p.fillStyle='#f5eee0';p.fillRect(0,0,1024,645);
  function label(text,x,y,size=16){p.font=size+'px "PingFang SC"';p.fillStyle='#5e4845';p.fillText(text,x,y);}
  label('小屋里，值得记住的小事',28,42,28);label('生日有人陪，弹错有人教，慢慢长出自己的拿手活。',28,73,16);
  function step(seconds){for(let t=0;t<seconds;t+=.05){G.t+=.05;tickHomeStories(.05);for(const d of residents())if(inHomeTime(d))updateDoll(d,.05);G.time+=.2;}}
  function gather(){for(let i=0;i<2400&&G.home.active?.phase!=='sharing';i++)step(.05);assert.equal(G.home.active?.phase,'sharing');}
  function panel(i,title,quote,caption){
    render();const x=24+i*500;
    p.fillStyle='#fffbf2';p.fillRect(x,96,476,524);label(title,x+18,128,21);
    const left=HOUSE_X+BX*T,top=STOREYS[0].wall-7,width=W-BX*T,height=STOREYS[0].front-top+12;
    p.imageSmoothingEnabled=false;
    p.drawImage(cv,left*SCENE_SCALE,top*SCENE_SCALE,width*SCENE_SCALE,height*SCENE_SCALE,x+12,152,452,Math.round(height/width*452));
    label(quote,x+18,575,16);label(caption,x+18,605,13);
  }
  for(const d of [learner,other])placeDollAt(d,6,FLOOR_SPLIT+4);
  honoree.mbti='INTJ';assert.equal(startHomeTime('birthday',[honoree.pid,teacher.pid],honoree.pid),null);
  gather();step(4);panel(0,'01 · 轻声说一句生日快乐','「不用唱得很大声……这样就很好。」','寿星走到桌前，烛光、手写卡片和身边的人都在。');
  step(30);assert.ok(birthdayDone(honoree));
  for(const d of [honoree,other])placeDollAt(d,6,FLOOR_SPLIT+4);
  for(const d of [learner,teacher]){if(d.act)endAct(d);d.state='idle';d.needs.energy=95;d.needs.hunger=55;}
  G.time=18*60;teacher.job='chef';teacher.lastWorkDay=G.day;
  assert.equal(startHomeTime('learnCooking',[learner.pid,teacher.pid],learner.pid),null);
  gather();step(4);panel(1,'02 · 这道菜，是你教我的','「锅别太急，先把火调小一点。」','一起走到灶台，边做边学；做完才留下新的本领。');
  step(30);assert.equal(talentRecord(learner,'cooking').xp,10);
  capture(poster,'docs/life-moments.png');
`,context);
console.log('Rendered actual birthday and cooking lesson scenes.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
