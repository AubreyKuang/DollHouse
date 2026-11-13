// 道具保持逻辑格尺寸，细节贴图由 Canvas 与动画合成。
const INK = '#493743';
const PIXEL_SCALE = 2;

const cottageAtlas = document.getElementById('cottageAtlas');
const COTTAGE_SPRITES = {
  bigbed: [0, 0, 120, 96], sofa: [128, 0, 128, 76], piano: [256, 0, 112, 99],
  shelf: [0, 128, 78, 112], window: [128, 128, 124, 105], oak: [256, 128, 128, 128],
  desk: [0, 256, 112, 90], arcade: [128, 256, 74, 112], plant: [256, 256, 82, 112],
  toilet: [0, 384, 88, 100], washstand: [128, 384, 78, 112], shower: [256, 384, 62, 112], cloudBed: [384, 384, 99, 110],
  bed: [0, 512, 99, 110], table: [128, 512, 126, 87], fridge: [256, 512, 80, 120], stove: [384, 512, 88, 116],
  chair: [0, 640, 72, 112], tv: [128, 640, 103, 119], bath: [256, 640, 126, 78], lamp: [384, 640, 51, 120],
  gardenSwing: [0, 768, 126, 100], gardenBench: [128, 768, 121, 95],
  flowerBox: [256, 768, 126, 87], picnicTable: [384, 768, 126, 84],
  door: [0, 896, 84, 120], mirror: [128, 896, 58, 120], rug: [256, 896, 126, 63], shelfwall: [384, 896, 126, 80],
  moonLamp: [0, 1024, 69, 108], cloudMobile: [128, 1024, 91, 114],
  bunnyPicture: [256, 1024, 86, 99], tulips: [384, 1024, 78, 114],
  catbed: [0, 1152, 126, 87], aquarium: [128, 1152, 126, 102],
  recordPlayer: [256, 1152, 124, 101], easel: [384, 1152, 81, 120],
};
const cottageArtReady = () => Boolean(cottageAtlas?.complete && cottageAtlas.naturalWidth);

function drawCottageSprite(c, id, x, y, w, h, from = 0, to = 1) {
  if (!cottageArtReady()) return;
  const [sx, sy, sw, sh] = COTTAGE_SPRITES[id];
  const portion = to - from;
  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(cottageAtlas, sx, sy + sh * from, sw, sh * portion, x, y + h * from, w, h * portion);
  c.restore();
}

// Fine details snap to the same half-tile-pixel grid in the house and portraits.
function detail(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(Math.round(x * PIXEL_SCALE) / PIXEL_SCALE, Math.round(y * PIXEL_SCALE) / PIXEL_SCALE, w, h);
}

function bevel(c, x, y, w, h, fill, line) {
  R(c, x + 1, y, w - 2, h, line);
  R(c, x, y + 1, w, h - 2, line);
  R(c, x + 1, y + 1, w - 2, h - 2, fill);
}

function contactShadow(c, x, y, w) {
  R(c, x + 1, y, w - 2, 2, '#4b364221');
  R(c, x, y + 1, w, 1, '#4b36421c');
}

function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x | 0, y | 0, w | 0, h | 0); }
// 带描边的方块：先画深色外框，再往里缩一像素填色
function box(c, x, y, w, h, fill, line = INK) { R(c, x, y, w, h, line); R(c, x + 1, y + 1, w - 2, h - 2, fill); }
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
// 伪随机：同一个种子永远得到同样结果，用来给书本、草地这类细节配色
function rnd(seed) { const s = Math.sin(seed * 9301 + 49297) * 233280; return s - Math.floor(s); }

