// 小洋房家具：新增活动沿用住户的需求、寻路和家具占用逻辑。
Object.assign(FURNITURE, {
  toilet:       { name: '奶油马桶', w: 1, h: 1, use: 'toilet', mode: 'front', need: { bladder: 100 } },
  washstand:    { name: '薄荷洗手台', w: 1, h: 1, use: 'wash', mode: 'front', need: { fun: 3 } },
  shower:       { name: '贝壳淋浴间', w: 1, h: 1, use: 'shower', mode: 'front', need: { energy: 8, fun: 8 } },
  cloudBed:     { name: '云朵床', w: 2, h: 2, use: 'sleep', mode: 'on', need: { energy: 26 } },
  moonLamp:     { name: '月亮壁灯', w: 1, h: 1, layer: 'wall' },
  bunnyPicture: { name: '兔兔挂画', w: 1, h: 1, layer: 'wall' },
  cloudMobile:  { name: '星云吊饰', w: 2, h: 1, layer: 'wall' },
  tulips:       { name: '郁金香花瓶', w: 1, h: 1 },
  pawRug:       { name: '猫爪地毯', w: 2, h: 2, layer: 'floor' },
  recordPlayer: { name: '蜜桃唱片机', w: 2, h: 1, use: 'music', mode: 'front', need: { fun: 17 } },
  chessTable:   { name: '奶油棋桌', w: 2, h: 1, use: 'chess', mode: 'front', cap: 2, need: { fun: 16 } },
  knitting:     { name: '草莓毛线篮', w: 1, h: 1, use: 'knit', mode: 'front', need: { fun: 13, energy: 3 } },
  ukulele:      { name: '蜜糖尤克里里', w: 1, h: 1, use: 'strum', mode: 'front', need: { fun: 17 } },
});

Object.assign(TALL, { toilet: 10, washstand: 14, shower: 25, tulips: 11,
  recordPlayer: 10, chessTable: 6, knitting: 2, ukulele: 16 });
Object.assign(ACT_NAMES, {
  toilet: '上厕所', wash: '洗手', shower: '淋浴', chess: '下棋', knit: '织毛线', strum: '弹尤克里里',
});
Object.assign(ACT_LINES, {
  toilet: ['一会儿就好'], wash: ['洗干净啦'], shower: ['水温正好～'],
  chess: ['下一步走哪儿？', '该你走啦'], knit: ['再织一行', '这团毛线真软'],
  strum: ['试一段新和弦', '♪ 噔噔'],
});
Object.assign(PERSONAS.nerd.like, { chess: 22, knit: 8 });
Object.assign(PERSONAS.lazy.like, { knit: 14 });
Object.assign(PERSONAS.social.like, { strum: 17, chess: 12 });
JOIN.strum = { verb: '听{n}弹尤克里里', like: 'strum', dance: .3,
  lines: ['这段真好听', '🎵'], back: ['再来一小段～', '一起唱吧'] };

