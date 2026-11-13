// Furniture that gives the new personalities places to act.
const ACTIVITY_FURNITURE = {
  vanity:      ['莓果梳妆台', 2, 'style', '试配饰', { fun: 14 }, 15, '这两个发夹哪个更搭？'],
  laundry:     ['奶油洗衣篮', 1, 'tidy', '叠毛巾', { fun: 10 }, 4, '毛巾叠好了，放到上面'],
  yogaMat:     ['薄荷瑜伽垫', 2, 'yoga', '练瑜伽', { fun: 12, energy: 5 }, 0, '吸气，再慢慢呼出去'],
  punchingBag: ['蜜桃沙袋', 1, 'boxPractice', '练拳', { fun: 19, energy: -8 }, 18, '左一下，右一下'],
  craftBench:  ['奶糖手工台', 2, 'craft', '做手工', { fun: 18 }, 10, '把这枚纽扣缝到布贴上'],
  toolbox:     ['柠檬工具箱', 1, 'repair', '修小物', { fun: 15 }, 5, '这回转起来顺多了'],
  scrapbook:   ['星星相册桌', 2, 'scrapbook', '做手账', { fun: 17 }, 6, '给这张照片留一块位置'],
  herbStand:   ['薄荷香草架', 1, 'careHerbs', '照料香草', { fun: 12 }, 17, '这盆薄荷该浇一点水了'],
  teaTray:     ['雏菊茶几', 2, 'sipTea', '泡茶', { fun: 9, energy: 7 }, 7, '等茶叶慢慢泡开'],
};

for (const [id, [name, w, use, label, need, top, line]] of Object.entries(ACTIVITY_FURNITURE)) {
  FURNITURE[id] = { name, w, h: 1, use, mode: 'front', need };
  TALL[id] = top;
  ACT_NAMES[use] = label;
  ACT_LINES[use] = [line];
}
Object.assign(FURNITURE, {
  corkboard: { name: '便签软木板', w: 2, h: 1, layer: 'wall' },
  plushRabbit: { name: '长耳兔玩偶', w: 1, h: 1 },
  paperLantern: { name: '绣球纸灯', w: 1, h: 1, layer: 'wall' },
});
Object.assign(TALL, { plushRabbit: 8 });
Object.assign(PERSONAS.lazy.like, { sipTea: 26 });
Object.assign(PERSONAS.foodie.like, { sipTea: 21, careHerbs: 17 });

const PASTEL_EDGE = FURNITURE_STYLE.edge;

function hobbyTable(c, x, y, color) {
  R(c, x + 3, y + 5, 2, 10, WOOD_D);
  R(c, x + 27, y + 5, 2, 10, WOOD_D);
  furnitureBox(c, x + 1, y - 1, 30, 8, color, PASTEL_EDGE);
  R(c, x + 3, y + 1, 26, 2, '#fff3db');
}