/* ---------------- 墙纸与地板 ---------------- */
function drawWall(c, wall, h = WALL_ROWS * T) {
  R(c, 0, 0, W, h, wall.base);
  const a = wall.alt;
  if (wall.pat === 'stripe') for (let x = 0; x < W; x += 8) R(c, x, 0, 3, h, a);
  if (wall.pat === 'dots') for (let y = 3; y < h; y += 8) for (let x = (y / 8 % 2) * 4 + 2; x < W; x += 8) R(c, x, y, 2, 2, a);
  if (wall.pat === 'diamond') for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 4; x < W; x += 8) { R(c, x + 2, y + 1, 1, 1, a); R(c, x + 1, y + 2, 3, 1, a); R(c, x + 2, y + 3, 1, 1, a); }
  if (wall.pat === 'clouds') for (let i = 0; i < 9; i++) { const x = rnd(i) * W, y = 4 + rnd(i + 20) * (h - 16); R(c, x, y + 2, 14, 4, a); R(c, x + 3, y, 7, 3, a); }
  if (wall.pat === 'brick') for (let y = 0; y < h; y += 6) { R(c, 0, y + 5, W, 1, a); for (let x = (y / 6 % 2) * 6; x < W; x += 12) R(c, x, y, 1, 5, a); }
  if (wall.pat === 'plank') for (let x = 0; x < W; x += 10) { R(c, x, 0, 1, h, a); R(c, x + 4, (rnd(x) * h) | 0, 1, 3, a); }
  if (wall.pat === 'stars') for (let i = 0; i < 30; i++) { const x = rnd(i) * W, y = rnd(i + 50) * (h - 6); R(c, x, y, 1, 1, a); if (i % 4 === 0) { R(c, x - 1, y, 3, 1, a); R(c, x, y - 1, 1, 3, a); } }
  // 踢脚线
  R(c, 0, h - 4, W, 4, shade(wall.base, -0.25)); R(c, 0, h - 4, W, 1, shade(wall.base, 0.1)); R(c, 0, h, W, 1, INK);
}

function drawFloor(c, floor, y0 = WALL_ROWS * T + 1, end = H) {
  const h = end - y0;
  R(c, 0, y0, W, h, floor.base);
  const a = floor.alt;
  if (floor.pat === 'plank') for (let y = y0; y < end; y += 6) { R(c, 0, y + 5, W, 1, a); for (let x = (rnd(y) * 30) | 0; x < W; x += 30) R(c, x, y, 1, 5, a); }
  if (floor.pat === 'check') for (let y = y0; y < end; y += 8) for (let x = ((y - y0) / 8 % 2) * 8; x < W; x += 16) R(c, x, y, 8, 8, a);
  if (floor.pat === 'tile') for (let y = y0; y < end; y += 16) for (let x = 0; x < W; x += 16) { R(c, x, y, 16, 1, a); R(c, x, y, 1, 16, a); R(c, x + 2, y + 2, 2, 1, '#ffffff55'); }
  if (floor.pat === 'carpet') for (let i = 0; i < 260; i++) R(c, rnd(i) * W, y0 + rnd(i + 999) * h, 1, 1, a);
  if (floor.pat === 'grass') for (let i = 0; i < 200; i++) { const x = rnd(i) * W, y = y0 + rnd(i + 7) * h; R(c, x, y, 1, 2, a); if (i % 23 === 0) R(c, x, y, 2, 2, i % 2 ? '#fff6a0' : '#e6a9bb'); }
  // 墙脚阴影
  R(c, 0, y0, W, 2, 'rgba(0,0,0,.12)');
}

/* ---------------- 家具 ----------------
   每个函数参数：(c, px, py, f, t)，px/py 是占地格子左上角像素，
   高家具会往上画超出占地格；f 是家具实例（f.active 表示有人在用，f.occ 是躺/坐上去的小人回调） */
const WOOD = '#ae7856', WOOD_L = '#d7a77a', WOOD_D = '#785247';

function drawBed(c, x, y, f, id) {
  const double = id === 'bigbed', width = double ? 46 : 30;
  contactShadow(c, x + 1, y + 30, width);
  drawCottageSprite(c, id, x + 1, y, width, 32);
  if (f?.occ) {
    for (const [slot, center] of (double ? [13, 35] : [16]).entries()) f.occ(slot, x + center, y + 20);
    drawCottageSprite(c, id, x + 1, y, width, 32, double ? .48 : .43);
  }
}

