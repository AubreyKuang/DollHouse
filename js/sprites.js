// 道具保持逻辑格尺寸，细节贴图由 Canvas 与动画合成。
const INK = '#493743';
const PIXEL_SCALE = 2;

const cottageAtlas = document.getElementById('cottageAtlas');
const COTTAGE_SPRITES = {
  bigbed: [0, 0, 120, 96], sofa: [128, 0, 128, 76], piano: [256, 0, 112, 99],
  shelf: [0, 128, 78, 112], window: [128, 128, 124, 105], oak: [256, 128, 128, 128],
  desk: [0, 256, 112, 90], arcade: [128, 256, 74, 112], plant: [256, 256, 82, 112],
  toilet: [0, 384, 88, 100], washstand: [128, 384, 78, 112], shower: [256, 384, 62, 112],
};
const cottageArtReady = () => Boolean(cottageAtlas?.complete && cottageAtlas.naturalWidth);

function drawCottageSprite(c, id, x, y, w, h) {
  if (!cottageArtReady()) return false;
  c.save();
  c.imageSmoothingEnabled = true;
  c.drawImage(cottageAtlas, ...COTTAGE_SPRITES[id], x, y, w, h);
  c.restore();
  return true;
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

function drawBed(c, x, y, f, double, linen = double ? '#cf849a' : '#9e92b6') {
  const w = double ? 48 : 32;
  if (double && cottageArtReady()) {
    contactShadow(c, x + 1, y + 30, 46);
    drawCottageSprite(c, 'bigbed', x + 1, y - 1, 46, 33);
    if (f?.occ) {
      for (const [slot, center] of [13, 35].entries()) f.occ(slot, x + center, y + 18);
      const [sx, sy, sw, sh] = COTTAGE_SPRITES.bigbed, quiltStart = 47;
      c.save();
      c.imageSmoothingEnabled = true;
      c.drawImage(cottageAtlas, sx, sy + quiltStart, sw, sh - quiltStart,
        x + 1, y - 1 + 33 * quiltStart / sh, 46, 33 * (sh - quiltStart) / sh);
      c.restore();
    }
    return;
  }
  const edge = '#623f46', walnut = '#a06d58', honey = '#d9a386';
  const hi = shade(linen, .13), dark = shade(linen, -.15);
  contactShadow(c, x + 1, y + 30, w - 2);
  bevel(c, x + 2, y + 3, w - 4, 26, walnut, edge);
  bevel(c, x + 6, y + 5, w - 12, 11, '#b48369', edge);
  R(c, x + 8, y + 6, w - 16, 1, honey);
  for (const post of [x + 2, x + w - 6]) {
    bevel(c, post, y + 2, 4, 30, walnut, edge);
    R(c, post + 1, y + 3, 2, 2, honey);
  }
  bevel(c, x + 3, y + 12, w - 6, 17, '#fff1dc', '#ab7c78');
  for (const [slot, center] of (double ? [13, 35] : [16]).entries()) {
    bevel(c, x + center - 8, y + 13, 16, 7, '#fbe5d5', '#b78c87');
    R(c, x + center - 6, y + 14, 11, 2, '#fff4e6');
    detail(c, x + center - 6, y + 18, 11, .5, '#d7afa0');
    f?.occ?.(slot, x + center, y + 19);
  }
  bevel(c, x + 2, y + 20, w - 4, 10, linen, dark);
  R(c, x + 4, y + 21, w - 8, 1, hi);
  for (let row = 0; row < 6; row++) {
    for (let px = 4; px < w - 4; px++) {
      const phase = (px + row) % 8, opposite = (px - row + 8) % 8;
      if (phase === 0 || opposite === 0) R(c, x + px, y + 22 + row, 1, 1, dark);
      else if (phase === 1 || opposite === 7) detail(c, x + px, y + 22 + row, .5, .5, hi);
    }
  }
  R(c, x + 4, y + 29, w - 8, 1, dark);
  R(c, x + 4, y + 30, w - 8, 1, honey);
}

const DRAW = {
  bed(c, x, y, f) { drawBed(c, x, y, f, false); },
  bigbed(c, x, y, f) { drawBed(c, x, y, f, true); },
  sofa(c, x, y) {
    if (drawCottageSprite(c, 'sofa', x, y - 7, 32, 22)) {
      contactShadow(c, x + 2, y + 15, 28);
      return;
    }
    const edge = '#46615d', body = '#6b9e91', shadow = '#507e72', light = '#bad2bc';
    contactShadow(c, x, y + 14, 32);
    for (const foot of [x + 4, x + 26]) {
      R(c, foot, y + 11, 3, 4, WOOD_D);
      detail(c, foot, y + 13, 2, .5, WOOD_L);
    }
    R(c, x + 7, y - 10, 18, 15, edge);
    bevel(c, x + 4, y - 9, 24, 15, body, edge);
    bevel(c, x + 6, y - 8, 20, 11, '#8db4a4', shadow);
    R(c, x + 8, y - 7, 16, 1, light);
    detail(c, x + 15.5, y - 6, .5, 6, shadow);
    bevel(c, x + 3, y + 2, 26, 11, shadow, edge);
    for (const seat of [x + 6, x + 16]) {
      bevel(c, seat, y + 1, 10, 7, '#a8c5b3', shadow);
      detail(c, seat + 2, y + 2, 6, .5, '#d4dfc6');
      R(c, seat + 1, y + 6, 8, 1, body);
    }
    for (const arm of [x, x + 25]) {
      bevel(c, arm + 1, y, 5, 11, body, edge);
      bevel(c, arm, y - 3, 7, 8, body, edge);
      bevel(c, arm + 1, y - 2, 5, 6, light, shadow);
      detail(c, arm + 2, y - .5, 3, 2.5, shadow);
      detail(c, arm + 2.5, y, 2, .5, '#d4dfc6');
      detail(c, arm + 3.5, y + .5, .5, 1, body);
    }
    R(c, x + 6, y + 9, 20, 1, body);
  },
  chair(c, x, y) {
    box(c, x + 3, y - 9, 10, 12, WOOD); R(c, x + 5, y - 7, 6, 1, WOOD_L); R(c, x + 5, y - 4, 6, 1, WOOD_L);
    box(c, x + 2, y + 2, 12, 6, WOOD_L);
    R(c, x + 3, y + 8, 2, 7, WOOD_D); R(c, x + 11, y + 8, 2, 7, WOOD_D);
  },
  table(c, x, y) {
    contactShadow(c, x + 1, y + 14, 30);
    for (const px of [x + 3, x + 27]) {
      R(c, px, y + 5, 2, 10, WOOD_D);
      detail(c, px, y + 6, .5, 8, WOOD_L);
    }
    bevel(c, x, y - 4, 32, 11, WOOD, WOOD_D);
    R(c, x + 2, y - 3, 28, 6, WOOD_L);
    detail(c, x + 2, y + 3, 28, .5, '#efc396');
    detail(c, x + 3, y - 2.5, 26, .5, '#b98a68');
    bevel(c, x + 6, y - 3, 8, 5, '#fff4de', '#c4a78e');
    R(c, x + 8, y - 2, 4, 2, '#e7ae69');
    bevel(c, x + 21, y - 6, 5, 7, '#ce8d93', '#9b6673');
    detail(c, x + 26, y - 4.5, 1.5, 2.5, '#9b6673');
    detail(c, x + 22, y - 5, 2, .5, '#f0bcab');
  },
  fridge(c, x, y) {
    contactShadow(c, x + 1, y + 14, 14);
    bevel(c, x + 1, y - 18, 14, 33, '#eae8df', '#8e7d83');
    R(c, x + 3, y - 17, 9, 1, '#fffbec');
    R(c, x + 12, y - 16, 2, 29, '#cfc3c2');
    R(c, x + 2, y - 7, 12, 1, '#ad9ea1');
    for (const [py, h] of [[y - 15, 5], [y - 4, 7]]) {
      detail(c, x + 10.5, py, 1.5, h, '#a49598');
      detail(c, x + 10.5, py, .5, h - 1, '#f9efdf');
    }
    R(c, x + 4, y - 15, 3, 3, '#ca8290');
    detail(c, x + 4, y - 15, 2, .5, '#f3b5ad');
    R(c, x + 5, y - 2, 3, 2, '#efd189');
  },
  stove(c, x, y, f, t) {
    box(c, x + 1, y - 6, 14, 21, '#d8d0c4'); R(c, x + 2, y - 5, 12, 3, '#4e4557');
    R(c, x + 3, y - 4, 3, 1, '#666'); R(c, x + 10, y - 4, 3, 1, '#666');
    box(c, x + 3, y + 1, 10, 7, '#4e4557', '#8a8278'); R(c, x + 4, y + 2, 8, 2, '#675a6e');
    R(c, x + 3, y + 10, 2, 2, '#ca8290'); R(c, x + 7, y + 10, 2, 2, '#ca8290');
    if (f && f.active) {
      const k = Math.floor(t * 8) % 2;
      R(c, x + 3, y - 7, 4, 2, k ? '#efd189' : '#e1ad71');
      box(c, x + 8, y - 9, 7, 4, '#675a6e'); R(c, x + 14, y - 8, 3, 1, INK);
      R(c, x + 10 + k, y - 12 - k, 1, 2, '#ffffffaa');
    }
  },
  shelf(c, x, y) {
    if (drawCottageSprite(c, 'shelf', x + 2, y - 22, 28, 37)) return;
    const covers = ['#b97482', '#7899aa', '#dcb278', '#81a48b', '#9583aa', '#c28867'];
    contactShadow(c, x + 1, y + 14, 30);
    bevel(c, x, y - 22, 32, 37, WOOD, WOOD_D);
    R(c, x + 2, y - 21, 28, 1, WOOD_L);
    for (let row = 0; row < 3; row++) {
      const sy = y - 20 + row * 11;
      R(c, x + 2, sy, 28, 9, '#61454b');
      let bx = x + 3;
      for (let i = 0; bx < x + 28; i++) {
        const bw = Math.min(x + 29 - bx, 2 + Math.floor(rnd(row * 20 + i) * 3));
        const bh = 5 + Math.floor(rnd(row * 9 + i + 3) * 4);
        const color = covers[Math.floor(rnd(i + row * 7) * covers.length)];
        R(c, bx, sy + 9 - bh, bw, bh, color);
        detail(c, bx, sy + 9 - bh, .5, bh, shade(color, .15));
        detail(c, bx + .5, sy + 11 - bh, bw - 1, .5, shade(color, .12));
        bx += bw + 1;
      }
      R(c, x + 1, sy + 9, 30, 2, WOOD);
      R(c, x + 2, sy + 9, 28, 1, WOOD_L);
    }
    detail(c, x + 1, y - 19, .5, 32, WOOD_L);
    detail(c, x + 30, y - 19, .5, 32, '#96634f');
  },
  tv(c, x, y, f, t) {
    box(c, x, y, 32, 15, WOOD); R(c, x + 2, y + 4, 13, 8, WOOD_D); R(c, x + 17, y + 4, 13, 8, WOOD_D);
    R(c, x + 15, y - 2, 2, 3, INK);
    box(c, x + 3, y - 17, 26, 16, '#4e4557', INK);
    if (f && f.active) {
      const cols = ['#7e9fbd', '#88ab83', '#efd189', '#ca8290'];
      const k = Math.floor(t * 1.5) % 4;
      R(c, x + 5, y - 15, 22, 12, cols[k]); R(c, x + 8, y - 10, 6, 5, shade(cols[(k + 1) % 4], -0.1));
      R(c, x + 17, y - 13, 7, 3, '#ffffff99');
    } else { R(c, x + 5, y - 15, 22, 12, '#4c5a68'); R(c, x + 6, y - 14, 4, 1, '#ffffff44'); }
  },
  arcade(c, x, y, f, t) {
    if (drawCottageSprite(c, 'arcade', x + 1, y - 18, 14, 33)) {
      if (f?.active) detail(c, x + 6 + Math.floor(t * 5) % 4, y - 8, 1, 1, '#b3e8aa');
      return;
    }
    box(c, x + 1, y - 18, 14, 33, '#9582b1'); R(c, x + 2, y - 17, 12, 3, '#efd189');
    box(c, x + 3, y - 13, 10, 9, '#1d1b2a');
    if (f && f.active) { const k = Math.floor(t * 6) % 3; R(c, x + 5 + k * 2, y - 10, 2, 2, '#88ab83'); R(c, x + 9 - k, y - 7, 2, 1, '#ca8290'); }
    else R(c, x + 6, y - 9, 4, 1, '#88ab83');
    R(c, x + 2, y - 3, 12, 4, shade('#9582b1', -0.2)); R(c, x + 5, y - 5, 1, 3, INK); R(c, x + 4, y - 6, 3, 2, '#ca8290');
    R(c, x + 9, y - 3, 2, 2, '#7e9fbd'); R(c, x + 12, y - 3, 1, 2, '#efd189');
  },
  piano(c, x, y, f, t) {
    if (drawCottageSprite(c, 'piano', x, y - 14, 32, 29)) {
      if (f?.active) detail(c, x + 3 + Math.floor(t * 9) % 13 * 2, y + 2, 1, 2, '#f7cfa8');
      return;
    }
    const edge = '#493441', walnut = '#725057', glint = '#a97a72';
    contactShadow(c, x + 1, y + 14, 30);
    bevel(c, x, y - 14, 32, 29, walnut, edge);
    R(c, x + 2, y - 13, 28, 2, glint);
    bevel(c, x + 2, y - 10, 28, 10, '#644650', edge);
    detail(c, x + 4, y - 8, 24, .5, glint);
    bevel(c, x + 12, y - 8, 8, 5, '#f6e7cd', '#ae927e');
    detail(c, x + 16, y - 7, .5, 3, '#d0b697');
    R(c, x + 1, y, 30, 6, edge);
    for (let i = 0; i < 14; i++) {
      const keyX = x + 2 + i * 2;
      const playing = f?.active && i === Math.floor(t * 9) % 14;
      detail(c, keyX, y + 1, 1.5, 3.5, playing ? '#f3bf96' : '#fff3df');
      if (i % 7 !== 2 && i % 7 !== 6) detail(c, keyX + 1, y + 1, 1, 2, '#54414c');
    }
    R(c, x + 4, y + 8, 24, 1, glint);
    for (let i = 0; i < 3; i++) {
      R(c, x + 13 + i * 2, y + 12, 1, 2, '#dbac70');
      detail(c, x + 13 + i * 2, y + 12, 1, .5, '#f8d28f');
    }
    R(c, x + 2, y + 12, 3, 3, edge); R(c, x + 27, y + 12, 3, 3, edge);
  },
  bath(c, x, y, f) {
    box(c, x, y - 4, 32, 18, '#ffffff', '#7a8a96'); R(c, x + 2, y - 2, 28, 6, '#9fd8f0');
    R(c, x + 28, y - 9, 2, 6, '#a9b6c0'); R(c, x + 25, y - 9, 4, 2, '#a9b6c0');
    if (f && f.occ) f.occ(0, x + 14, y + 2);
    R(c, x + 1, y + 3, 30, 10, '#ffffff'); R(c, x + 1, y + 3, 30, 1, '#dbe6ec');
    if (f && f.active) for (let i = 0; i < 5; i++) { R(c, x + 4 + i * 5, y + 1 - (i % 2), 4, 3, '#ffffff'); R(c, x + 5 + i * 5, y + 1 - (i % 2), 2, 1, '#cfeaf7'); }
    R(c, x + 2, y + 13, 3, 3, '#a9b6c0'); R(c, x + 27, y + 13, 3, 3, '#a9b6c0');
  },
  plant(c, x, y, f, t) {
    if (drawCottageSprite(c, 'plant', x + 1, y - 16, 14, 30)) {
      if (f?.active) detail(c, x + 4 + Math.floor(t * 4) % 8, y + 2, .5, 1, '#b9e4dc');
      return;
    }
    const sway = f?.active ? Math.round(Math.sin(t * 6)) : 0;
    const leaf = '#83aa80', edge = '#52765f', glint = '#a8c59a';
    contactShadow(c, x + 3, y + 13, 10);
    R(c, x + 7, y - 8, 2, 12, edge);
    for (const [dx, dy, w] of [[1, -14, 8], [7, -12, 8], [4, -18, 8]]) {
      bevel(c, x + dx + sway, y + dy, w, 8, leaf, edge);
      detail(c, x + dx + 1.5 + sway, y + dy + 1, w - 3, .5, glint);
      detail(c, x + dx + 2 + sway, y + dy + 2, .5, 3, glint);
    }
    bevel(c, x + 3, y + 2, 10, 12, '#be816e', '#825b59');
    R(c, x + 3, y + 2, 10, 3, '#a5665c');
    detail(c, x + 4, y + 3, 8, .5, '#e4a98a');
    detail(c, x + 5, y + 6, .5, 5, '#d69a80');
  },
  lamp(c, x, y) {
    const brass = '#a5795b', edge = '#74545b';
    contactShadow(c, x + 3, y + 14, 10);
    R(c, x + 7, y - 12, 2, 24, edge);
    detail(c, x + 7.5, y - 12, .5, 24, '#d9ae78');
    bevel(c, x + 4, y + 11, 8, 4, brass, edge);
    bevel(c, x + 2, y - 20, 12, 9, '#f0cc84', edge);
    R(c, x + 4, y - 19, 8, 1, '#fff0b7');
    for (const px of [5, 8, 11]) detail(c, x + px, y - 18, .5, 5, '#ffdfa2');
    R(c, x + 3, y - 13, 10, 1, '#d7a774');
  },
  catbed(c, x, y, f, t) {
    box(c, x, y + 4, 16, 11, '#e27fa6'); R(c, x + 2, y + 6, 12, 6, '#f6c1d4');
    // 卷成一团的橘猫，尾巴会摇
    const tail = Math.round(Math.sin(t * (f && f.active ? 10 : 3)) * 1.5);
    box(c, x + 3, y + 3, 10, 7, '#e1ad71'); box(c, x + 9, y + 1, 6, 6, '#e1ad71');
    R(c, x + 9, y, 2, 2, '#e1ad71'); R(c, x + 13, y, 2, 2, '#e1ad71');
    R(c, x + 11, y + 3, 1, 1, INK); R(c, x + 13, y + 3, 1, 1, INK);
    R(c, x + 2 + tail, y + 6, 2, 4, '#d88a34');
    R(c, x + 5, y + 5, 3, 1, '#d88a34');
  },
  rug(c, x, y) {
    bevel(c, x + 1, y + 2, 46, 28, '#cc929a', '#a56e7d');
    bevel(c, x + 4, y + 5, 40, 22, '#ebbbb5', '#f2d2c3');
    bevel(c, x + 8, y + 8, 32, 16, '#e0a7a4', '#c88791');
    for (const a of [14, 24, 34]) {
      for (let i = -3; i <= 3; i++) {
        const half = 4 - Math.abs(i);
        R(c, x + a - half, y + 16 + i, half * 2, 1, '#f3c9b6');
      }
      R(c, x + a - 1, y + 15, 2, 2, '#b97b86');
    }
    for (let i = 3; i < 30; i += 4) {
      detail(c, x, y + i, 2, .5, '#f0c9b6');
      detail(c, x + 46, y + i, 2, .5, '#f0c9b6');
    }
  },
  rug2(c, x, y) {
    box(c, x + 1, y + 1, 30, 30, '#f6ead6');
    for (let i = 0; i < 5; i++) R(c, x + 2, y + 4 + i * 6, 28, 3, ['#7e9fbd', '#efd189', '#88ab83', '#ca8290', '#9582b1'][i]);
    for (let i = 0; i < 7; i++) { R(c, x + 3 + i * 4, y - 1, 1, 2, '#cbbfae'); R(c, x + 3 + i * 4, y + 31, 1, 2, '#cbbfae'); }
  },
  door(c, x, y, f) {
    box(c, x + 1, y + 2, 14, 30, WOOD_D);
    if (f && f.openT > 0) {
      R(c, x + 2, y + 3, 12, 29, '#2a2230'); R(c, x + 2, y + 3, 12, 6, G.sky || '#a5ccdc');   // 打开时看到外面
      R(c, x + 2, y + 3, 3, 29, WOOD);                                                         // 往里开的门板
    } else {
      R(c, x + 2, y + 3, 12, 29, WOOD); R(c, x + 3, y + 4, 10, 1, WOOD_L);
      box(c, x + 4, y + 6, 8, 7, G.sky || '#a5ccdc', WOOD_D); R(c, x + 7, y + 6, 1, 7, WOOD_D);
      R(c, x + 4, y + 16, 8, 6, shade(WOOD, -0.08)); R(c, x + 4, y + 24, 8, 6, shade(WOOD, -0.08));
      R(c, x + 11, y + 19, 2, 2, '#e8ba75');
    }
    R(c, x, y + 33, 16, 3, '#be816e'); R(c, x + 1, y + 34, 14, 1, '#a85c48');                  // 门口地垫
  },
  window(c, x, y) {
    if (cottageArtReady()) {
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
      return;
    }
    const walnut = '#925f57', pine = '#bf8a65', cream = '#fff0d4';
    bevel(c, x + 2, y + 3, 28, 26, '#d5a183', walnut);
    bevel(c, x + 4, y + 5, 24, 22, cream, '#d3ab89');
    R(c, x + 6, y + 7, 20, 18, G.sky || '#a5ccdc');
    if (G.night) {
      R(c, x + 21, y + 9, 3, 3, '#fff6c8');
      R(c, x + 22, y + 9, 2, 1, G.sky);
      detail(c, x + 10, y + 10, .5, .5, '#fff');
      detail(c, x + 20, y + 19, .5, .5, '#fff');
    } else {
      R(c, x + 7, y + 11, 8, 2, '#fff3de');
      R(c, x + 9, y + 10, 4, 1, '#fff3de');
      R(c, x + 19, y + 17, 6, 2, '#fff3decc');
      detail(c, x + 7, y + 23, 18, .5, '#e6f4eb');
    }
    if (typeof drawWindowWeather === 'function') drawWindowWeather(c, x + 6, y + 7, 20, 18);
    detail(c, x + 15.5, y + 6, 1.5, 20, cream);
    detail(c, x + 6, y + 14, 20, 1.5, cream);
    detail(c, x + 16.5, y + 7, .5, 18, '#d0ac91');
    bevel(c, x, y + 1, 32, 3, pine, walnut);
    for (const [px, dir] of [[x + 2, 1], [x + 30, -1]]) {
      c.save();
      c.translate(px, y + 3);
      c.scale(dir, 1);
      bevel(c, -1, 0, 6, 13, '#ce8992', '#a65d72');
      bevel(c, -1, 11, 4, 13, '#ca7d8a', '#a65d72');
      detail(c, 0, 1, .5, 22, '#efafb0');
      detail(c, 2, 2, .5, 20, '#ab6379');
      detail(c, -.5, 11, 4, 1, '#f0ca97');
      R(c, 0, 22, 2, 1, '#e6a2a3');
      c.restore();
    }
    bevel(c, x + 1, y + 27, 30, 3, pine, walnut);
    detail(c, x + 3, y + 27, 26, .5, '#f4c6a0');
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
