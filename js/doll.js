// 小人像素绘制：12×20 的小人，头身比偏大，按层叠画出 腿→身体→手→头→头发→配饰

const DOLL_INK = '#3b2a2f';

function dollColors(L) {
  return {
    skin: OUTFIT.skin[L.skin] || OUTFIT.skin[0],
    hair: OUTFIT.hairColor[L.hairColor] || OUTFIT.hairColor[0],
    top: OUTFIT.clothColor[L.topColor] || OUTFIT.clothColor[0],
    bot: OUTFIT.clothColor[L.bottomColor] || OUTFIT.clothColor[0],
    shoe: OUTFIT.shoes[L.shoes] || OUTFIT.shoes[0],
  };
}

// 头发形状（相对小人左上角的矩形），会自动加一圈描边
const HAIR = {
  down: {
    base: [[1, 0, 10, 3], [1, 3, 1, 3], [10, 3, 1, 3]],
    short: [[2, 3, 3, 1], [7, 3, 2, 1]],
    long: [[2, 3, 3, 1], [7, 3, 2, 1], [0, 2, 2, 11], [10, 2, 2, 11]],
    twin: [[2, 3, 3, 1], [7, 3, 2, 1], [-2, 3, 3, 7], [11, 3, 3, 7]],
    bun: [[2, 3, 3, 1], [7, 3, 2, 1], [4, -3, 4, 3]],
    spiky: [[2, -2, 2, 2], [5, -3, 2, 3], [8, -2, 2, 2], [2, 3, 2, 1], [5, 3, 2, 1], [8, 3, 1, 1]],
    bob: [[2, 3, 8, 1], [0, 2, 2, 7], [10, 2, 2, 7]],
    pixie: [[2, -1, 3, 1], [2, 3, 2, 1], [6, 3, 1, 1]],
    sidepart: [[2, -1, 5, 1], [2, 3, 3, 1], [5, 2, 3, 1]],
    curl: [[1, -1, 3, 2], [5, -2, 3, 2], [9, -1, 3, 2], [0, 3, 2, 3], [10, 3, 2, 3], [3, 3, 2, 1], [8, 3, 2, 1]],
    pony: [[2, 3, 3, 1], [7, 3, 2, 1], [9, -2, 2, 2], [11, 0, 2, 3], [12, 3, 1, 2]],
    lowpony: [[2, 3, 3, 1], [7, 3, 2, 1], [10, 7, 3, 5]],
    braids: [[2, 3, 2, 1], [8, 3, 2, 1], [0, 5, 2, 3], [-1, 8, 2, 3], [0, 11, 2, 2], [10, 5, 2, 3], [11, 8, 2, 3], [10, 11, 2, 2]],
    halfup: [[0, 3, 2, 8], [10, 3, 2, 8], [2, 3, 3, 1], [7, 3, 2, 1], [5, -2, 3, 2]],
    doublebun: [[-1, -1, 3, 2], [0, -2, 1, 1], [10, -1, 3, 2], [11, -2, 1, 1], [2, 3, 2, 1], [8, 3, 2, 1]],
    wavy: [[0, 2, 2, 5], [-1, 7, 3, 3], [0, 10, 3, 3], [10, 2, 2, 5], [10, 7, 3, 3], [9, 10, 3, 3], [2, 3, 3, 1]],
  },
  up: {
    base: [[1, 0, 10, 9]],
    short: [], long: [[0, 2, 12, 11]], twin: [[-2, 3, 3, 7], [11, 3, 3, 7]],
    bun: [[4, -3, 4, 3]], spiky: [[2, -2, 2, 2], [5, -3, 2, 3], [8, -2, 2, 2]], bob: [[0, 2, 12, 7]],
    pixie: [[2, -1, 3, 1], [3, 8, 5, 2]], sidepart: [[2, -1, 5, 1], [8, 7, 2, 3]],
    curl: [[1, -1, 3, 2], [5, -2, 3, 2], [9, -1, 3, 2], [0, 3, 2, 5], [10, 3, 2, 5]],
    pony: [[5, -3, 3, 3], [5, 1, 4, 6], [6, 7, 3, 4]],
    lowpony: [[5, 7, 3, 6]],
    braids: [[0, 5, 2, 3], [-1, 8, 2, 3], [0, 11, 2, 2], [10, 5, 2, 3], [11, 8, 2, 3], [10, 11, 2, 2]],
    halfup: [[0, 2, 12, 10], [5, -2, 3, 2], [4, 3, 4, 5]],
    doublebun: [[-1, -1, 3, 2], [0, -2, 1, 1], [10, -1, 3, 2], [11, -2, 1, 1]],
    wavy: [[0, 2, 12, 6], [-1, 7, 14, 3], [0, 10, 12, 3]],
  },
  right: {
    base: [[1, 0, 10, 3], [1, 2, 4, 6], [8, 3, 2, 1]],
    short: [], long: [[0, 2, 4, 11]], twin: [[-2, 3, 3, 7]],
    bun: [[3, -3, 4, 3]], spiky: [[2, -2, 2, 2], [5, -3, 2, 3], [8, -2, 2, 2]], bob: [[0, 2, 5, 7], [6, 3, 4, 1]],
    pixie: [[3, -1, 3, 1]], sidepart: [[3, -1, 5, 1], [6, 3, 2, 1]],
    curl: [[1, -1, 3, 2], [5, -2, 3, 2], [9, -1, 3, 2], [0, 3, 3, 5]],
    pony: [[-1, -2, 2, 2], [-2, 0, 2, 4], [-1, 4, 1, 2]], lowpony: [[-1, 6, 2, 4], [0, 10, 1, 2]],
    braids: [[0, 5, 2, 3], [-1, 8, 2, 3], [0, 11, 2, 2]],
    halfup: [[0, 2, 4, 10], [2, -2, 3, 2]], doublebun: [[0, -1, 3, 2], [1, -2, 1, 1]],
    wavy: [[0, 2, 4, 5], [-1, 7, 4, 3], [0, 10, 4, 3]],
  },
};

