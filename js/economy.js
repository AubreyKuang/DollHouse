// 家庭基金、家具商店、仓库、扩建
// 上班的人领工资时自动存 20% 进家庭基金；玩家每月还能号召一次大家凑钱。
// 家具要用基金买，删掉的家具收进仓库可以再拿出来；扩建会让房子真的变宽，并解锁新家具。

// [价格, 需要的房屋等级]
const SHOP = {
  bed: [800, 1], bigbed: [1500, 1], sofa: [900, 1], chair: [150, 1], table: [400, 1], fridge: [1200, 1],
  stove: [1000, 1], shelf: [600, 1], tv: [1500, 1], arcade: [1300, 1], piano: [2500, 1], bath: [1600, 1],
  plant: [120, 1], lamp: [200, 1], catbed: [300, 1], rug: [250, 1], rug2: [200, 1],
  window: [500, 1], painting: [300, 1], clock: [150, 1], poster: [80, 1],
  beanbag: [300, 1], coffee: [450, 1], aquarium: [700, 1], shelfwall: [180, 1], mirror: [200, 1],
  desk: [500, 2], pc: [1600, 2], speaker: [900, 2], garland: [220, 2],
  easel: [800, 3], treadmill: [1800, 3],
  toilet: [240, 1], washstand: [180, 1], shower: [520, 1], cloudBed: [740, 1],
  moonLamp: [130, 1], bunnyPicture: [85, 1], cloudMobile: [120, 1], tulips: [95, 1], pawRug: [160, 1],
  recordPlayer: [420, 1], chessTable: [360, 1], knitting: [140, 1], ukulele: [280, 1],
  vanity: [380, 1], laundry: [150, 1], yogaMat: [180, 1], punchingBag: [420, 1],
  craftBench: [420, 1], toolbox: [250, 1], scrapbook: [300, 1], herbStand: [210, 1],
  corkboard: [110, 1], plushRabbit: [130, 1], paperLantern: [120, 1], teaTray: [260, 1],
};

const FURNITURE_GROUPS = {
  essentials: ['toilet', 'washstand', 'shower', 'bath', 'cloudBed', 'bed', 'bigbed',
    'sofa', 'beanbag', 'chair', 'table', 'fridge', 'stove', 'coffee', 'mirror', 'vanity', 'laundry', 'teaTray'],
  decor: ['moonLamp', 'bunnyPicture', 'cloudMobile', 'tulips', 'pawRug',
    'plant', 'lamp', 'rug', 'rug2', 'window', 'painting', 'clock', 'poster',
    'shelfwall', 'garland', 'xmastree', 'lantern', 'corkboard', 'plushRabbit', 'paperLantern'],
  hobbies: ['recordPlayer', 'chessTable', 'puzzleDesk', 'knitting', 'ukulele', 'piano', 'shelf',
    'desk', 'arcade', 'aquarium', 'tv', 'catbed', 'pc', 'speaker', 'easel', 'treadmill', 'yogaMat', 'punchingBag', 'craftBench', 'toolbox', 'scrapbook', 'herbStand'],
  yard: ['gardenSwing', 'gardenBench', 'flowerBox', 'picnicTable', 'coveredPicnicTable'],
};

const LEVELS = [null,
  { name: '小屋',     cols: 16, cap: 5 },
  { name: '温馨小家', cols: 20, cap: 6, cost: 3000 },
  { name: '梦想之家', cols: 24, cap: 8, cost: 8000 },
];

const FUND_SHARE = 0.2;                                       // 工资里存进基金的比例
const GENEROSITY = { genki: 0.15, lazy: 0.05, nerd: 0.12, foodie: 0.2, social: 0.25 };

// 房子变宽：改世界宽度，画布跟着变
function setWorldSize(cols) {
  COLS = cols; W = COLS * T;
  HOOK.resize();
  BLOCK = blockedMap();
}

