// Actual game sprites, not concept art. Optional @napi-rs/canvas documentation renderer.
const fs=require('fs'),vm=require('vm'),path=require('path');
process.chdir(path.join(__dirname,'..'));
const {createCanvas,GlobalFonts}=require(process.env.DOLLHOUSE_CANVAS_MODULE || '@napi-rs/canvas');
const font=process.env.DOLLHOUSE_FONT || '/System/Library/Fonts/Hiragino Sans GB.ttc';
if(fs.existsSync(font))GlobalFonts.registerFromPath(font,'PingFang SC');
const ctx=vm.createContext({createCanvas,capture:(canvas,file)=>fs.writeFileSync(file,canvas.toBuffer('image/png'))});
for(const f of ['js/data.js','js/sprites.js','js/doll.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
vm.runInContext(`
const cv=createCanvas(1024,1370),c=cv.getContext('2d');
c.imageSmoothingEnabled=false;c.fillStyle='#f5eee0';c.fillRect(0,0,cv.width,cv.height);
function label(text,x,y,size=15,col='#6b5650'){c.fillStyle=col;c.font=size+'px "PingFang SC"';c.fillText(text,x,y);}
function doll(look,x,y,scale,dir='down'){c.save();c.translate(x,y);c.scale(scale,scale);drawDoll(c,0,0,look,{dir,happy:true});c.restore();}
label('小屋新面孔 · 24 套完整形象',28,43,28,'#493743');
label('游戏实际像素绘制 · 正面 / 侧面 / 背面 · 在衣橱中自由试穿',28,72,15);
for(const [group,gender] of ['f','m'].entries()){
 const gy=108+group*615;
 label(gender==='f'?'女生形象 · 12 套':'男生形象 · 12 套',28,gy,20,'#493743');
 RESIDENT_LOOK_SETS.filter(s=>s.gender===gender).forEach((set,i)=>{
  const x=24+(i%4)*246,y=gy+17+Math.floor(i/4)*184;
  c.fillStyle='#e3d4c3';c.fillRect(x,y+3,238,173);c.fillStyle='#fffaf0';c.fillRect(x,y,238,173);
  label(set.name,x+13,y+25,17,'#493743');
  doll(set.look,x+58,y+141,4);doll(set.look,x+140,y+136,3,'right');doll(set.look,x+198,y+136,3,'up');
  label(OUTFIT.hair[set.look.hair],x+13,y+163,12,'#8b7668');
 });
}
label('新增：中分短发、清爽寸发、蓬松短发、侧编发。保留原版小人的比例与像素风格。',28,1350,14);
capture(cv,'docs/resident-presets.png');
`,ctx);
console.log('Rendered docs/resident-presets.png from the actual game sprite functions.');