function blob(c, x, y, rects, col) {
  for (const [a, b, w, h] of rects) R(c, x + a - 1, y + b - 1, w + 2, h + 2, DOLL_INK);
  for (const [a, b, w, h] of rects) R(c, x + a, y + b, w, h, col);
}

/* o: { dir, frame, pose: stand|walk|sit|lift|dance|head, hop, blink, happy } */
function drawDoll(c, cx, by, L, o = {}) {
  const dir = o.dir || 'down', fr = o.frame || 0, pose = o.pose || 'stand';
  const C = dollColors(L);
  const x = Math.round(cx) - 6;
  let y = Math.round(by) - 20 - (o.hop || 0);
  const view = dir === 'left' ? 'right' : dir;

  if (pose !== 'lift' && pose !== 'sit' && pose !== 'head')
    R(c, x + 2, Math.round(by) - 1, 8, 2, 'rgba(0,0,0,.22)');

  c.save();
  if (dir === 'left') { c.translate(x * 2 + 12, 0); c.scale(-1, 1); }

  if (pose === 'head') { y = Math.round(by) - 9; drawHead(c, x, y, L, C, view, { sleep: true }); c.restore(); return; }

  const walking = pose === 'walk';
  const bob = walking && fr % 2 === 1 ? -1 : 0;
  const isDress = L.top === 'dress' || L.top === 'pinafore';
  const legCol = ['pants', 'denim', 'cropped'].includes(L.bottom) && !isDress ? C.bot : C.skin;

  // 腿
  if (pose === 'sit') {
    R(c, x + 3, y + 15, 6, 2, legCol); R(c, x + 3, y + 17, 2, 1, C.shoe); R(c, x + 7, y + 17, 2, 1, C.shoe);
    if (L.shoeStyle === 'boots') { R(c, x + 3, y + 16, 2, 1, C.shoe); R(c, x + 7, y + 16, 2, 1, C.shoe); }
    if (L.shoeStyle === 'sneakers') { R(c, x + 3, y + 17, 2, 1, '#fffaf0'); R(c, x + 7, y + 17, 2, 1, '#fffaf0'); }
    if (L.shoeStyle === 'maryjanes') { R(c, x + 4, y + 16, 1, 1, '#fffaf0'); R(c, x + 8, y + 16, 1, 1, '#fffaf0'); }
  } else {
    let upL = 0, upR = 0;
    if (walking) { upL = fr === 1 ? 1 : 0; upR = fr === 3 ? 1 : 0; }
    if (pose === 'lift') { upL = fr % 2; upR = 1 - fr % 2; }
    if (pose === 'dance') { upL = fr % 2 ? 2 : 0; }
    const leg = (lx, up) => {
      R(c, x + lx - 1, y + 15, 4, 5 - up, DOLL_INK);
      R(c, x + lx, y + 15, 2, 4 - up, legCol);
      if (L.bottom === 'shorts' && !isDress) R(c, x + lx, y + 15, 2, 1, C.bot);
      if (L.bottom === 'cropped' && !isDress) R(c, x + lx, y + 18 - up, 2, 1, C.skin);
      if (L.bottom === 'denim' && !isDress) R(c, x + lx, y + 18 - up, 2, 1, shade(C.bot, .16));
      if (L.shoeStyle === 'boots') R(c, x + lx, y + 17 - up, 2, 2, C.shoe);
      if (L.shoeStyle === 'sneakers' || L.shoeStyle === 'maryjanes') {
        R(c, x + lx, y + 18 - up, 2, 1, L.shoeStyle === 'maryjanes' ? '#fffaf0' : C.shoe);
      }
      R(c, x + lx, y + 19 - up, 2, 1, C.shoe);
      if (L.shoeStyle === 'sneakers') R(c, x + lx, y + 19 - up, 2, 1, '#fffaf0');
      if (L.shoeStyle === 'maryjanes') R(c, x + lx, y + 18 - up, 1, 1, C.shoe);
    };
    if (view === 'right') { leg(4 + (walking ? (fr === 1 ? -1 : fr === 3 ? 1 : 0) : 0), upL); leg(6 - (walking ? (fr === 1 ? -1 : fr === 3 ? 1 : 0) : 0), upR); }
    else { leg(3, upL); leg(7, upR); }
  }

  // 身体
  const yb = y + bob;
  box(c, x + 2, yb + 9, 8, 7, C.top, DOLL_INK);
  const front = view === 'down';
  if (L.top === 'tee' && front) R(c, x + 5, yb + 10, 2, 1, C.skin);
  if (L.top === 'hoodie') { R(c, x + 3, yb + 13, 6, 1, shade(C.top, -0.15)); if (front) { R(c, x + 5, yb + 10, 1, 2, '#fff'); R(c, x + 7, yb + 10, 1, 2, '#fff'); } }
  if (L.top === 'stripe') { R(c, x + 3, yb + 11, 6, 1, '#ffffff'); R(c, x + 3, yb + 13, 6, 1, '#ffffff'); }
  if (L.top === 'overall') { R(c, x + 3, yb + 10, 6, 5, '#fffaf0'); R(c, x + 4, yb + 12, 4, 3, C.bot); R(c, x + 4, yb + 10, 1, 2, C.bot); R(c, x + 7, yb + 10, 1, 2, C.bot); }
  if (L.top === 'cardigan' && front) {
    R(c, x + 5, yb + 10, 2, 5, '#fffaf0');
    R(c, x + 4, yb + 11, 1, 1, '#dfba83');
    R(c, x + 4, yb + 13, 1, 1, '#dfba83');
  }
  if (L.top === 'suit' && front) { R(c, x + 5, yb + 10, 2, 3, '#ffffff'); R(c, x + 5, yb + 11, 1, 2, '#e26d7d'); }
  if (view === 'right' && ['suit', 'cardigan', 'vest', 'apron'].includes(L.top)) {
    R(c, x + 8, yb + 10, 1, 3, '#fffaf0');
    if (L.top === 'suit') R(c, x + 8, yb + 12, 1, 1, '#e26d7d');
  }
  drawClothingDetail(c, x, yb, L, C, view);
  // 下装（连衣裙自带裙摆）
  if (isDress || L.top === 'raincoat' || L.bottom === 'skirt' || L.bottom === 'pleated') {
    const sc = isDress || L.top === 'raincoat' ? C.top : C.bot;
    R(c, x + 1, yb + 14, 10, 4, DOLL_INK); R(c, x + 2, yb + 14, 8, 3, sc); R(c, x + 2, yb + 16, 8, 1, shade(sc, -0.15));
    if (L.bottom === 'pleated' && !isDress) { R(c, x + 4, yb + 14, 1, 2, shade(sc, -.12)); R(c, x + 7, yb + 14, 1, 2, shade(sc, -.12)); }
    if (L.top === 'pinafore' && front) R(c, x + 5, yb + 14, 2, 1, shade(C.top, -.15));
    if (L.top === 'raincoat' && front) R(c, x + 5, yb + 14, 2, 3, shade(C.top, -.15));
  } else if (pose !== 'sit') { R(c, x + 3, yb + 14, 6, 1, C.bot); }
  if (L.top === 'apron' && front) { R(c, x + 4, yb + 14, 4, 2, '#fffaf0'); R(c, x + 5, yb + 14, 2, 1, '#dfba83'); }

  // 手臂
  const sleeve = ['hoodie', 'suit', 'stripe', 'sweater', 'jacket', 'raincoat', 'pajamas'].includes(L.top) ? 3 : 2;
  const sleeveColor = ['overall', 'vest', 'apron', 'pinafore'].includes(L.top) ? '#fffaf0' : C.top;
  const arm = (ax, dy, up) => {
    if (up) { R(c, x + ax - 1, yb + 5, 3, 7, DOLL_INK); R(c, x + ax, yb + 6, 1, 5, C.top); R(c, x + ax, yb + 5, 1, 1, C.skin); return; }
    R(c, x + ax - 1, yb + 9 + dy, 3, 6, DOLL_INK);
    R(c, x + ax, yb + 10 + dy, 1, sleeve, sleeveColor);
    R(c, x + ax, yb + 10 + dy + sleeve, 1, 4 - sleeve, C.skin);
  };
  const sw = walking ? (fr === 1 ? 1 : fr === 3 ? -1 : 0) : o.gesture === 'talk' && fr % 2 ? -1 : 0;
  if (view === 'right') arm(6, sw, pose === 'lift' || (pose === 'dance' && fr % 2));
  else {
    const upA = pose === 'lift' || (pose === 'dance' && fr % 2 === 0);
    const upB = pose === 'lift' || (pose === 'dance' && fr % 2 === 1);
    arm(1, sw, upA); arm(10, -sw, upB);
  }

  drawBodyAccessory(c, x, yb, L, C, view);
  drawHead(c, x, yb, L, C, view, o);
  if (o.prop === 'bowl') drawHeldBowl(c, x, yb, C, view, o.gesture === 'eat' && fr % 2 === 1);
  c.restore();
}