// 放一件家具前调用：优先用仓库里的，否则从基金里买
// purchasePrice：放这件家具要花多少钱；仓库有货、测试模式、或不花钱时返回 0
function purchasePrice(id) {
  if (TEST_MODE) return 0;
  if ((G.inv[id] || 0) > 0) return 0;
  return SHOP[id] ? SHOP[id][0] : 0;
}
function acquire(id) {
  if (TEST_MODE) return Object.hasOwn(SHOP, id);
  if ((G.inv[id] || 0) > 0) { G.inv[id]--; return true; }
  const [price, lv] = SHOP[id];
  if (lv > G.level) { HOOK.toast(`🔒 扩建成「${LEVELS[lv].name}」才能买${FURNITURE[id].name}`, true); return false; }
  if (G.fund < price) { HOOK.toast(`🏦 家庭基金不够，${FURNITURE[id].name}要 ${yuan(price)}`, true); return false; }
  G.fund -= price;
  addLog(`🛒 用家庭基金买了${FURNITURE[id].name}，花了 ${yuan(price)}`);
  return true;
}
function stash(id) { G.inv[id] = (G.inv[id] || 0) + 1; }

// 号召大家凑钱：每人按性格拿出“闲钱”（留 ¥300 生活费）的一部分
function crowdfund() {
  if (G.crowdDay === G.day) { HOOK.toast('本月已经凑过钱了，下个月再来吧', true); return; }
  G.crowdDay = G.day;
  let total = 0; const parts = [];
  for (const d of residents()) {
    const spare = d.money - 300;
    const amt = spare > 0 ? Math.round(spare * (GENEROSITY[d.persona] || 0.1) / 10) * 10 : 0;
    const home = d.state !== 'away';
    if (amt >= 10) {
      d.money -= amt; total += amt; parts.push(`${d.name} ${yuan(amt)}`);
      if (home) say(d, pick([`我出 ${yuan(amt)}！`, '为了更好的家！', '拿去吧～']));
    } else if (home) say(d, pick(['我……没钱', '下次一定', '钱包空空的']));
  }
  G.fund += total;
  if (total) { addLog(`📣 大家凑钱：${parts.join('、')}，家庭基金 +${yuan(total)}`); HOOK.toast(`📣 凑到了 ${yuan(total)}！`, true); SFX.play('love'); }
  else HOOK.toast('大家都没什么钱了……', true);
  HOOK.refresh();
}

function expand() {
  const next = LEVELS[G.level + 1];
  if (!next) return;
  if (G.fund < next.cost) { HOOK.toast(`🏦 扩建需要 ${yuan(next.cost)}，家庭基金还差 ${yuan(next.cost - G.fund)}`, true); SFX.play('deny'); return; }
  G.fund -= next.cost; G.level++;
  setWorldSize(next.cols);
  const unlocked = Object.keys(SHOP).filter(id => SHOP[id][1] === G.level).map(id => FURNITURE[id].name);
  addLog(`🔨 小屋扩建成「${next.name}」！房子变大了，解锁了${unlocked.join('、')}`);
  HOOK.toast(`🔨 扩建成「${next.name}」！`, true); SFX.play('newday');
  for (const d of G.dolls) if (d.state !== 'away') { say(d, pick(['哇，房子变大了！', '好宽敞！', '可以买新家具了！'])); d.happy = 3; }
  HOOK.refresh(); HOOK.select();
}

// 小人会念叨想要的家具，提示玩家下一步买什么
function wishLine(d) {
  const owned = new Set(G.furniture.map(f => FURNITURE[f.id].use));
  const wants = Object.entries(PERSONAS[d.persona].like)
    .filter(([use, v]) => v >= 20 && !owned.has(use))
    .map(([use]) => Object.keys(SHOP).find(id => FURNITURE[id].use === use))
    .filter(Boolean);
  return wants.length ? `要是家里有${FURNITURE[pick(wants)].name}就好了` : null;
}
