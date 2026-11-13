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
    contactShadow(c, x + 1, y + 14, 46);
    drawCottageSprite(c, 'gardenSwing', x, y - 17, 48, 32);
    for (const seat of [0, 1]) {
      const left = x + 10 + seat * 16;
      const active = f.users?.some(d => d.state === 'act' && d.act?.seat === seat);
      const off = active ? swingOffset(t) : 0;
      R(c, left, y - 13, 1, 23 + off, '#e7d6a4');
      R(c, left + 8, y - 13, 1, 23 + off, '#e7d6a4');
      for (const rope of [left, left + 8]) {
        detail(c, rope, y - 13, .5, 23 + off, '#f4e5bb');
        R(c, rope, y - 13, 1, 2, '#9a745d');
      }
      bevel(c, left - 1, y + 9 + off, 11, 3, seat ? '#e3ae8d' : '#d99ca1', '#7d514f');
    }
  },
  gardenBench(c, x, y) {
    drawCottageSprite(c, 'gardenBench', x, y - 6, 32, 21);
  },
  flowerBox(c, x, y, f, t) {
    drawCottageSprite(c, 'flowerBox', x, y - 7, 32, 22);
    if (f?.active) for (const [i, dx] of [5, 11, 17, 23, 27].entries()) {
      detail(c, x + dx + 2, y - 8 + Math.floor((t * 12 + i * 3) % 10), 1, 2, '#87d4e4');
    }
  },
  picnicTable(c, x, y, f) {
    drawCottageSprite(c, 'picnicTable', x, y - 5, 48, 20);
    if (f?.active) {
      bevel(c, x + 17, y - 4, 5, 3, '#f8f4dc', '#be8d79');
      bevel(c, x + 28, y - 6, 3, 4, '#da9295', '#b77984');
    }
  },
  puzzleDesk(c, x, y, f, t) {
    for (const px of [4, 25]) R(c, x + px, y + 5, 3, 9, '#9f765b');
    box(c, x + 1, y - 2, 30, 10, '#ecc99f', '#9f765b');
    R(c, x + 7, y, 18, 6, '#f9edda');
    const pieces = ['#7da7c8', '#8dac83', '#dc9a9d', '#e6b972'];
    const shown = f.active ? 2 + Math.floor(t * 2) % 3 : 2;
    for (let i = 0; i < shown; i++) {
      R(c, x + 8 + i * 4, y + 1, 3, 4, pieces[i]);
      R(c, x + 11 + i * 4, y + 2, 1, 2, pieces[i]);
    }
  },
});
