// 静态数据：房间尺寸、家具、性格、服装选项、默认存档
const T = 16;              // 每格像素
let COLS = 16;              // 房子宽度，扩建时会变大
const FLOOR_SPLIT = 12;
const stairsColumn = () => COLS - 2;
const ROWS = 20;
const YARD_END = 26;
const yardGate = x => x >= 9 && x <= 11;
const WALL_ROWS = 3;       // 一楼墙面占据前 3 行
const LOWER_LANDING = WALL_ROWS + 1;
const UPPER_LANDING = ROWS - 1;
const UPPER_WALL = -WALL_ROWS; // 二楼墙面用负数行，与既有地面坐标分开
let W = COLS * T;
const H = ROWS * T;

// use: 小人能做的事；mode: on=坐/躺在家具上, front=站在家具前
// layer: floor=地毯(可走), wall=挂在墙上, 其它为普通家具
const FURNITURE = {
  bed:      { name: '小床',   w: 2, h: 2, use: 'sleep', mode: 'on',    need: { energy: 26 } },
  bigbed:   { name: '双人床', w: 3, h: 2, use: 'sleep', mode: 'on',    need: { energy: 26 } },
  sofa:     { name: '沙发',   w: 2, h: 1, use: 'sit',   mode: 'on',    need: { energy: 6, fun: 4 } },
  chair:    { name: '椅子',   w: 1, h: 1, use: 'sit',   mode: 'on',    need: { energy: 5 } },
  table:    { name: '餐桌',   w: 2, h: 1, use: 'meal', mode: 'front', cap: 4, need: { hunger: 32, social: 12 } },
  fridge:   { name: '冰箱',   w: 1, h: 1, use: 'snack', mode: 'front', need: { hunger: 22 } },
  stove:    { name: '灶台',   w: 1, h: 1, use: 'cook',  mode: 'front', need: { hunger: 34, fun: 4 } },
  shelf:    { name: '书架',   w: 2, h: 1, use: 'read',  mode: 'front', need: { fun: 14 } },
  tv:       { name: '电视',   w: 2, h: 1, use: 'tv',    mode: 'front', need: { fun: 18, energy: 2 } },
  arcade:   { name: '游戏机', w: 1, h: 1, use: 'game',  mode: 'front', need: { fun: 24, energy: -4 } },
  piano:    { name: '钢琴',   w: 2, h: 1, use: 'piano', mode: 'front', need: { fun: 20 } },
  bath:     { name: '浴缸',   w: 2, h: 1, use: 'bath',  mode: 'on',    need: { energy: 10, fun: 10 } },
  plant:    { name: '盆栽',   w: 1, h: 1, use: 'water', mode: 'front', need: { fun: 6 } },
  lamp:     { name: '落地灯', w: 1, h: 1, use: null },
  catbed:   { name: '猫窝',   w: 1, h: 1, use: 'cat',   mode: 'front', need: { fun: 12, social: 10 } },
  rug:      { name: '圆地毯', w: 3, h: 2, use: null, layer: 'floor' },
  rug2:     { name: '条纹毯', w: 2, h: 2, use: null, layer: 'floor' },
  door:     { name: '大门',   w: 1, h: 2, use: null, layer: 'wall', fixed: true },
  window:   { name: '窗户',   w: 2, h: 2, use: null, layer: 'wall' },
  painting: { name: '挂画',   w: 1, h: 1, use: null, layer: 'wall' },
  clock:    { name: '挂钟',   w: 1, h: 1, use: null, layer: 'wall' },
  poster:   { name: '海报',   w: 1, h: 2, use: null, layer: 'wall' },
};

const NEEDS = [
  { key: 'energy', name: '精力', color: '#f2c33a' },
  { key: 'hunger', name: '饱腹', color: '#ef9a4f' },
  { key: 'fun',    name: '快乐', color: '#ec6a8a' },
  { key: 'social', name: '社交', color: '#6aa9ec' },
  { key: 'bladder', name: '如厕', color: '#a48cce' },
];

