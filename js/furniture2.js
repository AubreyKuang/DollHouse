// 第二批家具：带来新活动（喝咖啡、看鱼、学习、上网、听音乐、画画、跑步）和两件墙面装饰
// 和第一批一样，全部用 fillRect 现场画

Object.assign(FURNITURE, {
  beanbag:   { name: '懒人沙发', w: 1, h: 1, use: 'sit',      mode: 'on',    need: { energy: 6, fun: 6 } },
  coffee:    { name: '咖啡机',   w: 1, h: 1, use: 'coffee',   mode: 'front', need: { energy: 18, fun: 3 } },
  aquarium:  { name: '鱼缸',     w: 2, h: 1, use: 'fish',     mode: 'front', need: { fun: 10 } },
  desk:      { name: '书桌',     w: 2, h: 1, use: 'study',    mode: 'front', need: { fun: 6 } },
  pc:        { name: '电脑桌',   w: 2, h: 1, use: 'pc',       mode: 'front', need: { fun: 20, social: 6 } },
  speaker:   { name: '音响',     w: 1, h: 1, use: 'music',    mode: 'front', need: { fun: 18 } },
  easel:     { name: '画架',     w: 1, h: 1, use: 'paint',    mode: 'front', need: { fun: 16 } },
  treadmill: { name: '跑步机',   w: 2, h: 1, use: 'exercise', mode: 'on',    need: { fun: 12, energy: -12, hunger: -8 } },
  garland:   { name: '彩灯',     w: 3, h: 1, use: null, layer: 'wall' },
  shelfwall: { name: '置物架',   w: 2, h: 1, use: null, layer: 'wall' },
});

Object.assign(TALL, { beanbag: 0, coffee: 12, aquarium: 14, desk: 12, pc: 16, speaker: 16, easel: 14, treadmill: 14 });

Object.assign(ACT_NAMES, { coffee: '喝咖啡', fish: '看鱼', study: '学习', pc: '上网', music: '听音乐', paint: '画画', exercise: '跑步' });
Object.assign(ACT_LINES, {
  coffee:   ['☕ 提神！', '好香的咖啡', '续命中……'],
  fish:     ['🐟 游来游去', '好治愈～', '小鱼你好呀'],
  study:    ['📝 写作业', '这题怎么做……', '再背一个单词'],
  pc:       ['💻 冲浪中', '在和网友聊天', '这视频笑死我了'],
  music:    ['🎵 动次打次', '这首好好听', '音量调大！'],
  paint:    ['🎨 画画中', '灵感来了！', '再加一点蓝色'],
  exercise: ['🏃 呼哧呼哧', '燃烧卡路里！', '再跑一公里'],
});
PRICES.coffee = 6; PRICE_NAME.coffee = '咖啡钱';

// 新活动也可以围观：放音乐大家会一起跳舞
Object.assign(JOIN, {
  music: { verb: '跟着{n}的音乐跳舞', like: 'music', dance: 0.9, lines: ['这歌好嗨！', '一起蹦迪！', '🎶 摇起来'], back: ['音乐响起来！', '嗨起来～'] },
  pc:    { verb: '围观{n}上网', like: 'pc', dance: 0, lines: ['在看什么？', '让我也看看', '哈哈哈这个视频'], back: ['别偷看！', '给你看个好玩的'] },
  paint: { verb: '看{n}画画', like: 'paint', dance: 0, lines: ['画得真好！', '这是我吗？', '教教我嘛'], back: ['还没画完呢', '送你一幅～'] },
});

// 各性格对新活动的喜好
Object.assign(PERSONAS.genki.like,  { exercise: 35, music: 30, pc: 10 });
Object.assign(PERSONAS.lazy.like,   { pc: 20, fish: 15, exercise: -30 });
Object.assign(PERSONAS.nerd.like,   { study: 35, pc: 25, fish: 20, paint: 10 });
Object.assign(PERSONAS.foodie.like, { coffee: 25, fish: 5 });
Object.assign(PERSONAS.social.like, { music: 25, pc: 15, paint: 10 });