function drawHeldBowl(c, x, y, C, view, bite) {
  if (view === 'up') return; // 背面碗在身前，不穿过身体。
  const bx = x + (view === 'right' ? 7 : 2), by = y + 13, width = view === 'right' ? 6 : 8;
  R(c, bx, by, width, 1, DOLL_INK); R(c, bx + 1, by + 1, width - 2, 2, '#fff3d9');
  R(c, bx + 2, by + 3, width - 4, 1, '#96796a'); R(c, bx + 1, by - 1, width - 2, 1, '#d3a25d');
  R(c, bx + 2, by - 1, 2, 1, '#8eaf85');
  R(c, bx - 1, by, 1, 2, C.skin);
  if (view === 'down') R(c, bx + width, by, 1, 2, C.skin);
  if (bite) {
    const spoon = view === 'right' ? x + 10 : x + 7;
    R(c, spoon, y + 9, 1, 3, '#d9cbb5'); R(c, spoon - 1, y + 9, 2, 1, '#fff3d9');
  }
}

function drawClothingDetail(c, x, y, L, C, view) {
  const front = view === 'down', back = view === 'up', cream = '#fffaf0';
  const r = (a, b, w, h, color) => R(c, x + a, y + b, w, h, color);
  if (L.top === 'sweater') {
    r(3, 13, 6, 1, shade(C.top, .14));
    if (front) { r(4, 10, 4, 1, shade(C.top, -.13)); r(5, 11, 2, 1, cream); }
  }
  if (L.top === 'vest' || L.top === 'pinafore') {
    r(3, 10, 6, 2, cream);
    if (L.top === 'pinafore') { r(4, 10, 1, 3, C.top); r(7, 10, 1, 3, C.top); }
    else if (front) { r(5, 11, 2, 1, cream); r(5, 13, 1, 1, '#dfba83'); }
  }
  if (L.top === 'sailor') {
    r(3, 10, 6, back ? 3 : 1, cream);
    if (front) { r(4, 11, 1, 1, cream); r(7, 11, 1, 1, cream); r(5, 12, 2, 2, '#bc8390'); }
    if (back) r(4, 11, 4, 1, C.top);
  }
  if (L.top === 'apron') {
    r(3, 10, 6, 1, cream);
    if (front) { r(4, 11, 4, 4, cream); r(5, 13, 2, 1, '#dfba83'); }
    else if (back) { r(3, 13, 6, 1, cream); r(5, 12, 2, 3, cream); }
    else r(7, 11, 2, 4, cream);
  }
  if (L.top === 'jacket' || L.top === 'raincoat') {
    if (front) {
      r(5, 10, 2, 5, L.top === 'jacket' ? cream : shade(C.top, -.15));
      r(3, 13, 1, 1, shade(C.top, -.18)); r(8, 13, 1, 1, shade(C.top, -.18));
    } else if (back && L.top === 'raincoat') {
      r(4, 10, 4, 2, shade(C.top, -.13)); r(5, 12, 2, 1, shade(C.top, -.13));
    }
  }
  if (L.top === 'pajamas') {
    if (front) { r(5, 10, 1, 5, cream); r(7, 11, 1, 1, cream); }
    r(3, 12, 1, 1, cream); r(8, 14, 1, 1, cream);
  }
}