// decay: 每游戏小时下降量；like: 偏好的活动加分；speed: 走路速度(格/秒)
const PERSONAS = {
  genki: {
    name: '元气', icon: '⚡', desc: '停不下来，喜欢游戏和跳舞',
    speed: 3.2, decay: { energy: 5, hunger: 4, fun: 7, social: 3 },
    like: { game: 40, dance: 45, piano: 15, wander: 20, chat: 5, sleep: -15 },
    dur: { sit: 0.5, read: 0.5, sleep: 0.8, dance: 1.4, game: 1.3 },
    chat: ['我们去跳舞吧！', '比赛谁先跑到门口！', '今天也超——有精神！', '好无聊，来玩嘛！'],
    lines: ['冲呀！', '今天也好有精神～', '来跳舞吧！', '嘿嘿嘿', '好无聊，想玩！'],
  },
  lazy: {
    name: '懒懒', icon: '💤', desc: '能躺着绝不坐着',
    speed: 1.5, decay: { energy: 7, hunger: 3, fun: 3, social: 2 },
    like: { sleep: 40, sit: 40, tv: 30, bath: 20, chat: -5, dance: -25, game: -10 },
    dur: { sit: 2.2, sleep: 1.5, tv: 1.8, bath: 1.6 },
    chat: ['嗯……（打哈欠）', '聊天好累哦', '你说，我听着……zzz', '要不我们躺着聊？'],
    lines: ['好困……', '再睡五分钟', '沙发是我的', '哈啊～', '不想动'],
  },
  nerd: {
    name: '书虫', icon: '📚', desc: '书架是 TA 的宝藏',
    speed: 2.2, decay: { energy: 4, hunger: 3, fun: 5, social: 1.5 },
    like: { read: 50, piano: 20, water: 15, chat: -15, dance: -20 },
    dur: { read: 2.2, piano: 1.4 },
    chat: ['你知道吗，章鱼有三颗心脏', '根据统计学……', '这本书的作者其实……', '嗯，有道理。'],
    lines: ['这本书好有意思', '嗯……原来如此', '知识就是力量！', '安静一点嘛'],
  },
  foodie: {
    name: '吃货', icon: '🍙', desc: '满脑子都是下一顿',
    speed: 2.4, decay: { energy: 4, hunger: 8, fun: 4, social: 2.5 },
    like: { snack: 45, cook: 45, sit: 8 },
    dur: { snack: 1.6, cook: 1.5 },
    chat: ['你吃过巷口那家烤肠吗？', '晚饭吃什么呀？', '我刚做了布丁，分你一半！', '说到吃的……'],
    lines: ['好饿呀', '冰箱里有布丁吗？', '闻到香味了！', '吃饱了才有力气'],
  },
  social: {
    name: '社牛', icon: '💬', desc: '谁都想去搭话',
    speed: 2.6, decay: { energy: 4, hunger: 3, fun: 4, social: 8 },
    like: { chat: 50, cat: 15, dance: 12, read: -15 },
    dur: { chat: 1.5, read: 0.5 },
    chat: ['我跟你说个八卦！', '你今天发型好好看！', '有空一起出去玩吧～', '你最近怎么样呀？'],
    lines: ['有人陪我聊天吗？', '你今天好好看！', '哈哈哈哈', '大家在干嘛呀'],
  },
  maker: {
    name: '巧手', icon: '🧵', desc: '喜欢做手工，也会动手修修补补',
    speed: 2.1, decay: { energy: 4, hunger: 4, fun: 5, social: 2 },
    like: { craft: 47, knit: 32, repair: 37, paint: 24, read: 8, dance: -10 },
    dur: { craft: 1.35, knit: 1.3, repair: 1.25 },
    chat: ['我刚缝好一枚布贴', '这颗螺丝换小一点就好了', '下次给你做一个～'],
    lines: ['线头藏起来就好', '让我找找剪刀', '再试一种配色'],
  },
  stylist: {
    name: '爱打扮', icon: '🎀', desc: '爱试配饰，也喜欢看别人穿了什么',
    speed: 2.5, decay: { energy: 4, hunger: 4, fun: 6, social: 5 },
    like: { style: 48, groom: 30, scrapbook: 24, chat: 12, music: 13 },
    dur: { style: 1.35, groom: 1.25 },
    chat: ['今天这个颜色很衬你', '我在找一条能配这件衣服的围巾', '换个发夹试试？'],
    lines: ['这个颜色配米白应该不错', '今天想戴蝴蝶结', '发尾再理一下'],
  },
  active: {
    name: '运动派', icon: '👟', desc: '爱拉伸、练平衡和运动后的放松',
    speed: 3.1, decay: { energy: 5, hunger: 5, fun: 6, social: 3 },
    like: { exercise: 45, yoga: 42, boxPractice: 37, shower: 22, wander: 13, tv: -15 },
    dur: { exercise: 1.25, yoga: 1.25, boxPractice: 1.2 },
    chat: ['刚才那组动作稳多了', '散个步就回来吧', '我练完再去洗澡'],
    lines: ['先热热身', '今天的平衡好多了', '还差最后一组'],
  },
  tidy: {
    name: '爱整洁', icon: '🧺', desc: '习惯整理房间、照料小物和植物',
    speed: 2.2, decay: { energy: 4, hunger: 4, fun: 4, social: 3 },
    like: { tidy: 44, careHerbs: 33, water: 26, wash: 13, study: 12 },
    dur: { tidy: 1.3, careHerbs: 1.2 },
    chat: ['我把备用毛巾叠在篮子里了', '窗边那盆薄荷冒新叶了', '这个盒子刚好能收好零碎东西'],
    lines: ['叠好这一摞就休息', '给叶子擦擦灰', '小东西有地方收就好'],
  },
};

