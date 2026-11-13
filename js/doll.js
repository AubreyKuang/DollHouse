// 小人占 12×20 个逻辑像素，五官与衣服细节用半像素网格。

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
    twin: [[2, 3, 3, 1], [7, 3, 2, 1], [-1.5, 3.5, 2.5, 4], [-2, 7, 2.5, 2], [-1.5, 8.5, 2, 2.5], [11, 3.5, 2.5, 4], [11.5, 7, 2.5, 2], [11.5, 8.5, 2, 2.5]],
    bun: [[2, 3, 3, 1], [7, 3, 2, 1], [4, -3, 4, 3]],
    spiky: [[2, -2, 2, 2], [5, -3, 2, 3], [8, -2, 2, 2], [2, 3, 2, 1], [5, 3, 2, 1], [8, 3, 1, 1]],
    bob: [[2, 3, 8, 1], [0, 2, 2, 7], [10, 2, 2, 7]],
  },
  up: {
    base: [[1, 0, 10, 9]],
    short: [], long: [[0, 2, 12, 11]], twin: [[-1.5, 3.5, 2.5, 4], [-2, 7, 2.5, 3], [11, 3.5, 2.5, 4], [11.5, 7, 2.5, 3]],
    bun: [[4, -3, 4, 3]], spiky: [[2, -2, 2, 2], [5, -3, 2, 3], [8, -2, 2, 2]], bob: [[0, 2, 12, 7]],
  },
  right: {
    base: [[1, 0, 10, 3], [1, 2, 4, 6], [8, 3, 2, 1]],
    short: [], long: [[0, 2, 4, 11]], twin: [[-1, 3.5, 3, 4], [-2, 7, 3, 2], [-1.5, 8.5, 2.5, 2.5]],
    bun: [[3, -3, 4, 3]], spiky: [[2, -2, 2, 2], [5, -3, 2, 3], [8, -2, 2, 2]], bob: [[0, 2, 5, 7], [6, 3, 4, 1]],
  },
};

function blob(c, x, y, rects, col, line = INK) {
  for (const [a, b, w, h] of rects) {
    detail(c, x + a - .5, y + b, w + 1, h, line);
    detail(c, x + a, y + b - .5, w, h + 1, line);
  }
  for (const [a, b, w, h] of rects) detail(c, x + a, y + b, w, h, col);
}

