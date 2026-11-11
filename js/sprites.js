// 全部像素图都在这里用 fillRect 现场画出来，没有任何图片文件
const INK = '#3b2a2f';

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
function drawWall(c, wall) {
  const h = WALL_ROWS * T;
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

function drawFloor(c, floor) {
  const y0 = WALL_ROWS * T + 1, h = H - y0;
  R(c, 0, y0, W, h, floor.base);
  const a = floor.alt;
  if (floor.pat === 'plank') for (let y = y0; y < H; y += 6) { R(c, 0, y + 5, W, 1, a); for (let x = (rnd(y) * 30) | 0; x < W; x += 30) R(c, x, y, 1, 5, a); }
  if (floor.pat === 'check') for (let y = y0; y < H; y += 8) for (let x = ((y - y0) / 8 % 2) * 8; x < W; x += 16) R(c, x, y, 8, 8, a);
  if (floor.pat === 'tile') for (let y = y0; y < H; y += 16) for (let x = 0; x < W; x += 16) { R(c, x, y, 16, 1, a); R(c, x, y, 1, 16, a); R(c, x + 2, y + 2, 2, 1, '#ffffff55'); }
  if (floor.pat === 'carpet') for (let i = 0; i < 260; i++) R(c, rnd(i) * W, y0 + rnd(i + 999) * h, 1, 1, a);
  if (floor.pat === 'grass') for (let i = 0; i < 200; i++) { const x = rnd(i) * W, y = y0 + rnd(i + 7) * h; R(c, x, y, 1, 2, a); if (i % 23 === 0) R(c, x, y, 2, 2, i % 2 ? '#fff6a0' : '#f6b0c8'); }
  // 墙脚阴影
  R(c, 0, y0, W, 2, 'rgba(0,0,0,.12)');
}

/* ---------------- 家具 ----------------
   每个函数参数：(c, px, py, f, t)，px/py 是占地格子左上角像素，
   高家具会往上画超出占地格；f 是家具实例（f.active 表示有人在用，f.occ 是躺/坐上去的小人回调） */
const WOOD = '#b0743f', WOOD_L = '#c98d55', WOOD_D = '#8a5530';

const DRAW = {
  bed(c, x, y, f) {
    box(c, x, y - 8, 32, 12, WOOD);                 // 床头板
    R(c, x + 3, y - 6, 26, 2, WOOD_L);
    box(c, x + 1, y + 2, 30, 28, '#fff6ea');         // 床垫
    box(c, x + 6, y + 4, 20, 8, '#ffffff', '#cbbfae'); // 枕头
    if (f && f.occ) f.occ(x + 16, y + 11);
    const bl = f && f.color || '#e26d7d';
    box(c, x + 1, y + 13, 30, 17, bl);              // 被子
    R(c, x + 2, y + 14, 28, 2, shade(bl, 0.15));
    for (let i = 0; i < 4; i++) R(c, x + 5 + i * 7, y + 20, 3, 3, shade(bl, -0.12));
    R(c, x, y + 29, 3, 3, WOOD_D); R(c, x + 29, y + 29, 3, 3, WOOD_D);
  },
  sofa(c, x, y) {
    const col = '#5bb8b0', l = shade(col, 0.12), d = shade(col, -0.18);
    box(c, x + 2, y - 8, 28, 13, col); R(c, x + 3, y - 7, 26, 2, l);
    box(c, x + 3, y + 1, 26, 11, l); R(c, x + 16, y + 2, 1, 9, d);
    box(c, x, y - 3, 6, 16, d); box(c, x + 26, y - 3, 6, 16, d);
    R(c, x + 2, y + 13, 2, 3, INK); R(c, x + 28, y + 13, 2, 3, INK);
  },
  chair(c, x, y) {
    box(c, x + 3, y - 9, 10, 12, WOOD); R(c, x + 5, y - 7, 6, 1, WOOD_L); R(c, x + 5, y - 4, 6, 1, WOOD_L);
    box(c, x + 2, y + 2, 12, 6, WOOD_L);
    R(c, x + 3, y + 8, 2, 7, WOOD_D); R(c, x + 11, y + 8, 2, 7, WOOD_D);
  },
  table(c, x, y) {
    R(c, x + 2, y + 6, 2, 9, WOOD_D); R(c, x + 28, y + 6, 2, 9, WOOD_D);
    box(c, x, y - 4, 32, 11, WOOD); R(c, x + 1, y - 3, 30, 6, WOOD_L); R(c, x + 1, y + 3, 30, 1, WOOD_D);
    box(c, x + 6, y - 3, 8, 5, '#ffffff', '#cbbfae'); R(c, x + 8, y - 2, 4, 2, '#f0a64a'); // 盘子和煎蛋
    box(c, x + 21, y - 6, 5, 7, '#e26d7d'); R(c, x + 26, y - 4, 1, 3, INK);             // 杯子
  },
  fridge(c, x, y) {
    box(c, x + 1, y - 18, 14, 33, '#e8eef2'); R(c, x + 2, y - 7, 12, 1, '#a9b6c0');
    R(c, x + 11, y - 15, 2, 5, '#a9b6c0'); R(c, x + 11, y - 4, 2, 7, '#a9b6c0');
    R(c, x + 4, y - 15, 3, 3, '#e26d7d'); R(c, x + 5, y - 2, 3, 2, '#f2d16b'); // 冰箱贴
  },
  stove(c, x, y, f, t) {
    box(c, x + 1, y - 6, 14, 21, '#d8d0c4'); R(c, x + 2, y - 5, 12, 3, '#3b3a4a');
    R(c, x + 3, y - 4, 3, 1, '#666'); R(c, x + 10, y - 4, 3, 1, '#666');
    box(c, x + 3, y + 1, 10, 7, '#3b3a4a', '#8a8278'); R(c, x + 4, y + 2, 8, 2, '#5b5a6a');
    R(c, x + 3, y + 10, 2, 2, '#e26d7d'); R(c, x + 7, y + 10, 2, 2, '#e26d7d');
    if (f && f.active) {
      const k = Math.floor(t * 8) % 2;
      R(c, x + 3, y - 7, 4, 2, k ? '#f2d16b' : '#f0a64a');
      box(c, x + 8, y - 9, 7, 4, '#5b5a6a'); R(c, x + 14, y - 8, 3, 1, INK);
      R(c, x + 10 + k, y - 12 - k, 1, 2, '#ffffffaa');
    }
  },
  shelf(c, x, y) {
    box(c, x, y - 22, 32, 37, WOOD_D);
    for (let r = 0; r < 3; r++) {
      const sy = y - 20 + r * 11;
      R(c, x + 2, sy, 28, 9, '#5e3a22');
      let bx = x + 3;
      for (let i = 0; bx < x + 28; i++) {
        const bw = 2 + ((rnd(r * 20 + i) * 3) | 0), bh = 6 + ((rnd(r * 9 + i + 3) * 3) | 0);
        R(c, bx, sy + 9 - bh, bw, bh, ['#e26d7d', '#6aa9ec', '#f2d16b', '#7cc576', '#8a7fe0', '#f0a64a'][(rnd(i + r * 7) * 6) | 0]);
        bx += bw + 1;
      }
      R(c, x + 1, sy + 9, 30, 2, WOOD);
    }
  },
  tv(c, x, y, f, t) {
    box(c, x, y, 32, 15, WOOD); R(c, x + 2, y + 4, 13, 8, WOOD_D); R(c, x + 17, y + 4, 13, 8, WOOD_D);
    R(c, x + 15, y - 2, 2, 3, INK);
    box(c, x + 3, y - 17, 26, 16, '#3b3a4a', INK);
    if (f && f.active) {
      const cols = ['#6aa9ec', '#7cc576', '#f2d16b', '#e26d7d'];
      const k = Math.floor(t * 1.5) % 4;
      R(c, x + 5, y - 15, 22, 12, cols[k]); R(c, x + 8, y - 10, 6, 5, shade(cols[(k + 1) % 4], -0.1));
      R(c, x + 17, y - 13, 7, 3, '#ffffff99');
    } else { R(c, x + 5, y - 15, 22, 12, '#4c5a68'); R(c, x + 6, y - 14, 4, 1, '#ffffff44'); }
  },
  arcade(c, x, y, f, t) {
    box(c, x + 1, y - 18, 14, 33, '#8a7fe0'); R(c, x + 2, y - 17, 12, 3, '#f2d16b');
    box(c, x + 3, y - 13, 10, 9, '#1d1b2a');
    if (f && f.active) { const k = Math.floor(t * 6) % 3; R(c, x + 5 + k * 2, y - 10, 2, 2, '#7cc576'); R(c, x + 9 - k, y - 7, 2, 1, '#e26d7d'); }
    else R(c, x + 6, y - 9, 4, 1, '#7cc576');
    R(c, x + 2, y - 3, 12, 4, shade('#8a7fe0', -0.2)); R(c, x + 5, y - 5, 1, 3, INK); R(c, x + 4, y - 6, 3, 2, '#e26d7d');
    R(c, x + 9, y - 3, 2, 2, '#6aa9ec'); R(c, x + 12, y - 3, 1, 2, '#f2d16b');
  },
  piano(c, x, y) {
    box(c, x, y - 14, 32, 29, '#2e2530'); R(c, x + 2, y - 12, 28, 6, '#4a3a48');
    R(c, x + 1, y + 1, 30, 5, '#ffffff');
    for (let i = 0; i < 10; i++) { R(c, x + 3 + i * 3, y + 1, 1, 5, '#cbbfae'); if (i % 7 !== 2 && i % 7 !== 6) R(c, x + 4 + i * 3, y + 1, 2, 3, INK); }
    R(c, x + 12, y - 11, 8, 4, '#f6ead6'); // 琴谱
    R(c, x + 2, y + 12, 3, 3, INK); R(c, x + 27, y + 12, 3, 3, INK);
  },
  bath(c, x, y, f) {
    box(c, x, y - 4, 32, 18, '#ffffff', '#7a8a96'); R(c, x + 2, y - 2, 28, 6, '#9fd8f0');
    R(c, x + 28, y - 9, 2, 6, '#a9b6c0'); R(c, x + 25, y - 9, 4, 2, '#a9b6c0');
    if (f && f.occ) f.occ(x + 14, y + 2);
    R(c, x + 1, y + 3, 30, 10, '#ffffff'); R(c, x + 1, y + 3, 30, 1, '#dbe6ec');
    if (f && f.active) for (let i = 0; i < 5; i++) { R(c, x + 4 + i * 5, y + 1 - (i % 2), 4, 3, '#ffffff'); R(c, x + 5 + i * 5, y + 1 - (i % 2), 2, 1, '#cfeaf7'); }
    R(c, x + 2, y + 13, 3, 3, '#a9b6c0'); R(c, x + 27, y + 13, 3, 3, '#a9b6c0');
  },
  plant(c, x, y, f, t) {
    const sway = f && f.active ? Math.round(Math.sin(t * 6)) : 0;
    const g = '#5fae5a', gl = '#8ccf7a';
    R(c, x + 6, y - 6, 4, 8, '#3f7d3c');
    box(c, x + 1 + sway, y - 14, 8, 8, g); box(c, x + 7 + sway, y - 12, 8, 8, g); box(c, x + 4 + sway, y - 18, 8, 8, gl);
    R(c, x + 6 + sway, y - 16, 2, 2, '#b4e6a0');
    box(c, x + 3, y + 2, 10, 12, '#c8735a'); R(c, x + 3, y + 2, 10, 3, '#a85c48');
  },
  lamp(c, x, y) {
    R(c, x + 7, y - 12, 2, 24, '#6b5a52');
    box(c, x + 4, y + 11, 8, 4, '#6b5a52');
    R(c, x + 2, y - 20, 12, 9, INK); R(c, x + 4, y - 21, 8, 1, INK);
    R(c, x + 3, y - 19, 10, 7, '#f6d98a'); R(c, x + 5, y - 20, 6, 1, '#f6d98a'); R(c, x + 3, y - 13, 10, 1, '#e0b860');
  },
  catbed(c, x, y, f, t) {
    box(c, x, y + 4, 16, 11, '#e27fa6'); R(c, x + 2, y + 6, 12, 6, '#f6c1d4');
    // 卷成一团的橘猫，尾巴会摇
    const tail = Math.round(Math.sin(t * (f && f.active ? 10 : 3)) * 1.5);
    box(c, x + 3, y + 3, 10, 7, '#f0a64a'); box(c, x + 9, y + 1, 6, 6, '#f0a64a');
    R(c, x + 9, y, 2, 2, '#f0a64a'); R(c, x + 13, y, 2, 2, '#f0a64a');
    R(c, x + 11, y + 3, 1, 1, INK); R(c, x + 13, y + 3, 1, 1, INK);
    R(c, x + 2 + tail, y + 6, 2, 4, '#d88a34');
    R(c, x + 5, y + 5, 3, 1, '#d88a34');
  },
  rug(c, x, y) {
    const col = '#e8a0b4';
    R(c, x + 4, y + 1, 40, 30, INK); R(c, x + 1, y + 4, 46, 24, INK);
    R(c, x + 5, y + 2, 38, 28, col); R(c, x + 2, y + 5, 44, 22, col);
    R(c, x + 8, y + 6, 32, 20, '#f6c8d4'); R(c, x + 6, y + 8, 36, 16, '#f6c8d4');
    R(c, x + 14, y + 11, 20, 10, col);
  },
  rug2(c, x, y) {
    box(c, x + 1, y + 1, 30, 30, '#f6ead6');
    for (let i = 0; i < 5; i++) R(c, x + 2, y + 4 + i * 6, 28, 3, ['#6aa9ec', '#f2d16b', '#7cc576', '#e26d7d', '#8a7fe0'][i]);
    for (let i = 0; i < 7; i++) { R(c, x + 3 + i * 4, y - 1, 1, 2, '#cbbfae'); R(c, x + 3 + i * 4, y + 31, 1, 2, '#cbbfae'); }
  },
  window(c, x, y) {
    box(c, x + 2, y + 4, 28, 24, '#ffffff');
    R(c, x + 4, y + 6, 24, 20, G.sky || '#9fd3f0');
    if (G.night) { R(c, x + 21, y + 9, 4, 4, '#fff6c8'); R(c, x + 22, y + 9, 3, 1, G.sky); R(c, x + 8, y + 10, 1, 1, '#fff'); R(c, x + 13, y + 18, 1, 1, '#fff'); }
    else { R(c, x + 7, y + 11, 8, 2, '#ffffff'); R(c, x + 9, y + 10, 4, 1, '#ffffff'); R(c, x + 19, y + 17, 6, 2, '#ffffffcc'); }
    R(c, x + 15, y + 5, 2, 22, '#ffffff'); R(c, x + 3, y + 15, 26, 2, '#ffffff');
    R(c, x, y + 1, 32, 3, WOOD_D);                            // 窗帘杆
    R(c, x + 1, y + 3, 5, 24, '#e26d7d'); R(c, x + 26, y + 3, 5, 24, '#e26d7d');
    R(c, x + 3, y + 3, 1, 24, '#c95a6a'); R(c, x + 28, y + 3, 1, 24, '#c95a6a');
    R(c, x + 2, y + 28, 28, 2, WOOD_L);
  },
  painting(c, x, y) {
    box(c, x + 1, y + 2, 14, 12, '#d9a640');
    R(c, x + 3, y + 4, 10, 8, '#9fd3f0'); R(c, x + 3, y + 9, 10, 3, '#7cc576');
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
    R(c, x + 8 + mx, y + 8 + my, 1, 1, '#e26d7d'); R(c, x + 8 + Math.round(mx * 2 / 3), y + 8 + Math.round(my * 2 / 3), 1, 1, '#e26d7d');
    R(c, x + 8, y + 8, 1, 1, INK);
  },
  poster(c, x, y) {
    box(c, x + 2, y + 3, 12, 24, '#3d3a66');
    R(c, x + 7, y + 8, 2, 6, '#f2d16b'); R(c, x + 5, y + 10, 6, 2, '#f2d16b'); R(c, x + 6, y + 9, 4, 4, '#f2d16b');
    R(c, x + 4, y + 18, 8, 1, '#e26d7d'); R(c, x + 5, y + 21, 6, 1, '#ffffff'); R(c, x + 5, y + 23, 4, 1, '#ffffff');
    R(c, x + 7, y + 2, 2, 2, '#e26d7d');
  },
};

// 家具在 y 方向的视觉顶部（用于选中高亮、图标裁切）
const TALL = { bed: 8, sofa: 8, chair: 9, table: 6, fridge: 18, stove: 12, shelf: 22, tv: 17, arcade: 18, piano: 14, bath: 9, plant: 18, lamp: 21, catbed: 0 };

// 把一件家具画成调色板里的小图标
function furnitureIcon(id, size = 56) {
  const d = FURNITURE[id], top = d.layer ? 0 : (TALL[id] || 0);
  const pw = d.w * T, ph = d.h * T + top;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const tmp = document.createElement('canvas'); tmp.width = pw; tmp.height = ph;
  const tc = tmp.getContext('2d');
  DRAW[id](tc, 0, top, { color: null }, 0);
  const s = Math.max(1, Math.floor(Math.min(size / pw, size / ph)));
  c.drawImage(tmp, (size - pw * s) / 2 | 0, (size - ph * s) / 2 | 0, pw * s, ph * s);
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
