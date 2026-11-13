// Outdoor furniture uses the same reservations and need system as indoor furniture.
const YARD_DEFAULT = [['gardenSwing', 1, 23], ['gardenBench', 5, 23], ['flowerBox', 8, 23], ['picnicTable', 12, 23]];

Object.assign(FURNITURE, {
  gardenSwing: { name: '木架秋千', w: 3, h: 1, outdoor: true, use: 'swing', mode: 'on', cap: 2, need: { fun: 24, social: 5 } },
  gardenBench: { name: '鼠尾草长椅', w: 2, h: 1, outdoor: true, use: 'gardenRest', mode: 'on', cap: 2, need: { energy: 10, fun: 6, social: 5 } },
  flowerBox: { name: '雏菊花箱', w: 2, h: 1, outdoor: true, use: 'waterFlowers', mode: 'front', need: { fun: 14 } },
  picnicTable: { name: '格纹野餐桌', w: 3, h: 1, outdoor: true, use: 'picnic', mode: 'front', cap: 3, need: { hunger: 14, fun: 12, social: 12 } },
  puzzleDesk: { name: '奶油拼图桌', w: 2, h: 1, use: 'puzzle', mode: 'front', cap: 2, need: { fun: 18, social: 8 } },
});
Object.assign(SHOP, { gardenSwing: [620, 1], gardenBench: [320, 1], flowerBox: [190, 1], picnicTable: [440, 1], puzzleDesk: [390, 1] });
Object.assign(TALL, { gardenSwing: 18, gardenBench: 6, flowerBox: 7, picnicTable: 5, puzzleDesk: 5 });
Object.assign(ACT_NAMES, { swing: '荡秋千', gardenRest: '坐在长椅上休息', waterFlowers: '给雏菊浇水', picnic: '在院子里野餐', puzzle: '拼拼图' });
Object.assign(ACT_LINES, {
  swing: ['再荡高一点！', '风吹过来啦～'], gardenRest: ['在院子里坐一会儿吧'],
  waterFlowers: ['这朵又开大了一点'], picnic: ['带了草莓和三明治，分你一点！'],
  puzzle: ['这块蓝色的是天空吧？', '最后一块在哪儿呢？'],
});

const swingOffset = t => Math.round(Math.sin(t * 5) * 3);
Object.assign(DRAW, {
  gardenSwing(c, x, y, f, t) {

    housePoly(c, WOOD_D, [x + 1, y + 14], [x + 9, y - 14], [x + 13, y - 14], [x + 5, y + 14]);
    housePoly(c, WOOD_D, [x + 43, y + 14], [x + 35, y - 14], [x + 39, y - 14], [x + 47, y + 14]);
    bevel(c, x + 6, y - 16, 36, 4, WOOD, WOOD_D);
    detail(c, x + 8, y - 15, 32, .5, WOOD_L);
    for (const seat of [0, 1]) {
      const left = x + 10 + seat * 16;
      const active = f.users?.some(d => d.state === 'act' && d.act?.seat === seat);
      const off = active ? swingOffset(t) : 0;
      R(c, left, y - 12, 1, 22 + off, '#e7d6a4');
      R(c, left + 8, y - 12, 1, 22 + off, '#e7d6a4');
      for (const rope of [left, left + 8]) {
        detail(c, rope, y - 12, .5, 22 + off, '#f4e5bb');
        R(c, rope, y - 13, 1, 2, '#9a745d');
      }
      bevel(c, left - 1, y + 9 + off, 11, 3, seat ? '#e3ae8d' : '#d99ca1', '#7d514f');
    }
  },
  gardenBench(c, x, y) {

    R(c, x + 5, y + 9, 3, 6, FURNITURE_STYLE.mintDark); R(c, x + 24, y + 9, 3, 6, FURNITURE_STYLE.mintDark);
    furnitureBox(c, x + 2, y - 2, 28, 9, FURNITURE_STYLE.mint, FURNITURE_STYLE.mintDark);
    R(c, x + 3, y + 1, 26, 1, '#c4d2a6'); R(c, x + 3, y + 4, 26, 1, '#6d8b6e');
    bevel(c, x + 1, y + 6, 30, 4, FURNITURE_STYLE.mintLight, FURNITURE_STYLE.mintDark);
    detail(c, x + 3, y + 7, 26, .5, '#d6d9b4');
  },
  flowerBox(c, x, y, f, t) {

    bevel(c, x + 1, y + 5, 30, 9, WOOD, WOOD_D);
    R(c, x + 2, y + 6, 28, 2, WOOD_L);
    for (const [i, px] of [5, 11, 17, 23, 27].entries()) {
      const top = y + i % 2 * 3 - 4;
      R(c, x + px, top + 3, 1, 8, '#4a8158');
      R(c, x + px - 2, top + 6, 2, 1, '#6ca068');
      const petals = i % 2 ? '#edbbb5' : '#fff5d9';
      R(c, x + px - 2, top + 1, 5, 1, petals);
      R(c, x + px - 1, top, 3, 3, petals);
      R(c, x + px, top + 1, 1, 1, '#d5a33f');
      if (f.active) R(c, x + px + 2, y - 8 + Math.floor((t * 12 + i * 3) % 10), 1, 2, '#87d4e4');
    }
  },
  picnicTable(c, x, y, f) {

    for (const px of [6, 39]) R(c, x + px, y + 5, 3, 9, WOOD_D);
    furnitureBox(c, x + 2, y + 7, 44, 4, WOOD, WOOD_D);
    furnitureBox(c, x + 5, y, 38, 7, WOOD_L, WOOD_D);
    R(c, x + 12, y + 1, 24, 7, '#eeb6b1');
    for (let px = 12; px < 36; px += 4) R(c, x + px, y + 1, 2, 7, '#fff1dd');
    R(c, x + 12, y + 3, 24, 2, '#d991945a');
    if (f.active) { R(c, x + 17, y, 5, 3, '#f8f4dc'); R(c, x + 28, y - 2, 3, 4, '#b77984'); }
  },
  puzzleDesk(c, x, y, f, t) {
    for (const px of [4, 25]) R(c, x + px, y + 5, 3, 9, WOOD_D);
    furnitureBox(c, x + 1, y - 2, 30, 10, FURNITURE_STYLE.cream, WOOD_D);
    R(c, x + 7, y, 18, 6, '#f9edda');
    const pieces = ['#7da7c8', '#8dac83', '#dc9a9d', '#e6b972'];
    const shown = f.active ? 2 + Math.floor(t * 2) % 3 : 2;
    for (let i = 0; i < shown; i++) {
      R(c, x + 8 + i * 4, y + 1, 3, 4, pieces[i]);
      R(c, x + 11 + i * 4, y + 2, 1, 2, pieces[i]);
    }
  },
});