const DRAW = {
  bed(c, x, y, f) { drawBed(c, x, y, f, 'bed'); },
  bigbed(c, x, y, f) { drawBed(c, x, y, f, 'bigbed'); },
  sofa(c, x, y) {
    drawCottageSprite(c, 'sofa', x, y - 7, 32, 22);
  },
  chair(c, x, y) {
    drawCottageSprite(c, 'chair', x + 1, y - 9, 14, 24);
  },
  table(c, x, y) {
    drawCottageSprite(c, 'table', x, y - 6, 32, 21);
  },
  fridge(c, x, y) {
    drawCottageSprite(c, 'fridge', x, y - 18, 16, 33);
  },
  stove(c, x, y, f, t) {
    drawCottageSprite(c, 'stove', x, y - 10, 16, 25);
    if (f?.active) {
      const k = Math.floor(t * 8) % 2;
      detail(c, x + 3, y - 7, 4, 1, k ? '#efd189' : '#e1ad71');
      detail(c, x + 10 + k, y - 10 - k, 1, 2, '#ffffffaa');
    }
  },
  shelf(c, x, y) {
    drawCottageSprite(c, 'shelf', x + 2, y - 22, 28, 37);
  },
  tv(c, x, y, f, t) {
    drawCottageSprite(c, 'tv', x + 1, y - 17, 30, 32);
    if (f?.active) {
      const colors = ['#7e9fbd', '#88ab83', '#efd189', '#ca8290'];
      const k = Math.floor(t * 1.5) % colors.length;
      bevel(c, x + 5, y - 9, 15, 10, colors[k], '#625760');
      detail(c, x + 6 + k * 2, y - 7, 3, 3, '#fff8e6aa');
    }
  },
  arcade(c, x, y, f, t) {
    drawCottageSprite(c, 'arcade', x + 1, y - 18, 14, 33);
    if (f?.active) detail(c, x + 6 + Math.floor(t * 5) % 4, y - 8, 1, 1, '#b3e8aa');
  },
  piano(c, x, y, f, t) {
    drawCottageSprite(c, 'piano', x, y - 14, 32, 29);
    if (f?.active) detail(c, x + 3 + Math.floor(t * 9) % 13 * 2, y + 2, 1, 2, '#f7cfa8');
  },
  bath(c, x, y, f, t) {
    drawCottageSprite(c, 'bath', x, y - 9, 32, 24);
    if (f?.occ) {
      f.occ(0, x + 14, y + 4);
      drawCottageSprite(c, 'bath', x, y - 9, 32, 24, .48);
    }
    if (f?.active) for (let i = 0; i < 4; i++) {
      detail(c, x + 5 + i * 5, y + 1 - Math.floor(t * 4 + i) % 4, 1, 1, '#f9ffff');
    }
  },
  plant(c, x, y, f, t) {
    drawCottageSprite(c, 'plant', x + 1, y - 16, 14, 30);
    if (f?.active) detail(c, x + 4 + Math.floor(t * 4) % 8, y + 2, .5, 1, '#b9e4dc');
  },
  lamp(c, x, y) {
    drawCottageSprite(c, 'lamp', x, y - 21, 16, 36);
  },
  catbed(c, x, y, f, t) {
    drawCottageSprite(c, 'catbed', x, y + 4, 16, 12);
    // 卷成一团的橘猫，尾巴会摇
    const tail = Math.round(Math.sin(t * (f && f.active ? 10 : 3)) * 1.5);
    box(c, x + 3, y + 3, 10, 7, '#e1ad71'); box(c, x + 9, y + 1, 6, 6, '#e1ad71');
    R(c, x + 9, y, 2, 2, '#e1ad71'); R(c, x + 13, y, 2, 2, '#e1ad71');
    R(c, x + 11, y + 3, 1, 1, INK); R(c, x + 13, y + 3, 1, 1, INK);
    R(c, x + 2 + tail, y + 6, 2, 4, '#d88a34');
    R(c, x + 5, y + 5, 3, 1, '#d88a34');
  },
  rug(c, x, y) {
    drawCottageSprite(c, 'rug', x, y + 1, 48, 28);
  },
  rug2(c, x, y) {
    box(c, x + 1, y + 1, 30, 30, '#f6ead6');
    for (let i = 0; i < 5; i++) R(c, x + 2, y + 4 + i * 6, 28, 3, ['#7e9fbd', '#efd189', '#88ab83', '#ca8290', '#9582b1'][i]);
    for (let i = 0; i < 7; i++) { R(c, x + 3 + i * 4, y - 1, 1, 2, '#cbbfae'); R(c, x + 3 + i * 4, y + 31, 1, 2, '#cbbfae'); }
  },
  door(c, x, y, f) {
    if (f?.openT > 0) {
      bevel(c, x + 1, y + 2, 14, 30, '#342831', WOOD_D);
      R(c, x + 4, y + 4, 8, 7, G.sky || '#a5ccdc');
      drawCottageSprite(c, 'door', x, y, 6, 33);
    } else {
      drawCottageSprite(c, 'door', x, y, 16, 33);
    }
    R(c, x + 1, y + 33, 14, 2, '#be816e');
  },
  window(c, x, y) {
    R(c, x + 6, y + 5, 20, 21, G.sky || '#a5ccdc');
    if (G.night) {
      R(c, x + 18, y + 8, 3, 3, '#fff5c7');
      detail(c, x + 10, y + 15, .5, .5, '#fff');
    } else {
      R(c, x + 8, y + 9, 6, 2, '#fff2db');
      R(c, x + 10, y + 8, 4, 1, '#fff2db');
      R(c, x + 18, y + 18, 8, 1, '#f8eedf');
    }
    if (typeof drawWindowWeather === 'function') drawWindowWeather(c, x + 7, y + 6, 18, 19);
    drawCottageSprite(c, 'window', x, y + 1, 32, 28);
  },
  painting(c, x, y) {
    box(c, x + 1, y + 2, 14, 12, '#d9a640');
    R(c, x + 3, y + 4, 10, 8, '#a5ccdc'); R(c, x + 3, y + 9, 10, 3, '#88ab83');
    R(c, x + 5, y + 7, 3, 3, '#5fae5a'); R(c, x + 10, y + 5, 2, 2, '#fff6a0');
  },
  clock(c, x, y) {
    R(c, x + 4, y + 2, 8, 12, INK); R(c, x + 2, y + 4, 12, 8, INK);
    R(c, x + 5, y + 3, 6, 10, '#fffaf0'); R(c, x + 3, y + 5, 10, 6, '#fffaf0');
    const m = G.time % 60, h = (G.time / 60) % 12;
    const ang = (v, n) => v / n * Math.PI * 2 - Math.PI / 2;
    const hx = Math.round(Math.cos(ang(h, 12)) * 2), hy = Math.round(Math.sin(ang(h, 12)) * 2);
    const mx = Math.round(Math.cos(ang(m, 60)) * 3), my = Math.round(Math.sin(ang(m, 60)) * 3);
    R(c, x + 8 + hx, y + 8 + hy, 1, 1, INK); R(c, x + 8 + Math.round(hx / 2), y + 8 + Math.round(hy / 2), 1, 1, INK);
    R(c, x + 8 + mx, y + 8 + my, 1, 1, '#ca8290'); R(c, x + 8 + Math.round(mx * 2 / 3), y + 8 + Math.round(my * 2 / 3), 1, 1, '#ca8290');
    R(c, x + 8, y + 8, 1, 1, INK);
  },
  poster(c, x, y) {
    box(c, x + 2, y + 3, 12, 24, '#3d3a66');
    R(c, x + 7, y + 8, 2, 6, '#efd189'); R(c, x + 5, y + 10, 6, 2, '#efd189'); R(c, x + 6, y + 9, 4, 4, '#efd189');
    R(c, x + 4, y + 18, 8, 1, '#ca8290'); R(c, x + 5, y + 21, 6, 1, '#ffffff'); R(c, x + 5, y + 23, 4, 1, '#ffffff');
    R(c, x + 7, y + 2, 2, 2, '#ca8290');
  },
};

