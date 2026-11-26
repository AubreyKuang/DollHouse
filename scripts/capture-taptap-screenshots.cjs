#!/usr/bin/env node
/* Portrait store screenshots of the built TapTap package, played in headless Chrome
   with phone touch input (DevTools protocol; Node 22+).

     python3 build.py && python3 scripts/build-taptap.py
     node scripts/capture-taptap-screenshots.cjs      # docs/taptap/screenshots/*.jpg

   One new house, played in order: the first morning, picking a resident, buying a
   piece of furniture, the wardrobe, 小屋时光, the residents list, evening, and the
   next month's paper. Hours pass through the game's own 「离开时继续」 catch-up
   (catchUpOffline), the same simulation that runs while the page is closed.
   Nothing is drawn over the game. */
const fs = require('node:fs'), path = require('node:path');
const {root, sleep, gameSession} = require('./lib/taptap-chrome.cjs');

const out = path.join(root, 'docs/taptap/screenshots');
// 360×640 CSS px at 3× → 1080×1920.
const VIEWPORT = {width: 360, height: 640, deviceScaleFactor: 3, mobile: true};

async function main() {
  const game = await gameSession(VIEWPORT);
  const shot = async name => {
    await sleep(400);
    const check = await game.evaluate(`return {text:document.body.innerText,clock:document.getElementById('clock').textContent,day:document.getElementById('dayLabel').textContent}`);
    if (/无法保存|保存失败/.test(check.text)) throw new Error(name + ': save warning on screen');
    const {data} = await game.send('Page.captureScreenshot', {format: 'jpeg', quality: 92});
    fs.writeFileSync(path.join(out, name + '.jpg'), Buffer.from(data, 'base64'));
    console.log('captured', name, check.day, check.clock);
  };
  // Leave the house for a while and come back, as the game does after a closed page.
  const away = minutes => game.evaluate(`catchUpOffline(Date.now()-${minutes}/MIN_PER_SEC*1000);
    renderLog();HOOK.select();updateClock();renderShopBar();updateHousePaperButton();return Math.floor(G.time)`);
  try {
    fs.mkdirSync(out, {recursive: true});
    await game.open(); await sleep(1500);
    await shot('01-morning');

    // Tap a resident who is at home: the card and a suggested activity appear.
    const resident = await game.evaluate(`const d=G.dolls.find(d=>d.state!=='away'&&!lying(d));const h=houseHeadPoint(d);
      const r=cv.getBoundingClientRect();return {x:r.left+h.x/(W+HOUSE_MARGIN)*r.width,y:r.top+(h.y+8)/HOUSE_HEIGHT*r.height}`);
    await game.clickAt(resident.x, resident.y); await sleep(600);
    await shot('02-resident');

    // Build mode: buy a hobby piece and place it downstairs with two taps on the same tile.
    await game.click('.house-dock [data-mode="build"]');
    await game.click('[data-tab="hobbies"]');
    await game.click('#palette .item:not(.locked)');
    await game.evaluate(`scrollTo(0,0)`);
    const tile = await game.evaluate(`const id=G.build.placing.id,SW=W+HOUSE_MARGIN,r=cv.getBoundingClientRect();
      for(let sy=Math.round(HOUSE_HEIGHT*.8);sy>0;sy-=3)for(let sx=Math.round(SW*.25);sx<SW;sx+=3){const g=houseTile({x:sx,y:sy},id);
        if(g&&g.y>=0&&canPlace(id,g.x,g.y,null))return {x:r.left+sx/SW*r.width,y:r.top+sy/HOUSE_HEIGHT*r.height};}`);
    const before = await game.evaluate(`return G.furniture.length`);
    await game.clickAt(tile.x, tile.y); await sleep(200);
    await game.clickAt(tile.x, tile.y); await sleep(300);
    if (await game.evaluate(`return G.furniture.length`) !== before + 1) throw new Error('the furniture was not placed');
    await sleep(2400); // Let the purchase prompt fade.
    await game.evaluate(`scrollTo(0,document.documentElement.scrollHeight)`);
    await shot('03-build');
    await game.key('Escape', 'Escape', 50);
    await game.evaluate(`scrollTo(0,0)`);
    await game.click('.house-dock [data-mode="live"]');

    await game.click('#btnWardrobe'); await sleep(500);
    await shot('04-wardrobe');
    await game.click('#wdClose');

    await game.click('#btnHome'); await sleep(500);
    await shot('05-home-time');
    await game.click('#homeDialog form button');

    await away(240);
    await game.click('#side summary'); await sleep(500);
    await shot('06-residents');
    await game.click('#side summary');

    // Evening: lamps and the lit windows.
    const now = await game.evaluate(`return G.time`);
    await away(Math.max(0, 20.5 * 60 - now)); await sleep(1200);
    await shot('07-evening');

    // Past midnight a new month starts and its paper comes out.
    await away(1440 - (await game.evaluate(`return G.time`)) + 30); await sleep(1500);
    if (!(await game.evaluate(`return document.getElementById('paperDialog').open`))) await game.click('#dailyPaper');
    await sleep(600);
    await shot('08-paper');
    if (game.errors.length) throw new Error('page errors: ' + game.errors.join('\n'));
  } finally { game.close(); }
}
main().catch(e => { console.error(e.message); process.exit(1); });