/* o: { dir, frame, pose: stand|walk|sit|lift|dance|head, hop, blink, happy } */
function drawDoll(c, cx, by, L, o = {}) {
  const dir = o.dir || 'down', fr = o.frame || 0, pose = o.pose || 'stand';
  const C = dollColors(L);
  const x = Math.round(cx) - 6;
  let y = Math.round(by) - 20 - (o.hop || 0);
  const view = dir === 'left' ? 'right' : dir;

  if (pose !== 'lift' && pose !== 'sit' && pose !== 'head')
    contactShadow(c, x + 1, Math.round(by) - 1, 10);

  c.save();
  if (dir === 'left') { c.translate(x * 2 + 12, 0); c.scale(-1, 1); }

  if (pose === 'head') { y = Math.round(by) - 9; drawHead(c, x, y, L, C, view, { sleep: true }); c.restore(); return; }

  const walking = pose === 'walk';
  const bob = walking && fr % 2 === 1 ? -1 : 0;
  const isDress = L.top === 'dress';
  const legCol = L.bottom === 'pants' && !isDress ? C.bot : C.skin;

  // 腿
  if (pose === 'sit') {
    R(c, x + 3, y + 15, 6, 2, legCol); R(c, x + 3, y + 17, 2, 1, C.shoe); R(c, x + 7, y + 17, 2, 1, C.shoe);
  } else {
    let upL = 0, upR = 0;
    if (walking) { upL = fr === 1 ? 1 : 0; upR = fr === 3 ? 1 : 0; }
    if (pose === 'lift') { upL = fr % 2; upR = 1 - fr % 2; }
    if (pose === 'dance') { upL = fr % 2 ? 2 : 0; }
    const leg = (lx, up) => {
      R(c, x + lx - 1, y + 15, 4, 5 - up, INK);
      R(c, x + lx, y + 15, 2, 4 - up, legCol);
      if (L.bottom === 'shorts' && !isDress) R(c, x + lx, y + 15, 2, 1, C.bot);
      R(c, x + lx, y + 19 - up, 2, 1, C.shoe);
      detail(c, x + lx, y + 19 - up, 1.5, .5, shade(C.shoe, .16));
    };
    if (view === 'right') { leg(4 + (walking ? (fr === 1 ? -1 : fr === 3 ? 1 : 0) : 0), upL); leg(6 - (walking ? (fr === 1 ? -1 : fr === 3 ? 1 : 0) : 0), upR); }
    else { leg(3, upL); leg(7, upR); }
  }

  // 身体
  const yb = y + bob;
  bevel(c, x + 2, yb + 9, 8, 7, C.top, '#563e4c');
  detail(c, x + 3, yb + 10, .5, 4, shade(C.top, .16));
  detail(c, x + 8, yb + 11, 1, 3, shade(C.top, -.09));
  detail(c, x + 3, yb + 14.5, 6, .5, shade(C.top, -.12));
  const front = view === 'down';
  if (L.top === 'tee' && front) R(c, x + 5, yb + 10, 2, 1, C.skin);
  if (L.top === 'hoodie') { R(c, x + 3, yb + 13, 6, 1, shade(C.top, -0.15)); if (front) { R(c, x + 5, yb + 10, 1, 2, '#fff'); R(c, x + 7, yb + 10, 1, 2, '#fff'); } }
  if (L.top === 'stripe') { R(c, x + 3, yb + 11, 6, 1, '#ffffff'); R(c, x + 3, yb + 13, 6, 1, '#ffffff'); }
  if (L.top === 'overall') { R(c, x + 3, yb + 10, 6, 5, '#fffaf0'); R(c, x + 4, yb + 12, 4, 3, C.bot); R(c, x + 4, yb + 10, 1, 2, C.bot); R(c, x + 7, yb + 10, 1, 2, C.bot); }
  if (L.top === 'suit' && front) {
    detail(c, x + 4.5, yb + 10, 3, 3.5, '#fff1df');
    detail(c, x + 5.5, yb + 10.5, 1, 2, '#b87881');
    detail(c, x + 4, yb + 11.5, .5, 2, shade(C.top, .16));
    detail(c, x + 7.5, yb + 11.5, .5, 2, shade(C.top, .16));
  }
  if (front && L.top === 'overall') {
    detail(c, x + 4, yb + 12, .5, .5, '#f4d499');
    detail(c, x + 7.5, yb + 12, .5, .5, '#f4d499');
    detail(c, x + 5, yb + 13, 2, .5, shade(C.bot, .16));
  }
  // 下装（连衣裙自带裙摆）
  if (isDress || L.bottom === 'skirt') {
    const sc = isDress ? C.top : C.bot;
    detail(c, x + 2, yb + 13.5, 8, 4, '#624454');
    detail(c, x + 1, yb + 15, 10, 3, '#624454');
    detail(c, x + 2.5, yb + 14, 7, 1.5, sc);
    detail(c, x + 1.5, yb + 15.5, 9, 2, sc);
    for (const px of [3, 5, 7, 9]) detail(c, x + px, yb + 15, .5, 2, shade(sc, -.12));
    detail(c, x + 2, yb + 17, 8, .5, shade(sc, .2));
  } else if (pose !== 'sit') { R(c, x + 3, yb + 14, 6, 1, C.bot); }

  // 手臂
  const sleeve = L.top === 'hoodie' || L.top === 'suit' || L.top === 'stripe' ? 3 : 2;
  const arm = (ax, dy, up) => {
    if (up) { R(c, x + ax - 1, yb + 5, 3, 7, INK); R(c, x + ax, yb + 6, 1, 5, C.top); R(c, x + ax, yb + 5, 1, 1, C.skin); return; }
    R(c, x + ax - 1, yb + 9 + dy, 3, 6, INK);
    R(c, x + ax, yb + 10 + dy, 1, sleeve, L.top === 'overall' ? '#fffaf0' : C.top);
    R(c, x + ax, yb + 10 + dy + sleeve, 1, 4 - sleeve, C.skin);
  };
  const sw = walking ? (fr === 1 ? 1 : fr === 3 ? -1 : 0) : 0;
  if (view === 'right') arm(6, sw, pose === 'lift' || (pose === 'dance' && fr % 2));
  else {
    const upA = pose === 'lift' || (pose === 'dance' && fr % 2 === 0);
    const upB = pose === 'lift' || (pose === 'dance' && fr % 2 === 1);
    arm(1, sw, upA); arm(10, -sw, upB);
  }

  drawHead(c, x, yb, L, C, view, o);
  c.restore();
}

