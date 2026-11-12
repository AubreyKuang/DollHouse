// 季节、天气、节日
// 一年十二个月，季节影响窗外天气和房屋开销。
// 冬天交暖气费、夏天交空调费；春节、中秋、圣诞有节日活动（圣诞树、灯笼可以在商店买）

const SEASONS = [
  { id: 'spring', name: '春', icon: '🌸', particle: '#f6b0c8' },
  { id: 'summer', name: '夏', icon: '🌻', particle: null },
  { id: 'autumn', name: '秋', icon: '🍂', particle: '#e0a050' },
  { id: 'winter', name: '冬', icon: '⛄', particle: null },
];
const seasonOf = cycle => SEASONS[(Math.floor(monthOf(cycle) / 3) + 3) % 4];

const WEATHER = {
  sunny:  { name: '晴',   icon: '☀️' },
  cloudy: { name: '多云', icon: '⛅' },
  rain:   { name: '下雨', icon: '🌧' },
  snow:   { name: '下雪', icon: '❄️' },
};
const WEATHER_ODDS = {
  spring: [['sunny', 45], ['cloudy', 25], ['rain', 30]],
  summer: [['sunny', 55], ['cloudy', 15], ['rain', 30]],
  autumn: [['sunny', 45], ['cloudy', 35], ['rain', 20]],
  winter: [['snow', 45], ['cloudy', 30], ['sunny', 25]],
};

const HOLIDAYS = [
  { month: 2, name: '春节',   icon: '🧧', deco: 'lantern',  lines: ['新年快乐！', '恭喜发财～', '红包拿来！'] },
  { month: 9, name: '中秋节', icon: '🥮', deco: 'lantern',  lines: ['月亮好圆', '月饼真好吃', '中秋快乐～'] },
  { month: 12, name: '圣诞节', icon: '🎄', deco: 'xmastree', lines: ['圣诞快乐！', '礼物呢礼物呢', '叮叮当～'] },
];
const holidayOf = cycle => HOLIDAYS.find(h => h.month === monthOf(cycle)) || null;

/* ---------- 节日装饰 ---------- */
Object.assign(FURNITURE, {
  xmastree: { name: '圣诞树', w: 1, h: 1, use: 'party', mode: 'front', need: { fun: 20, social: 10 } },
  lantern:  { name: '灯笼',   w: 1, h: 1, use: null, layer: 'wall' },
});
Object.assign(SHOP, { xmastree: [600, 1], lantern: [120, 1] });
TALL.xmastree = 22;
ACT_NAMES.party = '过节';
ACT_LINES.party = ['🎄 好漂亮！', '挂个小铃铛', '节日快乐！'];
JOIN.party = { verb: '和{n}一起过节', like: 'party', dance: 0.6, lines: ['节日快乐！', '一起跳舞吧！', '🎵 叮叮当'], back: ['快来快来！', '嘿嘿～'] };
Object.assign(PERSONAS.social.like, { party: 30 });
Object.assign(PERSONAS.genki.like, { party: 25 });

Object.assign(DRAW, {
  xmastree(c, x, y, f, t) {
    R(c, x + 6, y + 8, 4, 5, '#8a5530');
    const g = '#3f8f4a', gl = '#5fae5a';
    const tier = (w, yy) => { R(c, x + 8 - w / 2 - 1, yy - 1, w + 2, 7, INK); R(c, x + 8 - w / 2, yy, w, 5, g); R(c, x + 8 - w / 2, yy, w, 1, gl); };
    tier(14, y + 4); tier(10, y - 3); tier(6, y - 10);
    R(c, x + 7, y - 15, 2, 4, '#f2c33a'); R(c, x + 6, y - 14, 4, 2, '#f2c33a');                 // 星星
    const cols = ['#e26d7d', '#f2d16b', '#6aa9ec', '#ffffff'];
    [[4, 6], [11, 7], [6, -1], [10, 0], [8, -7], [5, 2]].forEach(([dx, dy], i) =>
      R(c, x + dx, y + dy, 1, 1, cols[(i + Math.floor(t * 2)) % 4]));                           // 一闪一闪的彩灯
    box(c, x + 1, y + 10, 5, 5, '#e26d7d'); R(c, x + 3, y + 10, 1, 5, '#f2d16b');               // 礼物盒
    box(c, x + 10, y + 11, 5, 4, '#6aa9ec'); R(c, x + 12, y + 11, 1, 4, '#ffffff');
  },
  lantern(c, x, y, f, t) {
    const sway = Math.round(Math.sin(t * 1.5 + x) * 1);
    R(c, x + 8, y, 1, 3, INK);
    R(c, x + 4 + sway, y + 3, 9, 2, '#d9a640');
    R(c, x + 3 + sway, y + 5, 11, 7, INK); R(c, x + 4 + sway, y + 5, 9, 7, '#e05a4a');
    R(c, x + 5 + sway, y + 6, 2, 5, '#f07a6a'); R(c, x + 8 + sway, y + 5, 1, 7, '#c0443a');
    R(c, x + 4 + sway, y + 12, 9, 2, '#d9a640');
    R(c, x + 8 + sway, y + 14, 1, 2, '#f2c33a');
  },
});