// 家具在 y 方向的视觉顶部（用于选中高亮、图标裁切）
const TALL = { sofa: 10, chair: 9, table: 6, fridge: 18, stove: 12, shelf: 22, tv: 17, arcade: 18, piano: 14, bath: 9, plant: 18, lamp: 21, catbed: 0 };

// 把一件家具画成调色板里的小图标
function furnitureIcon(id, size = 56, props = {}) {
  const d = FURNITURE[id], top = d.layer ? 0 : (TALL[id] || 0);
  const pw = d.w * T, ph = d.h * T + top;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * PIXEL_SCALE;
  cv.style.width = cv.style.height = size + 'px';
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas');
  tmp.width = pw * PIXEL_SCALE;
  tmp.height = ph * PIXEL_SCALE;
  const tc = tmp.getContext('2d');
  tc.scale(PIXEL_SCALE, PIXEL_SCALE);
  DRAW[id](tc, 0, top, { color: null, ...props }, 0);
  const s = Math.min(size / pw, size / ph);
  const scale = s >= 1 ? Math.floor(s) : s;
  const w = Math.round(pw * PIXEL_SCALE * scale), h = Math.round(ph * PIXEL_SCALE * scale);
  c.drawImage(tmp, Math.floor((cv.width - w) / 2), Math.floor((cv.height - h) / 2), w, h);
  return cv;
}

function swatchIcon(spec, isWall, size = 56) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const c = cv.getContext('2d');
  c.save(); c.translate(0, isWall ? 0 : -(WALL_ROWS * T + 1));
  isWall ? drawWall(c, spec) : drawFloor(c, spec);
  c.restore();
  cv.style.width = cv.style.height = size + 'px';
  return cv;
}
