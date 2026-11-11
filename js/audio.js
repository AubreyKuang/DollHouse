// 所有声音都用 WebAudio 振荡器和噪声现场合成，没有任何音频文件
const SFX = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let on = false, musicTimer = null, nextNote = 0, step = 0;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    // 一秒白噪声，用来做“噗”“沙沙”的声音
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const hz = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI 音高 → 频率

  function tone(freq, t, dur, type = 'square', vol = 0.2, bus = sfxBus, slide = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol = 0.2, freq = 1200, q = 1) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    click: t => tone(hz(84), t, 0.05, 'square', 0.08),
    pop: t => tone(hz(79), t, 0.08, 'sine', 0.18, sfxBus, 1.6),
    place: t => { tone(hz(45), t, 0.12, 'triangle', 0.35, sfxBus, 0.6); noise(t, 0.08, 0.15, 400); },
    pick: t => tone(hz(67), t, 0.1, 'triangle', 0.2, sfxBus, 1.5),
    trash: t => { noise(t, 0.25, 0.3, 900, 0.7); tone(hz(60), t, 0.2, 'square', 0.08, sfxBus, 0.4); },
    deny: t => { tone(hz(50), t, 0.09, 'square', 0.1); tone(hz(47), t + 0.1, 0.12, 'square', 0.1); },
    lift: t => tone(hz(72), t, 0.18, 'sine', 0.2, sfxBus, 2),
    drop: t => { tone(hz(62), t, 0.1, 'sine', 0.2, sfxBus, 0.5); noise(t + 0.05, 0.05, 0.1, 500); },
    love: t => [76, 79, 84].forEach((n, i) => tone(hz(n), t + i * 0.07, 0.18, 'triangle', 0.18)),
    eat: t => [0, 0.12, 0.24].forEach(d => noise(t + d, 0.06, 0.18, 2500, 3)),
    cook: t => noise(t, 0.4, 0.08, 4000, 0.5),
    piano: t => { const sc = [60, 62, 64, 67, 69, 72]; tone(hz(sc[(Math.random() * 6) | 0]), t, 0.5, 'triangle', 0.2); },
    game: t => { const n = 72 + ((Math.random() * 12) | 0); tone(hz(n), t, 0.06, 'square', 0.07); tone(hz(n + 7), t + 0.06, 0.06, 'square', 0.07); },
    splash: t => noise(t, 0.3, 0.15, 1500, 0.8),
    meow: t => tone(hz(81), t, 0.3, 'sawtooth', 0.06, sfxBus, 0.75),
    chat: t => { for (let i = 0; i < 3; i++) tone(hz(70 + ((Math.random() * 8) | 0)), t + i * 0.07, 0.05, 'square', 0.05); },
    snore: t => noise(t, 0.6, 0.05, 300, 1),
    step: t => noise(t, 0.03, 0.04, 2000, 2),
    newday: t => [72, 76, 79, 84].forEach((n, i) => tone(hz(n), t + i * 0.1, 0.25, 'triangle', 0.15)),
    open: t => [67, 72].forEach((n, i) => tone(hz(n), t + i * 0.06, 0.1, 'triangle', 0.15)),
  };

  // 背景音乐：C–Am–F–G 的和弦循环，三角波低音 + 方波琶音 + 偶尔的旋律
  const CHORDS = [[48, 52, 55, 60], [45, 48, 52, 57], [41, 45, 48, 53], [43, 47, 50, 55]];
  const MELODY = [76, 0, 79, 0, 76, 74, 72, 0, 72, 0, 74, 76, 74, 0, 0, 0,
                  77, 0, 76, 0, 74, 72, 69, 0, 71, 0, 72, 74, 72, 0, 0, 0];
  function schedule() {
    const night = typeof G !== 'undefined' && G.night;
    const spb = night ? 0.28 : 0.2; // 每个十六分音符的秒数，晚上慢一点
    while (nextNote < ctx.currentTime + 0.3) {
      const chord = CHORDS[Math.floor(step / 16) % 4], s = step % 16;
      if (s % 8 === 0) tone(hz(chord[0] - 12), nextNote, spb * 7, 'triangle', 0.32, musicBus);
      if (s % 2 === 0) tone(hz(chord[(s / 2) % 4] + 12), nextNote, spb * 1.6, night ? 'sine' : 'square', night ? 0.08 : 0.035, musicBus);
      const m = MELODY[step % 32];
      if (m && !night) tone(hz(m), nextNote, spb * 1.8, 'triangle', 0.09, musicBus);
      if (!night && s % 4 === 2) noise(nextNote, 0.03, 0.03, 6000, 1);
      nextNote += spb; step++;
    }
  }

  return {
    get on() { return on; },
    play(name) {
      if (!on || !ctx || !SOUNDS[name]) return;
      SOUNDS[name](ctx.currentTime + 0.005);
    },
    toggle() {
      init();
      on = !on;
      if (on) {
        ctx.resume();
        nextNote = ctx.currentTime + 0.1;
        musicTimer = setInterval(schedule, 100);
        SOUNDS.open(ctx.currentTime);
      } else { clearInterval(musicTimer); musicTimer = null; }
      return on;
    },
  };
})();