// 身上与头上的配饰独立：眼镜可以和围巾一起戴；睡觉、泡澡只画头时不会出现背包。
function drawBodyAccessory(c, x, y, L, C, view) {
  const r = (a, b, w, h, color) => R(c, x + a, y + b, w, h, color);
  if (L.extra === 'scarf') {
    r(2, 9, 8, 2, '#f1dfb9'); r(view === 'up' ? 7 : 3, 11, 2, 3, '#f1dfb9');
    r(2, 10, 8, 1, '#d1b48e');
  } else if (L.extra === 'satchel') {
    for (let i = 0; i < 4; i++) r(4 + i, 10 + i, 1, 1, '#8a5a3c');
    box(c, x + (view === 'right' ? 2 : 8), y + 12, 4, 4, '#b88160', DOLL_INK);
    r(view === 'right' ? 3 : 9, 13, 1, 1, '#f1dfb9');
  } else if (L.extra === 'backpack') {
    if (view === 'up') { box(c, x + 3, y + 10, 6, 6, '#b88160', DOLL_INK); r(4, 13, 4, 1, '#f1dfb9'); }
    else if (view === 'right') box(c, x, y + 10, 3, 6, '#b88160', DOLL_INK);
    else { r(3, 10, 1, 4, '#b88160'); r(8, 10, 1, 4, '#b88160'); }
  }
}