Object.assign(DRAW, {
  vanity(c, x, y) {
    furnitureBox(c, x + 9, y - 15, 15, 15, '#c3dbdd', FURNITURE_STYLE.roseDark);
    R(c, x + 11, y - 13, 2, 9, '#f4fbef');
    hobbyTable(c, x, y, FURNITURE_STYLE.rose);
    R(c, x + 4, y - 5, 3, 5, '#d383a6');
    R(c, x + 25, y - 4, 4, 4, '#a598c8');
    R(c, x + 9, y + 6, 14, 4, FURNITURE_STYLE.roseDark);
  },
  laundry(c, x, y, f, t) {
    furnitureBox(c, x + 1, y + 4, 14, 11, WOOD, WOOD_D);
    for (let i = 3; i < 15; i += 3) R(c, x + i, y + 7, 1, 6, WOOD_L);
    R(c, x + 3, y + 1, 10, 4, '#e9b5c7');
    R(c, x + 5, y - 2, 7, 3, f?.active && Math.floor(t * 4) % 2 ? '#a9d6c2' : '#fff1db');
  },
  yogaMat(c, x, y) {
    R(c, x + 1, y + 7, 30, 7, '#689889');
    R(c, x + 2, y + 6, 28, 6, '#a4d2be');
    R(c, x + 4, y + 7, 22, 1, '#d3ead3');
    furnitureBox(c, x + 25, y + 3, 6, 8, '#bee2c6', '#689889');
  },
  punchingBag(c, x, y, f, t) {
    const dx = f?.active ? Math.round(Math.sin(t * 8) * 2) : 0;
    R(c, x + 11, y - 18, 2, 31, '#8c7180');
    R(c, x + 5, y - 18, 8, 2, '#8c7180');
    R(c, x + 5, y + 11, 11, 4, '#a78a91');
    furnitureBox(c, x + 2 + dx, y - 14, 9, 19, '#dea0a2', '#aa707f');
    R(c, x + 4 + dx, y - 12, 2, 13, '#f4c2bb');
  },
  craftBench(c, x, y, f, t) {
    R(c, x + 4, y - 10, 24, 10, '#d2b69f');
    R(c, x + 8, y - 8, 1, 6, '#9f7c76');
    R(c, x + 17, y - 7, 4, 4, '#bd8eb0');
    hobbyTable(c, x, y, WOOD_L);
    R(c, x + 5, y - 4, 8, 4, '#e4aac1');
    R(c, x + 18, y - 3, 8, 4, f?.active && Math.floor(t * 4) % 2 ? '#d6b7d4' : '#a7cbb5');
  },
  toolbox(c, x, y) {
    furnitureBox(c, x + 1, y + 4, 14, 10, '#dfb873', '#a18469');
    furnitureBox(c, x + 5, y + 1, 6, 5, '#fff0cf', '#9e856d');
    R(c, x + 2, y + 7, 12, 2, '#f6d79e');
    R(c, x + 7, y + 8, 2, 2, '#94748a');
  },
  scrapbook(c, x, y) {
    hobbyTable(c, x, y, FURNITURE_STYLE.lavender);
    furnitureBox(c, x + 6, y - 6, 15, 7, '#fff3dd', '#a982a3');
    R(c, x + 13, y - 5, 1, 5, '#d5adc9');
    R(c, x + 8, y - 4, 4, 3, '#92bcc0');
    R(c, x + 16, y - 4, 3, 1, '#cf9eb8');
    R(c, x + 24, y - 5, 4, 5, '#d69fb9');
  },
  herbStand(c, x, y, f, t) {
    R(c, x + 2, y - 9, 2, 24, WOOD_D);
    R(c, x + 12, y - 9, 2, 24, WOOD_D);
    for (const [i, dy] of [-9, 5].entries()) {
      R(c, x + 2, y + dy + 4, 12, 2, WOOD);
      furnitureBox(c, x + 5, y + dy, 6, 5, '#d4a098', '#97796e');
      R(c, x + 7, y + dy - 8, 2, 8, '#638d6e');
      R(c, x + 4 + i, y + dy - 5, 7, 2, '#96bf91');
    }
    if (f?.active) R(c, x + 11, y - 10 + Math.floor(t * 9) % 4, 1, 2, '#c4e1e1');
  },
  teaTray(c, x, y, f, t) {
    hobbyTable(c, x, y, WOOD_L);
    furnitureBox(c, x + 9, y - 5, 8, 6, '#f2ddaa', '#b29886');
    R(c, x + 17, y - 3, 2, 2, '#b29886');
    R(c, x + 21, y - 3, 4, 4, '#f4eadb');
    if (f?.active) R(c, x + 12, y - 7 - Math.floor(t * 3) % 3, 1, 2, '#fff9e4');
  },
  corkboard(c, x, y) {
    furnitureBox(c, x + 2, y + 1, 28, 13, '#d5b38d', '#a48372');
    for (const [dx, dy, color] of [[5, 5, '#f7e3b0'], [13, 3, '#e6b2c7'], [22, 6, '#bfdac7']]) {
      R(c, x + dx, y + dy, 5, 5, color);
      R(c, x + dx + 2, y + dy, 1, 1, '#98758a');
    }
  },
  plushRabbit(c, x, y) {
    R(c, x + 4, y - 8, 3, 10, '#f6e4d5');
    R(c, x + 9, y - 7, 3, 10, '#f6e4d5');
    R(c, x + 5, y - 6, 1, 5, '#e5b1c0');
    furnitureBox(c, x + 2, y, 12, 9, '#f5e2d4', '#bd9a91');
    furnitureBox(c, x + 4, y + 8, 8, 6, '#e9ccbc', '#bd9a91');
    R(c, x + 5, y + 3, 1, 2, '#77596b');
    R(c, x + 10, y + 3, 1, 2, '#77596b');
    R(c, x + 7, y + 6, 2, 1, '#d68fa9');
  },
  paperLantern(c, x, y) {
    R(c, x + 7, y, 2, 4, '#9c808b');
    furnitureBox(c, x + 3, y + 4, 10, 10, '#ebafc4', '#b5829b');
    R(c, x + 5, y + 6, 6, 6, '#f3d0d4');
    R(c, x + 7, y + 6, 2, 6, '#ffebc4');
    R(c, x + 7, y + 14, 2, 2, '#b5829b');
  },
});
