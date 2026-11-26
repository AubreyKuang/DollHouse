#!/usr/bin/env node
/* Portrait gameplay video for the TapTap store page, recorded from the built package.

     python3 build.py && python3 scripts/build-taptap.py
     node scripts/record-taptap-video.cjs     # docs/taptap/gameplay-1080x1920.mp4

   TapTap asks for at least 15 s, a short side of at least 540 px and core play within
   the first 5 s, with no voice-over, subtitles or picture-in-picture. The clip opens
   on the house; within the first seconds the player taps a resident and sends them
   to the piano, then carries one resident over to another, speeds time up, buys and
   places a piece of furniture, tries outfits in the wardrobe and watches the house
   into the evening. All input is real taps and drags on the page. The words on
   screen are the game's own interface and speech bubbles. Needs ffmpeg with libx264
   and Chrome. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const {execFileSync} = require('node:child_process');
const {root, sleep, gameSession} = require('./lib/taptap-chrome.cjs');

// 360×640 CSS px at 3× → 1080×1920.
const VIEWPORT = {width: 360, height: 640, deviceScaleFactor: 3, mobile: true};
const output = path.join(root, 'docs/taptap/gameplay-1080x1920.mp4');

// Client coordinates of a resident (by index among those at home) or a piece of furniture.
const RESIDENT = n => `const ds=G.dolls.filter(d=>d.state!=='away'&&d.state!=='lift'&&!lying(d));const d=ds[${n}%ds.length];
  const h=houseHeadPoint(d),r=cv.getBoundingClientRect();
  return {x:r.left+h.x/(W+HOUSE_MARGIN)*r.width,y:r.top+(h.y+9)/HOUSE_HEIGHT*r.height,name:d.name}`;
const FURNITURE = id => `const SW=W+HOUSE_MARGIN,r=cv.getBoundingClientRect();let sx=0,sy=0,n=0;
  for(let y=0;y<HOUSE_HEIGHT;y+=2)for(let x=0;x<SW;x+=2)if(furnAt({x,y})?.id===${JSON.stringify(id)}){sx+=x;sy+=y;n++;}
  if(!n)return null;return {x:r.left+sx/n/SW*r.width,y:r.top+sy/n/HOUSE_HEIGHT*r.height}`;

async function main() {
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'dollhouse-video-'));
  const game = await gameSession(VIEWPORT), {send, on} = game;
  const recorded = []; let recording = false;
  on('Page.screencastFrame', ({data, metadata, sessionId}) => {
    send('Page.screencastFrameAck', {sessionId}).catch(() => {});
    if (!recording) return;
    const file = path.join(frames, `f${String(recorded.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, 'base64')); recorded.push({file, t: metadata.timestamp});
  });
  const tapAt = async point => { if (!point) throw new Error('nothing to tap'); await game.clickAt(point.x, point.y); };
  const drag = async (from, to, ms = 900) => {
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1});
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 30, button: 'left', buttons: 1});
      await sleep(ms / steps);
    }
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1});
  };
  try {
    await game.open(); await sleep(800);
    await send('Page.startScreencast', {format: 'jpeg', quality: 90, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1});
    recording = true; await sleep(700);

    // Pick a resident and send them to the piano.
    await tapAt(await game.evaluate(RESIDENT(0))); await sleep(900);
    await tapAt(await game.evaluate(FURNITURE('piano'))); await sleep(2200);
    // Carry another resident over to a third one: they stop to talk.
    const from = await game.evaluate(RESIDENT(1)), to = await game.evaluate(RESIDENT(2));
    await drag(from, {x: to.x + 14, y: to.y}); await sleep(2600);
    // Speed time up from the control menu and watch for a while.
    await game.click('#houseControls summary'); await sleep(350);
    await game.click('[data-speed="3"]'); await sleep(300);
    await game.click('#houseControls summary'); await sleep(3200);

    // Buy a decoration and place it with two taps on the same tile.
    await game.click('.house-dock [data-mode="build"]'); await sleep(700);
    await game.click('[data-tab="decor"]'); await sleep(500);
    await game.click('#palette .item:not(.locked)'); await sleep(600);
    await game.evaluate(`scrollTo({top:0,behavior:'smooth'})`); await sleep(500);
    const tile = await game.evaluate(`const id=G.build.placing.id,SW=W+HOUSE_MARGIN,r=cv.getBoundingClientRect();
      for(let sy=Math.round(HOUSE_HEIGHT*.75);sy>0;sy-=3)for(let sx=Math.round(SW*.2);sx<SW;sx+=3){const g=houseTile({x:sx,y:sy},id);
        if(g&&g.y>=0&&canPlace(id,g.x,g.y,null))return {x:r.left+sx/SW*r.width,y:r.top+sy/HOUSE_HEIGHT*r.height};}`);
    await tapAt(tile); await sleep(700);
    await tapAt(tile); await sleep(1300);
    await game.key('Escape', 'Escape', 50);
    await game.click('.house-dock [data-mode="live"]'); await sleep(1500);

    // The wardrobe: try a couple of looks, then back to the house.
    await game.click('#btnWardrobe'); await sleep(1200);
    for (let i = 0; i < 3; i++) { await game.click('#wdRandom'); await sleep(900); }
    await game.click('#wdClose'); await sleep(800);

    // Into the evening at fast speed.
    await tapAt(await game.evaluate(RESIDENT(1))); await sleep(5000);
    recording = false; await send('Page.stopScreencast');
    if (game.errors.length) throw new Error('page errors: ' + game.errors.join('\n'));
  } finally { game.close(); }

  if (recorded.length < 100) throw new Error('too few frames recorded: ' + recorded.length);
  const list = recorded.map((f, i) => {
    const next = recorded[i + 1]?.t ?? f.t + 1 / 30;
    return `file '${f.file}'\nduration ${Math.max(next - f.t, 1 / 60).toFixed(4)}`;
  }).join('\n') + `\nfile '${recorded.at(-1).file}'\n`;
  fs.writeFileSync(path.join(frames, 'list.txt'), list);
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(frames, 'list.txt'),
    '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '20', '-preset', 'slow',
    '-an', '-movflags', '+faststart', output], {stdio: 'inherit'});
  fs.rmSync(frames, {recursive: true, force: true});
  const seconds = recorded.at(-1).t - recorded[0].t;
  console.log(`${path.relative(root, output)}  ${seconds.toFixed(1)}s  ${(fs.statSync(output).size / 1048576).toFixed(1)}MB  ${recorded.length} frames (${(recorded.length / seconds).toFixed(0)} fps captured)`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