const FURNITURE_OUTLINE = '#715d67';
Object.assign(DRAW, {
  toilet(c, x, y, f, t) {
    box(c, x + 3, y - 10, 10, 13, '#fff3df', FURNITURE_OUTLINE);
    R(c, x + 4, y - 9, 8, 2, '#fffdf3');
    R(c, x + 9, y - 6, 2, 1, '#d5a6ae');
    box(c, x + 1, y + 1, 14, 8, '#fff7e8', FURNITURE_OUTLINE);
    R(c, x + 4, y + 4, 8, 3, f?.active ? '#95bdc2' : '#d8e2d7');
    box(c, x + 5, y + 9, 7, 6, '#ead8cf', FURNITURE_OUTLINE);
    if (f?.active && Math.floor(t * 4) % 2) R(c, x + 6, y + 4, 4, 1, '#d5f2f0');
  },
  washstand(c, x, y, f, t) {
    box(c, x + 3, y - 14, 10, 11, '#c0dbd9', '#a18a7c');
    R(c, x + 5, y - 12, 1, 6, '#f8fff3');
    box(c, x + 2, y + 2, 12, 13, '#91c2ae', '#5b7a75');
    R(c, x + 4, y + 6, 8, 1, '#bde2cc');
    R(c, x + 7, y + 9, 2, 2, '#f4dfaa');
    box(c, x, y - 1, 16, 6, '#fff1df', FURNITURE_OUTLINE);
    R(c, x + 5, y + 1, 6, 2, '#b2d6ce');
    R(c, x + 7, y - 4, 3, 3, '#a6a8a5');
    if (f?.active) R(c, x + 9, y + Math.floor(t * 9) % 3, 1, 2, '#fbffff');
  },
  shower(c, x, y, f, t) {
    box(c, x + 1, y - 22, 14, 36, '#d7e8df', '#778988');
    R(c, x + 2, y - 20, 5, 31, '#adcfce');
    R(c, x + 2, y - 19, 1, 29, '#e5f8ef');
    R(c, x + 7, y - 18, 5, 2, '#f5d5b3');
    R(c, x + 11, y - 20, 1, 5, '#a89384');
    R(c, x + 9, y - 5, 3, 2, '#af9281');
    R(c, x + 2, y + 10, 12, 3, '#e0c2c0');
    R(c, x + 2, y + 11, 12, 1, '#f7ded1');
    if (f?.active) for (let i = 0; i < 4; i++) {
      R(c, x + 6 + i * 2, y - 15 + (Math.floor(t * 20) + i * 3) % 23, 1, 3, '#f6fffa');
    }
  },
  cloudBed(c, x, y, f) {
    drawBed(c, x, y, f, false, '#9eb7cf');
    R(c, x + 5, y + 6, 8, 5, '#fff1e1');
    R(c, x + 8, y + 4, 7, 6, '#fff1e1');
    R(c, x + 13, y + 2, 8, 9, '#fff7e7');
    R(c, x + 20, y + 5, 7, 6, '#fff1e1');
    R(c, x + 6, y + 10, 20, 1, '#e4cdd1');
  },
  moonLamp(c, x, y) {
    R(c, x + 6, y + 2, 5, 2, '#a68079');
    R(c, x + 4, y + 4, 3, 7, '#ffdb8f');
    R(c, x + 6, y + 3, 3, 5, '#fff0b9');
    R(c, x + 6, y + 9, 7, 3, '#ffdb8f');
    R(c, x + 7, y + 8, 7, 2, '#fff0b9');
    R(c, x + 9, y + 12, 3, 1, '#c98e7d');
    R(c, x + 11, y + 4, 2, 1, '#fff3ce');
    R(c, x + 12, y + 3, 1, 3, '#fff3ce');
  },
  bunnyPicture(c, x, y) {
    box(c, x + 1, y + 1, 14, 14, '#eec6cf', '#ad7e7d');
    R(c, x + 3, y + 3, 10, 10, '#d5e2cd');
    R(c, x + 5, y + 4, 2, 5, '#fff6e4');
    R(c, x + 9, y + 4, 2, 5, '#fff6e4');
    R(c, x + 4, y + 8, 8, 4, '#fff6e4');
    R(c, x + 6, y + 9, 1, 1, '#71565f');
    R(c, x + 9, y + 9, 1, 1, '#71565f');
    R(c, x + 7, y + 11, 2, 1, '#d497a2');
  },
  cloudMobile(c, x, y, f, t) {
    R(c, x + 15, y, 1, 4, '#806d78');
    R(c, x + 5, y + 4, 22, 1, '#a58a8d');
    for (const [i, dx] of [6, 15, 24].entries()) {
      const dy = Math.round(Math.sin(t * 1.4 + i)), top = y + 5 + (i % 2) * 2;
      R(c, x + dx, top, 1, 4 + dy, '#9e8589');
      R(c, x + dx - 2, top + 4 + dy, 5, 3, ['#fff0bb', '#f6e5e7', '#d5e8ec'][i]);
      R(c, x + dx, top + 3 + dy, 1, 5, '#fff0d6');
    }
  },
  tulips(c, x, y) {
    R(c, x + 5, y - 6, 1, 12, '#5b9679');
    R(c, x + 8, y - 8, 1, 15, '#70a585');
    R(c, x + 11, y - 5, 1, 11, '#5b9679');
    R(c, x + 3, y - 6, 4, 3, '#e697a2');
    R(c, x + 7, y - 10, 4, 4, '#f3c1ab');
    R(c, x + 10, y - 5, 4, 3, '#e8adbf');
    box(c, x + 4, y + 4, 9, 11, '#a6c9bc', '#688581');
    R(c, x + 6, y + 6, 1, 6, '#d5efdf');
  },
  pawRug(c, x, y) {
    const patches = [[7, 11, 18, 15], [2, 3, 6, 11], [9, 0, 6, 10], [17, 0, 6, 10], [24, 4, 6, 10]];
    for (const [dx, dy, w, h] of patches) {
      R(c, x + dx, y + dy + 1, w, h, '#a87590');
      R(c, x + dx + 1, y + dy + 2, w - 2, h - 3, '#efbccf');
      R(c, x + dx + 2, y + dy + 3, w - 4, 3, '#f7d7df');
    }
  },
  recordPlayer(c, x, y, f, t) {
    box(c, x + 2, y - 10, 28, 12, '#d59a93', FURNITURE_OUTLINE);
    R(c, x + 4, y - 8, 24, 7, '#f0c7b7');
    R(c, x + 8, y - 7, 13, 5, '#77667a');
    R(c, x + 11, y - 8, 7, 7, '#77667a');
    R(c, x + 14, y - 6, 2, 2, '#f2cfaa');
    if (f?.active) R(c, x + 11 + Math.floor(t * 8) % 8, y - 5, 1, 1, '#c3a6be');
    R(c, x + 23, y - 7, 1, 4, '#96757d');
    R(c, x + 20, y - 4, 4, 1, '#96757d');
    box(c, x + 2, y + 1, 28, 8, '#efb3a7', FURNITURE_OUTLINE);
    R(c, x + 5, y + 9, 2, 6, '#826667');
    R(c, x + 25, y + 9, 2, 6, '#826667');
  },
  chessTable(c, x, y, f, t) {
    R(c, x + 4, y + 5, 2, 10, '#846b65');
    R(c, x + 26, y + 5, 2, 10, '#846b65');
    box(c, x + 1, y - 5, 30, 12, '#f0d9b8', '#9a7e70');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      if ((row + col) % 2) R(c, x + 7 + col * 3, y - 3 + row * 2, 3, 2, '#a18ca8');
    }
    const step = f?.active ? Math.floor(t * 2) % 3 : 0;
    R(c, x + 12 + step * 2, y - 5, 2, 3, '#705571');
    R(c, x + 19, y - 2, 2, 3, '#fff7e3');
  },
  knitting(c, x, y, f, t) {
    box(c, x + 1, y + 5, 14, 10, '#d3a475', '#967364');
    R(c, x + 2, y + 8, 12, 2, '#e7bd8b');
    R(c, x + 2, y + 12, 12, 1, '#ad806d');
    R(c, x + 3, y + 3, 5, 4, '#da879f');
    R(c, x + 8, y + 2, 5, 5, '#b0cdbb');
    const dy = f?.active ? Math.floor(t * 5) % 2 : 0;
    R(c, x + 5, y - dy, 1, 5, '#f5d1a7');
    R(c, x + 10, y - 2 + dy, 1, 6, '#f5d1a7');
  },
  ukulele(c, x, y, f, t) {
    R(c, x + 3, y + 6, 1, 8, '#7c686a');
    R(c, x + 11, y + 6, 1, 8, '#7c686a');
    box(c, x + 4, y - 6, 8, 15, '#e6b175', '#946c5d');
    R(c, x + 5, y + 3, 6, 4, '#f1ca8b');
    R(c, x + 7, y - 14, 2, 17, '#9c735e');
    R(c, x + 6, y - 16, 4, 4, '#bb9072');
    R(c, x + 7, y - 2, 2, 3, '#765761');
    if (f?.active) R(c, x + 10, y - 8 - Math.floor(t * 3) % 6, 2, 2, '#d9a7bb');
  },
});