const GENDERS = { f: '♀ 女生', m: '♂ 男生' };
const HEARTS = {
  loyal:  { name: '专一', icon: '💍', desc: '认定一个人就不会变' },
  normal: { name: '普通', icon: '🙂', desc: '顺其自然' },
  fickle: { name: '花心', icon: '🦋', desc: '容易变心，有对象也会偷偷撩别人' },
};

const ACT_LINES = {
  sleep: ['💤', 'Zzz…', '好软的床'],
  sit:   ['歇一会儿', '☕', '舒服～'],
  snack: ['🍮 布丁！', '🍎 咔嚓', '🥛 咕嘟咕嘟'],
  cook:  ['🍳 煎蛋中', '🍜 煮面面', '香喷喷！'],
  read:  ['📖', '翻页……', '读到精彩处了'],
  tv:    ['📺 哈哈', '这集好看', '换个台'],
  game:  ['🎮 连击！', '最高分！', '再来一局'],
  piano: ['🎵 叮咚', '🎶 ♪♫', '练琴中'],
  bath:  ['🛁 泡泡～', '好暖和', '🫧'],
  water: ['💧 浇浇水', '快快长大', '🌱'],
  cat:   ['🐱 喵～', '摸摸猫', '猫猫真可爱'],
  dance: ['💃', '🎵 跳起来', '转圈圈～'],
  chat:  ['你好呀！', '聊点什么呢', '真的吗？！', '哈哈哈', '❤'],
  wander:['', '', '散步～', '♪'],
  pet:   ['嘿嘿', '❤', '好舒服～', '再摸摸'],
  lift:  ['哇啊！', '放我下来～', '飞起来了！'],
};

const ACT_NAMES = {
  sleep: '在睡觉', sit: '坐着休息', snack: '找零食', cook: '做饭', read: '看书',
  tv: '看电视', game: '打游戏', piano: '弹钢琴', bath: '泡澡', water: '浇花',
  cat: '撸猫', dance: '跳舞', chat: '聊天', wander: '闲逛', idle: '发呆', walk: '走路中',
};

// 服装
const OUTFIT = {
  skin:  ['#ffe0c7', '#f6c9a4', '#e0a77e', '#b97a52', '#8a5638'],
  hair:  { short: '短发', long: '长发', twin: '双马尾', bun: '丸子头', spiky: '刺猬头', bob: '波波头' },
  hairColor: ['#3b2a2f', '#7a4a2e', '#c98a4b', '#f2d16b', '#e8e2d6', '#e27fa6', '#7aa8e8', '#8bd18b', '#a77fe0', '#e05a4a'],
  top:   { tee: 'T恤', hoodie: '卫衣', dress: '连衣裙', overall: '背带裤', stripe: '条纹衫', suit: '小西装', cardigan: '针织开衫' },
  bottom:{ pants: '长裤', shorts: '短裤', skirt: '短裙' },
  clothColor: ['#e26d7d', '#f0a64a', '#f2d16b', '#7cc576', '#5bb8b0', '#6aa9ec', '#8a7fe0', '#d8d0c4', '#3b3a4a', '#ffffff', '#c26a9a', '#8a5a3c'],
  shoes: ['#3b2a2f', '#ffffff', '#e26d7d', '#6aa9ec', '#8a5a3c', '#f2d16b'],
  acc:   { none: '无', cap: '鸭舌帽', bow: '蝴蝶结', glasses: '眼镜', phones: '耳机', cat: '猫耳', flower: '小花', crown: '王冠' },
};