function drawHead(c, x, y, L, C, view, o) {
  if (view === 'right') bevel(c, x + 1, y + 1, 10, 9, C.skin, DOLL_INK);
  else box(c, x + 1, y + 1, 10, 9, C.skin, DOLL_INK);
  if (view === 'down') {
    if (L.acc === 'glasses') { R(c, x + 3, y + 4, 3, 3, DOLL_INK); R(c, x + 6, y + 4, 3, 3, DOLL_INK); R(c, x + 4, y + 5, 1, 1, '#cfeaf7'); R(c, x + 7, y + 5, 1, 1, '#cfeaf7'); }
    if (o.sleep || o.blink) { R(c, x + 3, y + 6, 2, 1, DOLL_INK); R(c, x + 7, y + 6, 2, 1, DOLL_INK); }
    else if (L.acc === 'glasses') { R(c, x + 4, y + 5, 1, 1, DOLL_INK); R(c, x + 7, y + 5, 1, 1, DOLL_INK); }
    else { R(c, x + 4, y + (o.expression === 'tired' ? 6 : 5), 1, o.expression === 'tired' ? 1 : 2, DOLL_INK); R(c, x + 7, y + (o.expression === 'tired' ? 6 : 5), 1, o.expression === 'tired' ? 1 : 2, DOLL_INK); }
    R(c, x + 2, y + 7, 2, 1, '#f59aa8'); R(c, x + 8, y + 7, 2, 1, '#f59aa8');
    if (o.happy || o.expression === 'content') R(c, x + 5, y + 8, 2, 1, '#c0505a');
  } else if (view === 'right') {
    if (L.acc === 'glasses') { R(c, x + 6, y + 4, 3, 3, DOLL_INK); R(c, x + 7, y + 5, 1, 1, '#cfeaf7'); }
    if (o.sleep || o.blink) R(c, x + 7, y + 6, 2, 1, DOLL_INK); else R(c, x + 7, y + (o.expression === 'tired' ? 6 : 5), 1, o.expression === 'tired' ? 1 : 2, DOLL_INK);
    R(c, x + 8, y + 7, 2, 1, '#f59aa8');
    if (o.happy || o.expression === 'content') R(c, x + 9, y + 8, 1, 1, '#c0505a');
  }

  const freckles = shade(C.skin, -.24);
  if (view !== 'up' && L.features === 'freckles') {
    for (const px of view === 'right' ? [8, 10] : [2, 4, 7, 9]) R(c, x + px, y + 7, 1, 1, freckles);
  }
  if (view !== 'up' && L.features === 'rosy') {
    if (view === 'down') R(c, x + 2, y + 7, 2, 2, '#e89198');
    R(c, x + 8, y + 7, 2, 2, '#e89198');
  }
  if (view !== 'up' && L.features === 'mole') R(c, x + 8, y + 7, 1, 1, '#805d52');

  const set = HAIR[view];
  const rects = set.base.concat(set[L.hair] || []);
  blob(c, x, y, rects, C.hair);
  if (view === 'right') {
    R(c, x + 4, y + 6, 2, 2, C.skin);
    R(c, x + 4, y + 6, 1, 1, shade(C.skin, -.12));
    R(c, x + 2, y + 4, 1, 2, shade(C.hair, .08));
    if (L.acc === 'glasses') {
      R(c, x + 6, y + 4, 4, 3, DOLL_INK); R(c, x + 7, y + 5, 2, 1, '#cfeaf7');
      R(c, x + 8, y + 5, 1, 1, DOLL_INK);
      if (o.sleep || o.blink) R(c, x + 7, y + 6, 2, 1, DOLL_INK);
    }
  }
  if (view !== 'up') R(c, x + 3, y + 1, 3, 1, shade(C.hair, 0.18)); // 头发高光
  if (L.hair === 'braids') {
    for (const h of [6, 9]) {
      R(c, x + (h === 6 ? 0 : -1), y + h, 2, 1, shade(C.hair, .16));
      if (view !== 'right') R(c, x + (h === 6 ? 10 : 11), y + h, 2, 1, shade(C.hair, .16));
    }
    R(c, x, y + 11, 2, 1, C.top);
    if (view !== 'right') R(c, x + 10, y + 11, 2, 1, C.top);
  }
  if (view === 'up' && ['wavy', 'halfup'].includes(L.hair)) {
    R(c, x + 2, y + 7, 1, 3, shade(C.hair, .12)); R(c, x + 9, y + 6, 1, 3, shade(C.hair, .12));
  }
  if (view === 'up' && ['pony', 'lowpony', 'halfup'].includes(L.hair)) R(c, x + 5, y + (L.hair === 'lowpony' ? 8 : 3), 3, 1, C.top);
  drawAcc(c, x, y, L, C, view);
}