/* ---------- 窗外的天气 ---------- */
// 在窗户玻璃区域里画雨、雪、花瓣、落叶
function drawWindowWeather(c, gx, gy, w, h) {
  const t = G.t, S = seasonOf(G.day);
  if (G.weather === 'rain') {
    for (let i = 0; i < 9; i++) {
      const px = gx + ((i * 7 + Math.floor(t * 6)) % w), py = gy + ((i * 11 + Math.floor(t * 70)) % h);
      R(c, px, py, 1, 3, 'rgba(220,235,255,.75)');
    }
  } else if (G.weather === 'snow') {
    for (let i = 0; i < 10; i++) {
      const px = gx + ((i * 5 + Math.round(Math.sin(t * 1.3 + i) * 2) + w) % w), py = gy + ((i * 7 + Math.floor(t * 9)) % h);
      R(c, px, py, 1, 1, '#ffffff');
    }
    R(c, gx, gy + h - 2, w, 2, '#f4f8ff');                 // 窗外积雪
  } else if (S.particle && !G.night) {
    for (let i = 0; i < 3; i++) {
      const px = gx + ((i * 9 + Math.round(Math.sin(t + i * 2) * 3) + w) % w), py = gy + ((i * 13 + Math.floor(t * 5)) % h);
      R(c, px, py, 2, 1, S.particle);
    }
  }
}

/* ---------- 每帧：天气和节日 ---------- */
function rollWeather() {
  const S = seasonOf(G.day), prev = G.weather;
  G.weather = weighted(WEATHER_ODDS[S.id]);
  SFX.setRain(G.weather === 'rain');
  if (G.weather === prev) return;
  if (G.weather === 'rain') addLog('🌧 下起雨来了');
  if (G.weather === 'snow') {
    addLog('❄️ 下雪了');
    for (const d of G.dolls) if (d.state !== 'away' && (d.persona === 'genki' || d.persona === 'social') && !lying(d)) say(d, pick(['下雪啦！', '好想堆雪人！', '❄️ 好漂亮']));
  }
  if (prev === 'rain' && G.weather !== 'rain') addLog('🌤 雨停了');
}

function seasonTick() {
  const key = G.day * 2 + (G.time >= 720 ? 1 : 0);   // 每半天换一次天气
  if (G.wKey !== key) { G.wKey = key; rollWeather(); }
  // 阴雨天窗外暗一点
  const k = G.weather === 'rain' ? 0.45 : G.weather === 'snow' ? 0.3 : G.weather === 'cloudy' ? 0.2 : 0;
  if (k) { G.sky = mixHex(G.sky, '#7a8696', k); G.dark = Math.min(0.6, G.dark + k * 0.12); }
}

// Run birthday and holiday events once for each started month.
function startHouseMonth() {
  if (G.monthEvents === G.day) return;
  G.monthEvents = G.day;
  birthdayCheck();
  const S = seasonOf(G.day), prevS = seasonOf(G.day - 1);
  if (S !== prevS) { addLog(`${S.icon} ${S.name}天来了`); HOOK.toast(`${S.icon} ${S.name}天来了`, true); }
  const H = holidayOf(G.day);
  if (!H) return;
  HOOK.toast(`${H.icon} 本月是${H.name}！`);
  const hasDeco = G.furniture.some(f => f.id === H.deco);
  for (const d of G.dolls) {
    d.needs.fun = Math.min(100, d.needs.fun + (hasDeco ? 30 : 15));
    if (d.state !== 'away') say(d, pick(H.lines));
  }
  if (!hasDeco) addLog(`${H.icon} 家里还没有${FURNITURE[H.deco].name}，去商店买一个会更有节日气氛`);
  if (H.name === '春节') {
    // 有工作的人给学生发红包
    for (const g of G.dolls) for (const s of G.dolls) if (g !== s && s.job === 'student' && JOBS[g.job].wage > 100 && g.money >= 200) {
      g.money -= 88; s.money += 88; bump(g, s, 4); addLog(`🧧 ${g.name} 给 ${s.name} 发了个红包 ¥88`);
    }
  }
  if (H.name === '中秋节') {
    for (const d of G.dolls) d.needs.social = Math.min(100, d.needs.social + 20);
    addLog('🥮 大家一起吃月饼、赏月');
  }
  if (H.name === '圣诞节') {
    // 恋人和好朋友互送礼物
    for (let i = 0; i < G.dolls.length; i++) for (let j = i + 1; j < G.dolls.length; j++) {
      const a = G.dolls[i], b = G.dolls[j], r = rel(a, b);
      if (!(r.lovers || r.f >= 70)) continue;
      const [giver, getter] = a.money >= b.money ? [a, b] : [b, a];
      if (giver.money < 80) continue;
      giver.money -= 80; bump(giver, getter, 4, r.lovers ? 6 : 0);
      addLog(`🎁 ${giver.name} 送给 ${getter.name} 一份圣诞礼物`);
    }
  }
}

// 夜里结账时的季节性开销
function seasonBill() {
  const s = seasonOf(G.day).id;
  return s === 'winter' ? ['暖气费', 20] : s === 'summer' ? ['空调费', 10] : null;
}

const isHolidayParty = () => { const H = holidayOf(G.day); return H && H.deco === 'xmastree'; };
