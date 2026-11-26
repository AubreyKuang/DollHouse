#!/usr/bin/env node
/* Plays the built TapTap package in headless Chrome and checks where the house is
   saved, then that it comes back after a reload:

     python3 build.py && python3 scripts/build-taptap.py && node tests/storage-browser.cjs

   1. a plain browser: localStorage
   2. a TapTap-like host: a `tap` object with setStorageSync (1MB per key)
   3. nowhere to save: no tap, localStorage throws
   In each the player speeds time up, buys a piece of furniture and places it with
   real clicks on the canvas, and switches off 「离开时继续」. Needs Node 22+ and Chrome. */
const assert = require('node:assert/strict');
const {sleep, gameSession} = require('../scripts/lib/taptap-chrome.cjs');
const VIEWPORT = {width: 390, height: 844, deviceScaleFactor: 1, mobile: true};

const TAP_HOST = `const backing=window.localStorage;
  window.tap={getSystemInfoSync:()=>({platform:"android"}),
    getStorageSync:key=>backing.getItem("tap:"+key)??"",
    setStorageSync(key,value){if(new Blob([String(value)]).size>1048576)throw new Error("setStorageSync:fail exceed max size");backing.setItem("tap:"+key,String(value));},
    removeStorageSync:key=>backing.removeItem("tap:"+key)};`;
const NOWHERE = `Object.defineProperty(window,"localStorage",{configurable:true,get(){throw new DOMException("denied","SecurityError");}});`;

const state = game => game.evaluate(`return {kind:HouseStorage.kind,host:TapTapHost.inHost,fund:G.fund,day:G.day,time:Math.floor(G.time),
  furniture:G.furniture.length,speed:G.speed,offline:offlineEnabled(),saveOk:G.saveOk,toast:document.getElementById('toast').textContent,
  saveButton:document.getElementById('btnSaveHome').textContent}`);

async function play(game) {
  // Fast-forward from the control menu.
  await game.click('#houseControls summary');
  await game.click('[data-speed="3"]');
  await game.click('#houseOffline');
  await game.click('#houseControls summary');
  // Buy the first affordable decoration and place it with two taps on the same tile.
  await game.click('.house-dock [data-mode="build"]');
  await game.click('[data-tab="decor"]');
  const id = await game.evaluate(`const item=[...document.querySelectorAll('#palette .item')].find(b=>!b.classList.contains('locked')&&!b.querySelector('.poor'));
    item.scrollIntoView({block:'nearest'});const r=item.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}`)
    .then(async box => { await game.clickAt(box.x, box.y); return game.evaluate(`return G.build.placing?.id`); });
  assert.ok(id, 'a decoration is in hand');
  const spot = await game.evaluate(`const id=${JSON.stringify(id)},SW=W+HOUSE_MARGIN,r=cv.getBoundingClientRect();
    for(let sy=HOUSE_HEIGHT-1;sy>0;sy-=3)for(let sx=4;sx<SW;sx+=3){const g=houseTile({x:sx,y:sy},id);
      if(g&&canPlace(id,g.x,g.y,null))return {x:r.left+sx/SW*r.width,y:r.top+sy/HOUSE_HEIGHT*r.height};}
    return null`);
  assert.ok(spot, 'there is room for ' + id);
  const before = await state(game);
  await game.clickAt(spot.x, spot.y); await sleep(150);
  await game.clickAt(spot.x, spot.y); await sleep(150);
  await game.click('.house-dock [data-mode="live"]');
  await sleep(6000); // At least one autosave tick at fast-forward.
  const after = await state(game);
  assert.equal(after.furniture, before.furniture + 1, 'the furniture was placed');
  assert.ok(after.fund < before.fund, 'it was paid from the family fund');
  assert.equal(after.speed, 3); assert.equal(after.offline, false);
  return {id, ...after};
}

async function scenario(name, preload, check) {
  const game = await gameSession(VIEWPORT, {preload});
  try {
    await game.open();
    await check(game);
    assert.deepEqual(game.errors, [], 'no uncaught errors');
    console.log('ok -', name);
  } finally { game.close(); }
}

async function main() {
  await scenario('a plain browser keeps the house in localStorage', '', async game => {
    const played = await play(game);
    assert.equal(played.kind, 'local'); assert.equal(played.host, false); assert.equal(played.saveOk, true);
    await game.open();
    const after = await state(game);
    assert.equal(after.furniture, played.furniture); assert.equal(after.fund, played.fund);
    assert.equal(after.offline, false);
    console.log('   ', JSON.stringify({played, after}));
  });
  await scenario('a TapTap-like host keeps the house in tap storage', TAP_HOST, async game => {
    const played = await play(game);
    assert.equal(played.kind, 'tap'); assert.equal(played.host, true); assert.equal(played.saveOk, true);
    assert.equal(await game.evaluate(`return document.documentElement.classList.contains('taptap-host')`), true);
    const keys = await game.evaluate(`return Object.keys(localStorage)`);
    assert.ok(keys.length && keys.every(k => k.startsWith('tap:')), 'everything went through tap.setStorageSync: ' + keys);
    assert.ok(keys.includes('tap:pixel-dollhouse-v1'));
    await game.open();
    const after = await state(game);
    assert.equal(after.kind, 'tap');
    assert.equal(after.furniture, played.furniture); assert.equal(after.fund, played.fund);
    assert.equal(after.offline, false);
    console.log('   ', JSON.stringify({played, after, keys: keys.length}));
  });
  await scenario('with nowhere to save, the house still plays and says so once', NOWHERE, async game => {
    const start = await state(game);
    assert.equal(start.kind, 'memory');
    assert.match(start.saveButton, /无法保存/);
    let toasts = new Set();
    for (let i = 0; i < 30; i++) { toasts.add(await game.evaluate(`return document.getElementById('toast').textContent`)); await sleep(100); }
    assert.equal([...toasts].filter(t => /当前环境无法保存进度/.test(t)).length, 1, 'the notice shows: ' + [...toasts]);
    const played = await play(game);
    assert.ok(played.day > start.day || played.time > start.time, 'time moves on');
    await game.click('#houseControls summary');
    await game.click('#btnSaveHome');
    assert.match(await game.evaluate(`return document.getElementById('saveState').textContent`), /无法保存进度/);
    await game.open();
    const after = await state(game);
    assert.equal(after.furniture, start.furniture, 'a reload starts a fresh house');
    console.log('   ', JSON.stringify({start, played}));
  });
}
main().catch(e => { console.error(e); process.exit(1); });
