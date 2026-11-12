// 星座与 MBTI：在原有“性格”打分的基础上再做加减，并决定两个人的缘分
// 不改变需求系统本身，只是让同一种性格的人也各有不同

const ZODIAC = [
  { id: 'aries',       name: '白羊座', icon: '♈', el: 'fire' },
  { id: 'taurus',      name: '金牛座', icon: '♉', el: 'earth' },
  { id: 'gemini',      name: '双子座', icon: '♊', el: 'air' },
  { id: 'cancer',      name: '巨蟹座', icon: '♋', el: 'water' },
  { id: 'leo',         name: '狮子座', icon: '♌', el: 'fire' },
  { id: 'virgo',       name: '处女座', icon: '♍', el: 'earth' },
  { id: 'libra',       name: '天秤座', icon: '♎', el: 'air' },
  { id: 'scorpio',     name: '天蝎座', icon: '♏', el: 'water' },
  { id: 'sagittarius', name: '射手座', icon: '♐', el: 'fire' },
  { id: 'capricorn',   name: '摩羯座', icon: '♑', el: 'earth' },
  { id: 'aquarius',    name: '水瓶座', icon: '♒', el: 'air' },
  { id: 'pisces',      name: '双鱼座', icon: '♓', el: 'water' },
];
const ELEMENTS = {
  fire:  { name: '火象', icon: '🔥', like: { dance: 8, game: 8, exercise: 8, music: 5 } },
  earth: { name: '土象', icon: '🌍', like: { cook: 8, study: 8, water: 8, snack: 4 } },
  air:   { name: '风象', icon: '💨', like: { chat: 8, pc: 8, music: 8, wander: 5 } },
  water: { name: '水象', icon: '💧', like: { bath: 8, piano: 8, paint: 8, fish: 8 } },
};
const zodiacOf = d => ZODIAC.find(z => z.id === d.zodiac) || ZODIAC[0];

const MBTI_NAMES = {
  INTJ: '建筑师', INTP: '逻辑学家', ENTJ: '指挥官', ENTP: '辩论家', INFJ: '提倡者', INFP: '调停者', ENFJ: '主人公', ENFP: '竞选者',
  ISTJ: '物流师', ISFJ: '守卫者', ESTJ: '总经理', ESFJ: '执政官', ISTP: '鉴赏家', ISFP: '探险家', ESTP: '企业家', ESFP: '表演者',
};
const MBTI_AXES = [['E', 'I', '外向', '内向'], ['S', 'N', '实感', '直觉'], ['T', 'F', '思考', '情感'], ['J', 'P', '判断', '感知']];
const mb = d => Object.hasOwn(MBTI_NAMES, d.mbti) ? d.mbti : 'ESFJ';
const isE = d => mb(d)[0] === 'E', isN = d => mb(d)[1] === 'N', isF = d => mb(d)[2] === 'F', isJ = d => mb(d)[3] === 'J';

// 经典“黄金搭档”
const GOLDEN = [['INTJ', 'ENFP'], ['INFJ', 'ENFP'], ['ENTJ', 'INFP'], ['INTP', 'ENTJ'], ['INFJ', 'ENTP'], ['ISFJ', 'ESTP'], ['ISTJ', 'ESFP'], ['ESFJ', 'ISFP'], ['ESTJ', 'ISTP'], ['ENFJ', 'INFP']];

// MBTI influences in-game interests, alongside each resident's base personality.
const MBTI_INTERESTS = {
  INTJ: ['planChess', 'catalogue', 'study'],
  INTP: ['repair', 'skyNotes', 'planChess'],
  ENTJ: ['planChess', 'boxPractice', 'chess'],
  ENTP: ['clapGame', 'repair', 'recipeSwap'],
  INFJ: ['skyNotes', 'writeCard', 'catalogue'],
  INFP: ['scrapbook', 'writeCard', 'cloudWatch'],
  ENFJ: ['checkIn', 'compliment', 'writeCard'],
  ENFP: ['rehearse', 'scrapbook', 'clapGame'],
  ISTJ: ['catalogue', 'tidy', 'repair'],
  ISFJ: ['tidy', 'recipeSwap', 'careHerbs'],
  ESTJ: ['tidy', 'boxPractice', 'checkIn'],
  ESFJ: ['recipeSwap', 'checkIn', 'compliment'],
  ISTP: ['repair', 'boxPractice', 'planChess'],
  ISFP: ['craft', 'scrapbook', 'style'],
  ESTP: ['boxPractice', 'clapGame', 'yoga'],
  ESFP: ['rehearse', 'style', 'compliment'],
};

