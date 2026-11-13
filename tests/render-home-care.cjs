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
  load();rebuild();G.time=20*60;G.weather='sunny';G.sky='#56567c';G.dark=.3;G.night=true;
  for(const d of residents()){d.job='none';d.state='idle';d.act=null;d.path=[];d.think=9999;d.needs={energy:80,hunger:45,fun:70,social:70,bladder:90};}
  const cook=residents()[3],guest=residents()[2],table=G.furniture.find(f=>f.id==='table');
  for(const [i,d] of residents().filter(d=>d!==cook&&d!==guest).entries()){
    const tile=nearestFree(6+i*3,FLOOR_SPLIT+4);if(tile)placeDollAt(d,tile.x,tile.y);
  }
  guest.job='office';guest.state='away';guest.lastWorkDay=G.day;guest.awayUntil=21*60;guest.needs.energy=22;rel(cook,guest).f=65;
  const poster=makeCanvas(1024,460),p=poster.getContext('2d');p.fillStyle='#f5eee0';p.fillRect(0,0,1024,460);
  function label(text,x,y,size=16){p.font=size+'px "PingFang SC"';p.fillStyle='#5e4845';p.fillText(text,x,y);}
  label('回家时，有人为我留了饭',28,41,28);label('桌上的一份饭、一张便签，和之后的一声谢谢。',28,70,16);
  function step(seconds){for(let t=0;t<seconds;t+=.05){G.t+=.05;tickHomeCare();for(const d of residents())if(d.act||d.state==='away')updateDoll(d,.05);G.time+=.2;}}
  function panel(i,title,subtitle){
    render();const rect=houseFurnitureRect(table),x=24+i*332;
    p.fillStyle='#fffbf2';p.fillRect(x,91,312,344);label(title,x+12,120,19);
    p.imageSmoothingEnabled=false;
    // Crop the living room directly from the game canvas, without recreating its layout.
    const left=HOUSE_X+BX*T,top=STOREYS[0].wall-7,width=W-BX*T,height=STOREYS[0].front-top+12;
    p.drawImage(cv,left*SCENE_SCALE,top*SCENE_SCALE,width*SCENE_SCALE,height*SCENE_SCALE,x+8,143,296,Math.round(height/width*296));
    label(subtitle,x+12,411,13);
  }
  assert.equal(planSavedMeal(cook),true);assert.equal(tryHomeCare(cook),true);step(30);
  assert.equal(G.care.meals[0].phase,'ready');panel(0,'01 · 给你留了一份','盖好饭，亮起小灯，便签写上你的名字。');
  comeHome(guest);assert.equal(tryHomeCare(guest),true);
  for(let i=0;i<1000&&guest.state!=='act';i++)step(.05);
  step(1.3);panel(1,'02 · 晚归也有热饭','走到桌前，拿起碗，一口一口慢慢吃。');
  capture(cv,'docs/late-supper.png');step(8);
  assert.equal(G.care.meals[0].phase,'eaten');
  G.day++;G.time=9*60;G.night=false;G.dark=0;G.sky='#a4cee2';guest.job='none';
  for(const d of [guest,cook]){if(d.act)endAct(d);d.state='idle';d.think=9999;}
  placeDollAt(guest,11,10);placeDollAt(cook,12,10);
  assert.equal(tryHomeCare(guest),true);step(2);panel(2,'03 · 之后，见面再说','「上次那份饭，谢谢你。我都记着呢。」');
  capture(poster,'docs/late-supper-story.png');
  const details=makeCanvas(1024,430),c=details.getContext('2d');c.fillStyle='#f5eee0';c.fillRect(0,0,1024,430);
  c.fillStyle='#493743';c.font='27px "PingFang SC"';c.fillText('还是熟悉的小人，多一点生活里的表情',28,40);
  const states=[['平时的样子',{}],['说话时动动手',{gesture:'talk',frame:1}],['端着一碗饭',{prop:'bowl'}],['吃一口，歇一会儿',{prop:'bowl',gesture:'eat',expression:'content',frame:1}]];
  for(let i=0;i<4;i++){
    const x=24+i*250; c.fillStyle='#fffbf2';c.fillRect(x,63,234,190);
    c.fillStyle='#69524d';c.font='17px "PingFang SC"';c.fillText(states[i][0],x+12,91);
    for(let k=0;k<2;k++){c.save();c.translate(x+65+k*100,229);c.scale(5,5);drawDoll(c,0,0,DEFAULT_SAVE.dolls[k===0?3:2].look,{dir:k?'right':'down',...states[i][1]});c.restore();}
  }
  const fspec=Object.entries(OUTFIT.features);
  for(let i=0;i<4;i++){
    const x=24+i*250;c.fillStyle='#69524d';c.font='17px "PingFang SC"';c.fillText(fspec[i][1],x+12,290);
    for(let k=0;k<2;k++){c.save();c.translate(x+65+k*100,400);c.scale(4,4);drawDoll(c,0,0,{...OUTFIT_SETS[0].look,skin:1,hair:k?'pony':'doublebun',hairColor:1,features:fspec[i][0]},{dir:k?'right':'down',happy:true});c.restore();}
  }
  capture(details,'docs/resident-details.png');
`,context);
console.log('Rendered actual home-care scenes and resident animation details.');
}
main().catch(error=>{console.error(error);process.exitCode=1});