Object.assign(DRAW, {
  beanbag(c, x, y) {
    const col = '#e1ad71';
    R(c, x + 2, y + 3, 12, 12, INK); R(c, x + 1, y + 6, 14, 9, INK); R(c, x + 4, y + 1, 8, 3, INK);
    R(c, x + 3, y + 4, 10, 10, col); R(c, x + 2, y + 7, 12, 7, col); R(c, x + 5, y + 2, 6, 3, col);
    R(c, x + 4, y + 5, 8, 2, shade(col, 0.15)); R(c, x + 3, y + 12, 10, 2, shade(col, -0.18));
  },
  coffee(c, x, y, f, t) {
    box(c, x + 1, y - 2, 14, 17, WOOD); R(c, x + 2, y + 4, 12, 1, WOOD_D); R(c, x + 7, y + 6, 2, 2, WOOD_L);
    box(c, x + 3, y - 12, 10, 11, '#4e4557'); R(c, x + 4, y - 11, 8, 2, '#675a6e'); R(c, x + 5, y - 7, 6, 2, '#a9b6c0');
    box(c, x + 6, y - 4, 4, 3, '#fffaf0');
    R(c, x + 11, y - 10, 1, 1, f && f.active ? '#ca8290' : '#88ab83');
    if (f && f.active) { const k = Math.floor(t * 4) % 2; R(c, x + 7 + k, y - 7, 1, 2, '#ffffffaa'); R(c, x + 8 - k, y - 10, 1, 2, '#ffffff77'); }
  },
  aquarium(c, x, y, f, t) {
    drawCottageSprite(c, 'aquarium', x, y - 14, 32, 29);
    const fx = x + 5 + Math.round((Math.sin(t * 0.8) + 1) * 9), fy = y - 9 + Math.round(Math.sin(t * 1.7));
    R(c, fx, fy, 3, 2, '#e1ad71'); R(c, fx - 1, fy, 1, 2, '#ca8290'); R(c, fx + 2, fy, 1, 1, INK);
    const gx = x + 22 - Math.round((Math.sin(t * 0.6 + 1) + 1) * 7);
    R(c, gx, y - 5, 2, 1, '#ca8290'); R(c, gx + 2, y - 5, 1, 1, '#c24d60');
    const b = Math.floor(t * 3) % 6; R(c, x + 20, y - 3 - b * 2, 1, 1, '#ffffff');
  },
  desk(c, x, y) {
    drawCottageSprite(c, 'desk', x, y - 9, 32, 24);
  },
  pc(c, x, y, f, t) {
    R(c, x + 2, y + 4, 2, 11, '#675a6e'); R(c, x + 28, y + 4, 2, 11, '#675a6e');
    box(c, x, y - 2, 32, 7, '#d8d0c4', '#675a6e');
    box(c, x + 8, y - 16, 16, 12, '#4e4557', INK); R(c, x + 15, y - 4, 2, 2, '#675a6e');
    const on = f && f.active;
    R(c, x + 9, y - 15, 14, 9, on ? ['#7e9fbd', '#9582b1', '#88ab83'][Math.floor(t * 2) % 3] : '#2a3a4a');
    if (on) { R(c, x + 11, y - 13, 6, 1, '#ffffffaa'); R(c, x + 11, y - 11, 8, 1, '#ffffff77'); R(c, x + 11, y - 9, 4, 1, '#ffffff77'); }
    R(c, x + 9, y, 12, 2, '#675a6e'); R(c, x + 24, y, 3, 2, '#675a6e');
    box(c, x + 2, y - 12, 5, 10, '#4e4557'); R(c, x + 3, y - 10, 1, 1, '#88ab83');
  },
  speaker(c, x, y, f, t) {
    box(c, x + 2, y - 14, 12, 29, '#4e4557', INK);
    const on = f && f.active, p = on ? Math.floor(t * 6) % 2 : 0;
    R(c, x + 5 - p, y - 10 - p, 6 + 2 * p, 6 + 2 * p, '#675a6e'); R(c, x + 7, y - 8, 2, 2, '#2a2230');
    R(c, x + 4 - p, y - 1 - p, 8 + 2 * p, 8 + 2 * p, '#675a6e'); R(c, x + 7, y + 2, 2, 2, '#2a2230');
    R(c, x + 11, y - 12, 1, 1, on ? '#88ab83' : '#ca8290');
    if (on) {
      const ny = y - 16 - Math.round(((t * 1.5) % 1) * 10);
      R(c, x + 13, ny, 2, 2, '#ca8290'); R(c, x + 14, ny - 3, 1, 3, '#ca8290');
      R(c, x + 1, ny + 4, 2, 2, '#7e9fbd'); R(c, x + 2, ny + 1, 1, 3, '#7e9fbd');
    }
  },
  easel(c, x, y, f, t) {
    drawCottageSprite(c, 'easel', x, y - 14, 16, 29);
    if (f?.active) {
      const k = Math.floor(t * 3) % 3;
      detail(c, x + 4 + k * 2, y - 4, 1, 1, ['#ca8290', '#e1ad71', '#9582b1'][k]);
    }
  },
  treadmill(c, x, y, f, t) {
    R(c, x + 1, y + 6, 30, 8, INK); R(c, x + 2, y + 7, 28, 6, '#675a6e');
    const off = f && f.active ? Math.floor(t * 12) % 4 : 0;
    for (let i = 0; i < 7; i++) R(c, x + 3 + ((i * 4 + off) % 26), y + 9, 1, 2, '#4e4557');
    R(c, x + 2, y - 10, 2, 17, '#a9b6c0'); box(c, x, y - 14, 8, 5, '#4e4557');
    R(c, x + 2, y - 13, 3, 1, f && f.active ? '#88ab83' : '#ca8290');
    R(c, x + 2, y - 8, 10, 1, '#a9b6c0');
  },
  garland(c, x, y) {
    const cols = ['#ca8290', '#efd189', '#88ab83', '#7e9fbd', '#9582b1'], lit = G.dark > 0.1;
    for (let i = 0; i < 48; i += 2) R(c, x + i, y + 4 + Math.round(Math.sin(i / 48 * Math.PI) * 6), 2, 1, '#4e4557');
    for (let i = 0; i < 8; i++) {
      const xx = x + 3 + i * 6, yy = y + 5 + Math.round(Math.sin((xx - x) / 48 * Math.PI) * 6);
      R(c, xx, yy, 2, 3, lit ? cols[i % 5] : shade(cols[i % 5], -0.25));
    }
  },
  shelfwall(c, x, y) {
    drawCottageSprite(c, 'shelfwall', x + 1, y, 30, 14);
  },
});

FURNITURE.mirror={name:"穿衣镜",w:1,h:1,use:"groom",mode:"front",need:{fun:9}};
DRAW.mirror = (c, x, y) => drawCottageSprite(c, 'mirror', x + 1, y - 9, 14, 24);
TALL.mirror=9;

Object.assign(ACT_NAMES,{meal:'用餐',groom:'整理仪容'});
Object.assign(ACT_LINES,{meal:['今天的晚饭真香','一起吃吧'],groom:['理一理头发','今天这身不错']});