/* ---------- 打分加成：活动偏好 ---------- */
function traitBonus(d, use) {
  let b = (ELEMENTS[zodiacOf(d).el].like[use] || 0);
  if (use === 'chat') b += isE(d) ? 15 : -10;
  if (['read', 'fish', 'pc', 'paint', 'study'].includes(use) && !isE(d)) b += 8;
  if (['cook', 'exercise', 'water', 'snack'].includes(use) && !isN(d)) b += 8;
  if (['read', 'paint', 'piano', 'pc', 'study'].includes(use) && isN(d)) b += 8;
  if (use === 'wander') b += isJ(d) ? -5 : 15;
  if (use === 'join') b += isE(d) ? 10 : -5;
  const interest = (MBTI_INTERESTS[mb(d)] || []).indexOf(use);
  return b + (interest < 0 ? 0 : 14 - interest * 3);
}
// P 型更随性：随机部分放大；J 型更按部就班
const noiseMul = d => (isJ(d) ? 0.8 : 1.4);
// 做事时长：J 更专注，P 更容易换下一件事
const durMul = d => (isJ(d) ? 1.15 : 0.85);
// 需求下降速度：外向的人更快需要社交；火象更容易无聊
function decayMul(d, k) {
  if (k === 'social') return isE(d) ? 1.4 : 0.7;
  if (k === 'fun' && zodiacOf(d).el === 'fire') return 1.2;
  return 1;
}
// 上班出门时间的浮动：J 准时，P 常常踩点甚至迟到
const leaveJitterFor = d => (isJ(d) ? Math.round(Math.random() * 10 - 8) : Math.round(Math.random() * 45 - 10));

/* ---------- 缘分 ---------- */
function elementMatch(a, b) {
  const x = zodiacOf(a).el, y = zodiacOf(b).el;
  if (x === y) return 1.2;
  const pair = [x, y].sort().join('-');
  if (pair === 'air-fire' || pair === 'earth-water') return 1.15;   // 互补
  if (pair === 'fire-water' || pair === 'air-earth') return 0.85;   // 对冲
  return 1;
}
function mbtiMatch(a, b) {
  const A = mb(a), B = mb(b);
  let m = 1;
  m += A[1] === B[1] ? 0.12 : -0.05;     // 看世界的方式一致更聊得来
  if (A[0] !== B[0]) m += 0.05;           // 一动一静互补
  if (A[3] === B[3]) m += 0.05;           // 生活节奏一致
  if (GOLDEN.some(([p, q]) => (p === A && q === B) || (p === B && q === A))) m += 0.2;
  return m;
}
function compat(a, b) { return Math.max(0.7, Math.min(1.5, elementMatch(a, b) * mbtiMatch(a, b))); }
function compatStars(a, b) { const c = compat(a, b); return c < 0.9 ? '★☆☆☆' : c < 1.05 ? '★★☆☆' : c < 1.2 ? '★★★☆' : '★★★★'; }

/* ---------- 生日 ---------- */
const birthdayOf = d => monthOf(ZODIAC.indexOf(zodiacOf(d)) + 3);
function birthdayCheck() {
  const month = monthOf(G.day);
  for (const d of residents()) {
    if (birthdayOf(d) !== month) continue;
    HOOK.toast(`🎂 本月是 ${d.name} 的生日！`);
    d.needs.fun = Math.min(100, d.needs.fun + 30); d.happy = 5;
    for (const o of residents()) {
      if (o === d) continue;
      const r = rel(o, d);
      if (o.state !== 'away') setTimeout(() => say(o, pick([`${d.name}生日快乐！`, '🎂 许个愿吧', '又长大一岁啦'])), 800 + Math.random() * 1500);
      if ((r.f >= 40 || r.lovers) && o.money >= 60) { o.money -= 60; bump(o, d, 5, r.lovers ? 5 : 0); addLog(`🎁 ${o.name} 送了 ${d.name} 一份生日礼物`); }
    }
  }
}

// 状态卡上的一行介绍
function astroLine(d) {
  const z = zodiacOf(d), E = ELEMENTS[z.el];
  return `${z.icon} ${z.name}（${E.icon}${E.name}） · ${mb(d)} ${MBTI_NAMES[mb(d)]} · 🎂 ${birthdayOf(d)} 月`;
}
function randomZodiac() { return pick(ZODIAC).id; }
function randomMbti() { return MBTI_AXES.map(a => a[Math.random() < 0.5 ? 0 : 1]).join(''); }