function drawAcc(c, x, y, L, C, view) {
  const a = L.acc;
  if (a === 'cap') {
    blob(c, x, y, [[1, -1, 10, 3]], C.top);
    if (view === 'down') R(c, x + 1, y + 2, 10, 1, shade(C.top, -0.25));
    if (view === 'right') blob(c, x, y, [[9, 2, 4, 1]], shade(C.top, -0.2));
  } else if (a === 'bow') {
    const bx = view === 'right' ? 2 : 7;
    blob(c, x, y, [[bx, -1, 2, 3], [bx + 3, -1, 2, 3]], '#e26d7d'); R(c, x + bx + 2, y, 1, 1, '#c24d60');
  } else if (a === 'phones') {
    R(c, x + 1, y - 2, 10, 1, '#3b3a4a');
    if (view === 'down') { blob(c, x, y, [[0, 4, 1, 3], [11, 4, 1, 3]], C.top); }
    else if (view === 'right') blob(c, x, y, [[4, 3, 2, 3]], C.top);
  } else if (a === 'cat') {
    blob(c, x, y, [[1, -2, 3, 2], [8, -2, 3, 2]], C.hair);
    R(c, x + 2, y - 1, 1, 1, '#f59aa8'); R(c, x + 9, y - 1, 1, 1, '#f59aa8');
  } else if (a === 'flower') {
    const fx = view === 'right' ? 1 : 9;
    R(c, x + fx - 1, y - 1, 3, 3, '#f6b0c8'); R(c, x + fx, y - 2, 1, 5, '#f6b0c8'); R(c, x + fx - 2, y, 5, 1, '#f6b0c8');
    R(c, x + fx, y, 1, 1, '#f2d16b');
  } else if (a === 'crown') {
    blob(c, x, y, [[3, -2, 6, 2]], '#f2c33a');
    R(c, x + 3, y - 4, 1, 2, '#f2c33a'); R(c, x + 5, y - 5, 2, 3, '#f2c33a'); R(c, x + 8, y - 4, 1, 2, '#f2c33a');
    R(c, x + 5, y - 2, 2, 1, '#e26d7d');
  } else if (a === 'beret') {
    blob(c, x, y, [[1, -2, 10, 3], [3, -3, 6, 1]], C.top);
    R(c, x + 6, y - 4, 1, 1, DOLL_INK); R(c, x + 3, y - 2, 4, 1, shade(C.top, .13));
  } else if (a === 'beanie') {
    blob(c, x, y, [[2, -2, 8, 3], [1, 1, 10, 2]], C.top);
    R(c, x + 4, y - 4, 3, 2, '#f1dfb9'); R(c, x + 2, y + 1, 8, 1, shade(C.top, .16));
  } else if (a === 'headband') {
    R(c, x + 2, y, 8, 1, '#f1dfb9'); R(c, x + 1, y + 1, 1, 3, '#f1dfb9'); R(c, x + 10, y + 1, 1, 3, '#f1dfb9');
  } else if (a === 'starclip') {
    const ax = view === 'right' ? 3 : 9;
    R(c, x + ax - 1, y + 2, 3, 1, '#f2d16b'); R(c, x + ax, y + 1, 1, 3, '#f2d16b');
  } else if (a === 'ribbon') {
    const ax = view === 'right' ? 1 : view === 'up' ? 5 : 9;
    R(c, x + ax - 1, y + 1, 2, 2, '#bc8390'); R(c, x + ax + 2, y + 1, 2, 2, '#bc8390');
    R(c, x + ax + 1, y + 2, 1, 3, '#f1dfb9');
  } else if (a === 'roundglasses' && view !== 'up') {
    for (const gx of view === 'right' ? [6] : [2, 7]) {
      R(c, x + gx, y + 5, 3, 1, '#89654b'); R(c, x + gx, y + 7, 3, 1, '#89654b');
      R(c, x + gx - 1, y + 6, 1, 1, '#89654b'); R(c, x + gx + 3, y + 6, 1, 1, '#89654b');
    }
    if (view === 'down') R(c, x + 5, y + 6, 2, 1, '#89654b');
  }
}

