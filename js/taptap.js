/* TapTap H5 host. TapTap injects a global `tap` object; in a normal browser it is
   absent and this file does nothing. DollHouse is a single-player game with no server
   and no account: it never calls tap.login and sends nothing anywhere itself. Inside
   the host it marks the page and, once an ad unit is configured, can play a rewarded
   video the player asked for; saving goes through HouseStorage. */
const TapTapHost = (() => {
  const host = () => {
    const tap = globalThis.tap;
    return !!tap && typeof tap === 'object' && ['setStorageSync', 'getSystemInfoSync', 'onShow', 'login'].some(name => typeof tap[name] === 'function');
  };
  let marked = false;
  function mark() {
    if (marked || !host()) return;
    marked = true;
    globalThis.document?.documentElement?.classList?.add('taptap-host');
  }
  mark();
  // The host may inject `tap` after the first scripts run.
  globalThis.addEventListener?.('load', mark);
  return { get inHost() { return host(); } };
})();

/* Rewarded video (激励视频). The ad unit id comes from 开发者中心 → 广告变现 after ads are
   opened for this game (`taptap-cli mini-app-ad get-config` prints it as
   selected_space_id). While it is empty, or outside TapTap, `available` is false and
   the game shows no ad entry at all.

   The host keeps one rewarded-video instance per game, so one is created and reused.
   show(done) calls done exactly once with:
     'watched'  the video played to the end: give the reward
     'closed'   the player closed it early: no reward
     'none'     no ad could be shown */
const AD_UNIT_ID = '';
const TapTapAds = (() => {
  let ad = null, pending = null, showing = false;
  const ready = () => !!AD_UNIT_ID && typeof globalThis.tap?.createRewardedVideoAd === 'function';
  function finish(result) {
    const done = pending;
    pending = null; showing = false;
    if (done) done(result);
  }
  function instance() {
    if (ad) return ad;
    const created = globalThis.tap.createRewardedVideoAd({ adUnitId: AD_UNIT_ID });
    created.onClose(res => finish(res && res.isEnded ? 'watched' : 'closed'));
    // A failed load before the video opens is handled by show() below; this covers a
    // video that breaks while it is on screen and never reports being closed.
    created.onError?.(() => { if (showing) finish('none'); });
    return ad = created;
  }
  function show(done) {
    if (pending) return false;                       // one video at a time
    if (!ready()) { done('none'); return true; }
    let video;
    try { video = instance(); } catch { done('none'); return true; }
    pending = done;
    Promise.resolve()
      .then(() => video.show())
      .catch(() => Promise.resolve(video.load()).then(() => video.show()))   // not loaded yet: load once, then play
      .then(() => { if (pending) showing = true; })
      .catch(() => finish('none'));
    return true;
  }
  return { get available() { return ready(); }, get busy() { return !!pending; }, show };
})();
