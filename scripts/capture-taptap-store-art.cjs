#!/usr/bin/env node
/* TapTap store art rendered by the game itself (no outside images, no added fonts):

     python3 build.py && python3 scripts/build-taptap.py
     node scripts/capture-taptap-store-art.cjs

   docs/taptap/icon.png              1:1 icon: the house canvas at its native 4× scale,
                                     cut square from the left (the far end of the stairs
                                     is trimmed), no interface, name tags or speech
                                     bubbles; square corners, opaque
   docs/taptap/banner-1920x1080.jpg  16:9 promo image: the same house beside the game
                                     name 「像素小屋」 and its English name DollHouse,
                                     on the game's own page background
   docs/taptap/banner-1440x1440.jpg  1:1 promo image (needed with a portrait video)

   TapTap rejects promo images that carry any words besides the game's names, so the
   clock, buttons, hints, name tags and speech bubbles are all hidden. */
const fs = require('node:fs'), path = require('node:path');
const {execFileSync} = require('node:child_process');
const {root, sleep, gameSession} = require('./lib/taptap-chrome.cjs');
const out = path.join(root, 'docs/taptap');

// Keep only the house canvas (and, for the promo images, the two names in the colour
// of the game's own title bar).
const STAGE = (layout, names) => `const stage=document.getElementById('stage'),cv=document.getElementById('cv');
  const art=document.createElement('div');art.id='storeArt';art.dataset.layout=${JSON.stringify(layout)};
  if(${names}){const t=document.createElement('div');t.className='art-title';
    const zh=document.createElement('b');zh.textContent='像素小屋';const en=document.createElement('span');en.textContent='DollHouse';
    t.append(zh,en);art.append(t);}
  art.append(stage);document.body.append(art);
  const ratio=cv.width/cv.height,color=getComputedStyle(document.querySelector('.topbar h1')).color;
  const style=document.createElement('style');style.textContent=\`
    body>*:not(#storeArt){display:none!important}
    #overlay,#toast{display:none!important}
    #storeArt{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
    #storeArt[data-layout=icon] #stage{width:\${cv.width}px;height:\${cv.height}px;border:0;border-radius:0;box-shadow:none;margin:0}
    #storeArt[data-layout=wide]{gap:64px}
    #storeArt[data-layout=wide] #stage{height:470px;width:\${470*ratio}px}
    #storeArt[data-layout=square]{flex-direction:column;gap:22px}
    #storeArt[data-layout=square] #stage{height:540px;width:\${540*ratio}px}
    .art-title{display:flex;flex-direction:column;align-items:center;color:\${color};font-family:var(--font-display);line-height:1}
    .art-title b{font-weight:400;font-size:84px;letter-spacing:10px;text-shadow:0 4px 0 #0005}
    .art-title span{margin-top:18px;font-size:34px;letter-spacing:6px;opacity:.75;font-family:var(--font-display)}
    #storeArt[data-layout=square] .art-title b{font-size:64px;letter-spacing:8px}
    #storeArt[data-layout=square] .art-title span{margin-top:10px;font-size:26px}\`;
  document.head.append(style);`;

async function capture(viewport, file, format, layout, names, clip) {
  const game = await gameSession(viewport);
  try {
    await game.open();
    // A little of the first morning: residents up and about, the snow falling.
    await sleep(2500);
    await game.evaluate(STAGE(layout, names));
    await sleep(600);
    const words = await game.evaluate(`return document.body.innerText.trim()`);
    if (words.replace(/\s+/g, '') !== (names ? '像素小屋DollHouse' : '')) throw new Error(file + ': words on screen: ' + words);
    const box = clip && await game.evaluate(`const r=document.getElementById('cv').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}`);
    const options = format === 'png' ? {format} : {format, quality: 92};
    if (box) { const side = Math.min(box.width, box.height); options.clip = {x: box.x, y: box.y + box.height - side, width: side, height: side, scale: 1}; }
    const {data} = await game.send('Page.captureScreenshot', options);
    fs.writeFileSync(path.join(out, file), Buffer.from(data, 'base64'));
    if (game.errors.length) throw new Error('page errors: ' + game.errors.join('\n'));
  } finally { game.close(); }
}

async function main() {
  fs.mkdirSync(out, {recursive: true});
  await capture({width: 960, height: 540, deviceScaleFactor: 2, mobile: false}, 'banner-1920x1080.jpg', 'jpeg', 'wide', true);
  await capture({width: 720, height: 720, deviceScaleFactor: 2, mobile: false}, 'banner-1440x1440.jpg', 'jpeg', 'square', true);
  // The canvas is drawn at 4× scene pixels; showing it 1:1 keeps every pixel sharp.
  await capture({width: 1400, height: 1300, deviceScaleFactor: 1, mobile: false}, 'icon.png', 'png', 'icon', false, true);
  // Icons must be opaque: drop the alpha channel PNG screenshots carry.
  execFileSync('python3', ['-c', `from PIL import Image
import os
p=${JSON.stringify(path.join(out, 'icon.png'))}
Image.open(p).convert("RGB").save(p,optimize=True)
for f in ("icon.png","banner-1920x1080.jpg","banner-1440x1440.jpg"):
    q=${JSON.stringify(out)}+"/"+f;i=Image.open(q)
    print(f,i.size,i.mode,str(os.path.getsize(q)//1024)+"KB")`], {stdio: 'inherit'});
}
main().catch(e => { console.error(e.message); process.exit(1); });