// 给 DOM 里的小头像/试衣间画一张小人
const portraitSize = new WeakMap();

function dollPortrait(cv, L, dir = 'down', frame = 0, pose = 'stand') {
  if (!portraitSize.has(cv)) {
    portraitSize.set(cv, [cv.width, cv.height]);
    cv.width *= PIXEL_SCALE;
    cv.height = (cv.height + 4) * PIXEL_SCALE;
  }
  const [w, h] = portraitSize.get(cv);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.save();
  c.scale(PIXEL_SCALE, PIXEL_SCALE);
  drawDoll(c, w / 2, h + 3, L, { dir, frame, pose, happy: true });
  c.restore();
}

function randomLook() {
  const keys = o => Object.keys(o), r = n => (Math.random() * n) | 0;
  const look = {
    skin: r(OUTFIT.skin.length), hair: pick(keys(OUTFIT.hair)), hairColor: r(OUTFIT.hairColor.length),
    ...pick(OUTFIT_SETS).look,
    features: Math.random() < .65 ? 'plain' : pick(keys(OUTFIT.features)),
  };
  // 小概率换成自由款式，保留整套配色，让全部款式都有机会自然出现。
  if (Math.random() < .25) { look.top = pick(keys(OUTFIT.top)); look.bottom = pick(keys(OUTFIT.bottom)); }
  if (Math.random() < .25) look.acc = pick(keys(OUTFIT.acc));
  return look;
}