const WALLS = [
  { id: 'cream',  name: '奶油', base: '#f6e3c3', alt: '#edd3a8', pat: 'stripe' },
  { id: 'mint',   name: '薄荷', base: '#cfeadb', alt: '#bfe0cc', pat: 'dots' },
  { id: 'peach',  name: '蜜桃', base: '#f8d2c8', alt: '#f1bfb2', pat: 'stripe' },
  { id: 'sky',    name: '天空', base: '#cfe2f6', alt: '#ffffff', pat: 'clouds' },
  { id: 'lilac',  name: '丁香', base: '#ddd0f0', alt: '#cdbde8', pat: 'diamond' },
  { id: 'brick',  name: '红砖', base: '#c8735a', alt: '#a85c48', pat: 'brick' },
  { id: 'wood',   name: '木板', base: '#c99a6b', alt: '#b5845a', pat: 'plank' },
  { id: 'night',  name: '星夜', base: '#3d3a66', alt: '#f2d16b', pat: 'stars' },
];
const FLOORS = [
  { id: 'oak',    name: '橡木', base: '#c8925c', alt: '#b47f4c', pat: 'plank' },
  { id: 'walnut', name: '胡桃', base: '#8a5a3c', alt: '#764a30', pat: 'plank' },
  { id: 'check',  name: '格子', base: '#f3ede2', alt: '#d9cfc0', pat: 'check' },
  { id: 'mint',   name: '薄荷瓷', base: '#bfe3d3', alt: '#a8d4c0', pat: 'tile' },
  { id: 'pink',   name: '粉地毯', base: '#f2c2cc', alt: '#eab0bd', pat: 'carpet' },
  { id: 'grass',  name: '草坪', base: '#8ccf7a', alt: '#7bbf69', pat: 'grass' },
];

const ORIGINAL_STARTER_LOOKS = {
  'p-tao': { skin: 0, hair: 'twin', hairColor: 5, top: 'tee', topColor: 2, bottom: 'skirt', bottomColor: 5, shoes: 2, acc: 'bow' },
  'p-lan': { skin: 1, hair: 'spiky', hairColor: 1, top: 'hoodie', topColor: 4, bottom: 'pants', bottomColor: 8, shoes: 0, acc: 'phones' },
  'p-jing': { skin: 2, hair: 'bob', hairColor: 0, top: 'suit', topColor: 6, bottom: 'pants', bottomColor: 8, shoes: 4, acc: 'glasses' },
};
const COTTAGE_STARTER_LOOKS = {
  'p-tao': { ...ORIGINAL_STARTER_LOOKS['p-tao'], top: 'dress', bottomColor: 2, shoes: 4 },
  'p-lan': { ...ORIGINAL_STARTER_LOOKS['p-lan'], top: 'overall', topColor: 7, bottomColor: 6 },
  'p-jing': { ...ORIGINAL_STARTER_LOOKS['p-jing'], hair: 'short', hairColor: 1, top: 'cardigan', topColor: 4 },
};