function drawHead(c, x, y, L, C, view, o) {
  const line = '#543b47', dark = shade(C.hair, -.11), lit = shade(C.hair, .17);
  if (view !== 'up') {
    bevel(c, x + 1, y + 1, 10, 9, C.skin, line);
    detail(c, x + 2, y + 8, 8, .5, shade(C.skin, -.12));
    detail(c, x + 9, y + 6, 1, 2, shade(C.skin, -.09));
    const eyes = view === 'down' ? [4, 8] : [8.5];
    for (const eye of eyes) {
      if (L.acc === 'glasses') {
        detail(c, x + eye - 1.5, y + 5, 3, 2, line);
        detail(c, x + eye - 1, y + 4.5, 2, 3, line);
        detail(c, x + eye - 1, y + 5, 2, 2, shade(C.skin, .06));
      }
      if (o.sleep || o.blink) detail(c, x + eye - .75, y + 6, 1.5, .5, line);
      else {
        detail(c, x + eye - .5, y + 5.5, 1, 1.5, line);
        detail(c, x + eye - .5, y + 5.5, .5, .5, '#fff3e4');
      }
    }
    if (L.acc === 'glasses' && view === 'down') detail(c, x + 5.5, y + 5.5, 1, .5, line);
    const blush = shade(C.skin, -.10);
    if (view === 'down') detail(c, x + 2.5, y + 7, 1.5, .5, blush);
    detail(c, x + 8.5, y + 7.5, 1.5, .5, blush);
    detail(c, x + (view === 'down' ? 5.5 : 9), y + 8, o.happy ? 1 : .5, .5, o.happy ? '#b36a72' : shade(C.skin, -.19));
  }

  const set = HAIR[view];
  blob(c, x, y, set.base.concat(set[L.hair] || []), C.hair, shade(C.hair, -.21));
  detail(c, x + 2.5, y + 1, 3, .5, lit);
  detail(c, x + 2, y + 1.5, 2, .5, lit);
  detail(c, x + 6.5, y + 2, 3, .5, dark);
  if (view === 'up') {
    detail(c, x + 3.5, y + 2, .5, 5, lit);
    detail(c, x + 7.5, y + 3, .5, 5, dark);
  } else {
    detail(c, x + 2, y + 2.5, 1, 1.5, dark);
    if (view === 'right') detail(c, x + 2.5, y + 4, .5, 3, lit);
  }
  if (L.hair === 'long' || L.hair === 'bob') {
    detail(c, x + .5, y + 4.5, .5, L.hair === 'long' ? 6 : 3, lit);
    if (view !== 'right') detail(c, x + 11, y + 5, .5, L.hair === 'long' ? 6 : 3, dark);
  }
  if (L.hair === 'twin') {
    const braids = view === 'right' ? [-.5] : [-.5, 12];
    for (const px of braids) {
      detail(c, x + px, y + 5, .5, 1.5, lit);
      detail(c, x + px, y + 7.5, 1, .5, lit);
      detail(c, x + px, y + 9, 1, .5, '#d49ba4');
    }
  }
  if (L.hair === 'bun') detail(c, x + (view === 'right' ? 4 : 5), y - 2, 2, .5, lit);
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
    blob(c, x, y, [[bx, -1, 2, 3], [bx + 3, -1, 2, 3]], '#d78d9b', '#794f62');
    detail(c, x + bx + 2, y, 1, 1.5, '#b87285');
    detail(c, x + bx + .5, y - .5, 1, .5, '#f4bdbe');
    detail(c, x + bx + 3.5, y - .5, 1, .5, '#f4bdbe');
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
  }
}

// 给 DOM 里的小头像/试衣间画一张小人
const portraitSize = new WeakMap();

function dollPortrait(cv, L, dir = 'down', frame = 0, pose = 'stand') {
  if (!portraitSize.has(cv)) {
    portraitSize.set(cv, [cv.width, cv.height]);
    cv.width *= PIXEL_SCALE;
    cv.height *= PIXEL_SCALE;
  }
  const [w, h] = portraitSize.get(cv);
  const c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  c.save();
  c.scale(PIXEL_SCALE, PIXEL_SCALE);
  drawDoll(c, w / 2, h - 1, L, { dir, frame, pose, happy: true });
  c.restore();
}

function randomLook() {
  const keys = o => Object.keys(o), r = n => (Math.random() * n) | 0;
  const top = pick(keys(OUTFIT.top));
  return {
    skin: r(OUTFIT.skin.length), hair: pick(keys(OUTFIT.hair)), hairColor: r(OUTFIT.hairColor.length),
    top, topColor: r(OUTFIT.clothColor.length), bottom: pick(keys(OUTFIT.bottom)), bottomColor: r(OUTFIT.clothColor.length),
    shoes: r(OUTFIT.shoes.length), acc: pick(keys(OUTFIT.acc)),
  };
}
