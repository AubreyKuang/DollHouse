// Optional documentation renderer: DOLLHOUSE_CANVAS_MODULE may point to an installed @napi-rs/canvas.
const fs=require('fs'),vm=require('vm'),path=require('path');
process.chdir(path.join(__dirname,'..'));
const {createCanvas,GlobalFonts}=require(process.env.DOLLHOUSE_CANVAS_MODULE || '@napi-rs/canvas');
const font=process.env.DOLLHOUSE_FONT || '/System/Library/Fonts/Hiragino Sans GB.ttc';
if(fs.existsSync(font))GlobalFonts.registerFromPath(font,'PingFang SC');
const ctx=vm.createContext({createCanvas,capture:(canvas,file)=>fs.writeFileSync(file,canvas.toBuffer('image/png'))});
for(const f of ['js/data.js','js/sprites.js','js/doll.js'])vm.runInContext(fs.readFileSync(f,'utf8'),ctx,{filename:f});
vm.runInContext(`
const cv=createCanvas(1024,868),c=cv.getContext('2d');
c.fillStyle='#f5eee0';c.fillRect(0,0,1024,868);
function label(text,x,y,size=15,col='#6b5650'){c.fillStyle=col;c.font=size+'px "PingFang SC"';c.fillText(text,x,y);}
label('小屋衣橱 · 今天想穿什么？',32,44,28,'#493743');
label('12 套生活穿搭  /  游戏实际像素绘制  /  可自由组合',32,73,15);
const hairs=['pixie','doublebun','braids','sidepart','halfup','lowpony','wavy','pony','curl','halfup','sidepart','curl'];
const colors=[1,11,0,10,12,2,5,1,13,1,0,11];
function doll(look,x,y,scale,dir='down',pose='stand',frame=0){c.save();c.translate(x,y);c.scale(scale,scale);drawDoll(c,0,0,look,{dir,pose,frame,happy:true});c.restore();}
OUTFIT_SETS.forEach((set,i)=>{
 const x=24+i%4*246,y=94+Math.floor(i/4)*184;
 c.fillStyle='#e4d5c4';c.fillRect(x,y+3,238,174);c.fillStyle='#fffaf0';c.fillRect(x,y,238,174);
 label(set.name,x+14,y+26,17,'#493743');
 const look={skin:i%5,hair:hairs[i],hairColor:colors[i],...set.look};
 doll(look,x+65,y+145,4);doll(look,x+142,y+139,3,'right','walk',1);doll(look,x+199,y+139,3,'up');
});
label('9 款新发型 · 小小轮廓，也有自己的个性',32,684,20,'#493743');
const newHair=Object.keys(OUTFIT.hair).slice(6,15);
newHair.forEach((hair,i)=>{
 const x=66+i*111;
 const look={...OUTFIT_SETS[0].look,skin:1,hair,hairColor:1,acc:'none',extra:'none'};
 doll(look,x,794,3);label(OUTFIT.hair[hair],x-30,824,14);
});
capture(cv,'docs/wardrobe-collection.png');

`,ctx);
console.log('Rendered docs/wardrobe-collection.png from the game sprite functions.');