const DEFAULT_SAVE = {
  wall: 'cream', floor: 'oak', time: 0, day: 1, monthEvents: 0, floorsV: 1, bathroom: true,
  inv: { bed: 1, lamp: 1, bath: 1, tv: 1, catbed: 1, plant: 1, chair: 2, window: 2, poster: 1, clock: 1, pawRug: 1, knitting: 1 },
  furniture: [
    // 二楼：卫生间、卧室、书房。
    { id: 'shower', x: 0, y: 13 }, { id: 'washstand', x: 1, y: 13 }, { id: 'toilet', x: 2, y: 13 },
    { id: 'window', x: 1, y: -3 }, { id: 'window', x: 5, y: -3 }, { id: 'moonLamp', x: 7, y: -2 },
    { id: 'cloudBed', x: 4, y: 13 }, { id: 'lamp', x: 7, y: 13 }, { id: 'pawRug', x: 5, y: 17 },
    { id: 'window', x: 10, y: -3 }, { id: 'painting', x: 14, y: -2 },
    { id: 'shelf', x: 8, y: 12 }, { id: 'desk', x: 11, y: 13 },
    { id: 'arcade', x: 13, y: 13 }, { id: 'plant', x: 15, y: 13 },
    { id: 'rug', x: 10, y: 17 },
    // 一楼：左边是粉色卧室，右边是客餐厅。
    { id: 'bunnyPicture', x: 6, y: 1 }, { id: 'cloudMobile', x: 3, y: 0 },
    { id: 'bigbed', x: 1, y: 4 }, { id: 'lamp', x: 0, y: 4 }, { id: 'mirror', x: 5, y: 4 },
    { id: 'tulips', x: 6, y: 4 }, { id: 'rug', x: 2, y: 8 },
    { id: 'window', x: 10, y: 0 }, { id: 'shelfwall', x: 11, y: 2 }, { id: 'door', x: 15, y: 1 },
    { id: 'piano', x: 8, y: 3 }, { id: 'sofa', x: 10, y: 8 }, { id: 'table', x: 12, y: 7 },
    { id: 'fridge', x: 14, y: 5 }, { id: 'stove', x: 13, y: 5 },
    { id: 'rug', x: 9, y: 9 },
  ],
  dolls: [
    { pid: 'p-tao', tx: 5, ty: 18, zodiac: 'aries', mbti: 'ENFP', gender: 'f', heart: 'normal', name: '小桃', persona: 'genki', job: 'barista', money: 1800,  look: ORIGINAL_STARTER_LOOKS['p-tao'] },
    { pid: 'p-lan', tx: 10, ty: 17, zodiac: 'gemini', mbti: 'ISTP', gender: 'm', heart: 'fickle', name: '阿懒', persona: 'lazy', job: 'none', money: 180, needs: { energy: 85, hunger: 75, fun: 55, social: 20 },   look: ORIGINAL_STARTER_LOOKS['p-lan'] },
    { pid: 'p-jing', tx: 4, ty: 9, zodiac: 'aquarius', mbti: 'INTJ', gender: 'm', heart: 'loyal', name: '眼镜君', persona: 'nerd', job: 'office', money: 5200, look: ORIGINAL_STARTER_LOOKS['p-jing'] },
    { pid: 'p-tuan', tx: 13, ty: 10, zodiac: 'taurus', mbti: 'ISFJ', gender: 'f', heart: 'loyal', name: '团子', persona: 'foodie', job: 'baker', money: 2600, needs: { energy: 85, hunger: 80, fun: 60, social: 20 }, look: { skin: 0, hair: 'bun',   hairColor: 2, top: 'overall', topColor: 0,  bottom: 'shorts', bottomColor: 0, shoes: 1, acc: 'flower' } },
  ],
};

// 开局的人际关系：团子和阿懒是一对（但阿懒是个花心的），阿懒对小桃也有点意思，眼镜君暗恋小桃
const _rk = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
DEFAULT_SAVE.rel = {
  [_rk('p-tuan', 'p-lan')]:  { f: 80, l: 82, chem: 1.2, lovers: true },
  [_rk('p-lan', 'p-tao')]:   { f: 50, l: 30, chem: 1.3, lovers: false },
  [_rk('p-jing', 'p-tao')]:  { f: 55, l: 35, chem: 1.1, lovers: false },
  [_rk('p-tuan', 'p-tao')]:  { f: 65, l: 0, chem: 1.0, lovers: false },
  [_rk('p-jing', 'p-lan')]:  { f: 30, l: 0, chem: 0.9, lovers: false },
  [_rk('p-jing', 'p-tuan')]: { f: 40, l: 0, chem: 1.0, lovers: false },
};

const NAMES = ['小葵', '米米', '阿豆', '糖糖', '小满', '布丁', '十一', '栗子', '阿星', '可可', '小鱼', '年糕'];
