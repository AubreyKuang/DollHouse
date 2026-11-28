#!/usr/bin/env node
/* Plays the built TapTap package in headless Chrome inside a TapTap-like host that has
   a rewarded-video API, and checks the 街坊赞助 button:

     python3 build.py && python3 scripts/build-taptap.py && node tests/ads-browser.cjs

   With no ad unit id in js/taptap.js (ads not opened yet) the button must stay hidden
   even though the host could play a video. With an id, it must pay the family fund only
   for a video watched to the end, count down the five a day, and survive a reload.
   Needs Node 22+ and Chrome. */
const assert = require('node:assert/strict');
const {sleep, gameSession} = require('../scripts/lib/taptap-chrome.cjs');
const VIEWPORT = {width: 390, height: 844, deviceScaleFactor: 1, mobile: true};

// `adNext` decides how the next video ends: 'end', 'skip' or 'nofill'.
const AD_HOST = `const backing=window.localStorage;window.adNext='end';window.adLog=[];
  window.tap={getSystemInfoSync:()=>({platform:"android"}),
    getStorageSync:key=>backing.getItem("tap:"+key)??"",
    setStorageSync(key,value){backing.setItem("tap:"+key,String(value));},
    removeStorageSync:key=>backing.removeItem("tap:"+key),
    createRewardedVideoAd(options){let close=()=>{};window.adLog.push('create '+options.adUnitId);
      return {onClose(fn){close=fn;},onError(){},onLoad(){},
        load(){return window.adNext==='nofill'?Promise.reject(new Error('no fill')):Promise.resolve();},
        show(){if(window.adNext==='nofill')return Promise.reject(new Error('not loaded'));
          const how=window.adNext;window.adLog.push('show '+how);setTimeout(()=>close({isEnded:how==='end'}),150);return Promise.resolve();}};}};`;

const state = game => game.evaluate(`const b=document.getElementById('btnSponsor');
  return {id:AD_UNIT_ID,available:TapTapAds.available,fund:G.fund,level:G.level,ads:G.ads,hidden:b.hidden,disabled:b.disabled,text:b.textContent,
    visible:!b.hidden&&b.getBoundingClientRect().width>0,toast:document.getElementById('toast').textContent,adLog:window.adLog,
    log:G.log.at(-1)?.text}`);

(async () => {
  const game = await gameSession(VIEWPORT, {preload: AD_HOST});
  try {
    await game.open();
    await game.click('.house-dock [data-mode="build"]');
    await sleep(700);
    const start = await state(game);
    if (!start.id) {
      assert.equal(start.available, false);
      assert.equal(start.hidden, true, 'no ad unit id: the button is not shown');
      assert.deepEqual(start.adLog, [], 'and no video object is created');
      console.log('no ad unit id yet: 街坊赞助 stays hidden, no ad is requested  ✓');
      return;
    }
    assert.equal(start.visible, true, 'the button is on the shop bar');
    assert.match(start.text, /^广告看一段视频，街坊赞助 ¥300（今天还剩 5 次）$/);
    console.log('button:', start.text);

    await game.click('#btnSponsor'); await sleep(600);
    const paid = await state(game);
    assert.equal(paid.fund, start.fund + 300, 'a finished video pays ¥300 at level 1');
    assert.equal(paid.ads.count, 1); assert.match(paid.text, /还剩 4 次/); assert.match(paid.log, /街坊赞助/);
    console.log('watched to the end:', paid.toast);

    await game.evaluate(`window.adNext='skip'`);
    await game.click('#btnSponsor'); await sleep(600);
    const skipped = await state(game);
    assert.equal(skipped.fund, paid.fund, 'closing early pays nothing'); assert.equal(skipped.ads.count, 1);
    console.log('closed early:', skipped.toast);

    await game.evaluate(`window.adNext='nofill'`);
    await game.click('#btnSponsor'); await sleep(600);
    const empty = await state(game);
    assert.equal(empty.fund, paid.fund, 'no ad, no reward'); assert.equal(empty.ads.count, 1);
    console.log('no fill:', empty.toast);

    await game.evaluate(`window.adNext='end'`);
    for (let i = 0; i < 4; i++) { await game.click('#btnSponsor'); await sleep(600); }
    const done = await state(game);
    assert.equal(done.fund, start.fund + 1500); assert.equal(done.ads.count, 5);
    assert.equal(done.disabled, true, 'five a day'); assert.match(done.text, /领完了/);
    await game.evaluate(`sponsor()`); await sleep(400);
    assert.equal((await state(game)).fund, done.fund, 'nothing more today');
    assert.equal(done.adLog.filter(l => l.startsWith('create')).length, 1, 'one video object for the whole visit');
    console.log('after five:', done.text);

    // A short fund makes the button hop instead of opening anything.
    await game.evaluate(`G.ads=null;G.fund=0;HOOK.refresh();expand()`); await sleep(200);
    assert.equal(await game.evaluate(`return document.getElementById('btnSponsor').classList.contains('nudge')`), true);
    await game.evaluate(`G.fund=${done.fund};G.ads={day:realDay(),count:5};HOOK.refresh();save()`);

    await game.open(); await game.click('.house-dock [data-mode="build"]'); await sleep(700);
    const back = await state(game);
    assert.equal(back.fund, done.fund, 'the fund is saved'); assert.equal(back.ads.count, 5); assert.equal(back.disabled, true);
    await game.evaluate(`G.ads.day='2000-1-1';HOOK.refresh()`); await sleep(100);
    assert.match((await state(game)).text, /还剩 5 次/, 'a new day gives five again');
    assert.deepEqual(game.errors, [], 'no page errors');
    console.log('saved across a reload, resets the next day  ✓');
  } finally { game.close(); }
})().catch(e => { console.error(e.message); process.exit(1); });
