function dollColors(L) {
  return {
    skin: OUTFIT.skin[L.skin] || OUTFIT.skin[0],
    hair: OUTFIT.hairColor[L.hairColor] || OUTFIT.hairColor[0],
    top: OUTFIT.clothColor[L.topColor] || OUTFIT.clothColor[0],
    bot: OUTFIT.clothColor[L.bottomColor] || OUTFIT.clothColor[0],
    shoe: OUTFIT.shoes[L.shoes] || OUTFIT.shoes[0],
  };
}

// Silhouettes drawn on the doubled pixel grid. The baseline stays at the
// simulation's foot position, including when a furniture sprite draws a sleeper.
const DOLL_HAIR_CAPS = {
  short: [[11, 9], [8, 15], [6, 19], [5, 22], [4, 24], [4, 24], [4, 24], [4, 24], [5, 23]],
  long: [[10, 12], [7, 18], [5, 22], [4, 24], [3, 26], [3, 26], [3, 26], [3, 26], [3, 26]],
  twin: [[10, 11], [7, 17], [5, 21], [4, 23], [4, 24], [4, 24], [4, 24], [4, 24], [5, 23]],
  bun: [[10, 10], [8, 14], [6, 18], [4, 22], [4, 24], [4, 24], [4, 24], [4, 24], [5, 23]],
  spiky: [[9, 4], [8, 7], [5, 14], [6, 18], [4, 23], [4, 25], [3, 26], [4, 24], [4, 24]],
  bob: [[10, 10], [7, 16], [5, 20], [4, 23], [3, 25], [3, 25], [3, 25], [3, 25], [4, 25]],
};

/* o: { dir, frame, pose: stand|walk|sit|lift|dance|head, hop, blink, happy } */
function drawDoll(c, cx, by, L, o = {}) {
  const { dir = 'down', frame = 0, pose = 'stand', hop = 0 } = o;
  const C = dollColors(L), side = dir === 'left' || dir === 'right', back = dir === 'up';
  const x = Math.round(cx), y = Math.round(by);
  const sleeping = pose === 'head', sitting = pose === 'sit', walk = pose === 'walk';
  if (!sleeping && !sitting && pose !== 'lift') contactShadow(c, x - 6, y - 1, 12);
  c.save();
  c.translate(x, y - hop);
  c.scale(dir === 'left' ? -.5 : .5, .5);
  c.translate(-15, sleeping ? -22 : sitting ? -43 : -47);
  const px = (a, b, w, h, color) => R(c, a, b, w, h, color);
  const blocks = (color, rows) => {
    for (const [a, b, w, h] of rows) px(a, b, w, h, color);
  };
  const edge = '#4e3542', faceShade = shade(C.skin, -.13);
  const hairEdge = shade(C.hair, -.23), hairDark = shade(C.hair, -.11), hairLight = shade(C.hair, .16);
  const softTop = shade(C.top, .16), deepTop = shade(C.top, -.14);
  const headBob = walk && frame % 2 ? -1 : 0;
  const dress = L.top === 'dress';
  const skirt = dress || L.bottom === 'skirt';
  const hair = Object.hasOwn(DOLL_HAIR_CAPS, L.hair) ? L.hair : 'short';
  c.translate(0, headBob);

  if (!sleeping) {
    const pants = skirt || L.bottom === 'shorts' ? C.skin : C.bot;
    for (const [i, a] of (side ? [11, 16] : [8, 17]).entries()) {
      const lift = walk && frame === (i ? 3 : 1) ? 2 : pose === 'dance' && i === frame % 2 ? 3 : 0;
      const legY = sitting ? 37 : 36;
      px(a, legY, 6, 10 - lift, edge);
      px(a + 1, legY, 4, 7 - lift, pants);
      px(a + 4, legY + 1, 1, 6 - lift, shade(pants, -.12));
      px(a - 1, legY + 7 - lift, 7, 3, edge);
      px(a, legY + 7 - lift, 5, 2, C.shoe);
      px(a, legY + 7 - lift, 3, 1, shade(C.shoe, .18));
    }
    blocks(edge, [[9, 21, 12, 2], [7, 23, 16, 11], [8, 34, 14, 4]]);
    blocks(C.top, [[10, 22, 10, 1], [8, 24, 14, 9], [9, 33, 12, 4]]);
    px(9, 24, 2, 9, softTop);
    px(20, 26, 2, 10, deepTop);
    if (L.top === 'overall') {
      px(9, 23, 12, 10, '#fff0dd');
      px(11, 28, 8, 9, C.bot);
      for (const a of [10, 18]) {
        px(a, 23, 2, 7, C.bot);
        px(a, 28, 2, 1, '#f1c87e');
      }
      px(13, 31, 4, 3, shade(C.bot, .13));
    } else if (L.top === 'suit' || L.top === 'cardigan') {
      if (!back) {
        px(side ? 16 : 12, 23, 5, 13, '#fff0d9');
        px(side ? 17 : 14, 24, 2, 4, L.top === 'suit' ? '#b97585' : '#ccb19a');
        px(side ? 15 : 11, 25, 1, 10, deepTop);
        for (const b of [29, 32, 35]) px(side ? 15 : 11, b, 1, 1, '#d5ae78');
      }
    } else if (L.top === 'hoodie') {
      px(10, 22, 10, 3, deepTop);
      px(11, 31, 8, 4, deepTop);
      if (!back) { px(12, 25, 1, 4, '#fff0de'); px(17, 25, 1, 3, '#fff0de'); }
    } else if (L.top === 'stripe') {
      for (const b of [26, 30, 34]) px(9, b, 12, 1, '#fff0dd');
    } else if (!back) {
      px(12, 23, 6, 2, '#fff1dc');
      px(13, 25, 4, 1, softTop);
    }

    if (skirt) {
      const cloth = dress ? C.top : C.bot;
      blocks(edge, [[8, 31, 14, 4], [6, 35, 18, 3], [4, 38, 22, 4], [6, 42, 18, 1]]);
      blocks(cloth, [[9, 32, 12, 3], [7, 35, 16, 3], [5, 38, 20, 3]]);
      for (const a of [8, 13, 19]) px(a, 37, 1, 4, shade(cloth, -.11));
      px(9, 32, 12, 1, shade(cloth, .13));
      px(6, 40, 18, 1, '#fff1d6');
      for (const a of [8, 12, 16, 20]) px(a, 39, 1, 1, '#fff1d6');
    }

    for (const [i, a] of (side ? [10] : [4, 21]).entries()) {
      const raised = pose === 'lift' || (pose === 'dance' && frame % 2 === i);
      const swing = walk && frame % 2 ? (i === 0 ? frame - 2 : 2 - frame) : 0;
      const b = raised ? 16 : 25 + swing;
      blocks(edge, [[a + 1, b, 4, 2], [a, b + 2, 6, 9], [a + 1, b + 11, 4, 1]]);
      px(a + 1, b + 2, 4, 6, L.top === 'overall' ? '#fff0dd' : C.top);
      px(a + 1, raised ? b + 1 : b + 8, 4, 3, C.skin);
      px(a + 4, raised ? b + 1 : b + 8, 1, 3, faceShade);
    }
  }

  c.translate(0, -1);
  if (hair === 'twin' || hair === 'long') {
    for (const [a, mirror] of side ? [[4, 1]] : [[4, 1], [24, -1]]) {
      if (hair === 'twin') {
        for (const [j, w] of [5, 6, 5, 4].entries()) {
          const bx = a - 2 + (j % 2) * mirror, b = 13 + j * 4;
          blocks(hairEdge, [[bx + 1, b - 1, w - 2, 6], [bx, b, w, 4]]);
          px(bx + 1, b, w - 2, 3, j === 3 ? hairDark : C.hair);
          px(bx + 1, b, 2, 1, hairLight);
        }
        px(a - 1, 24, 4, 1, '#d99baa');
      } else {
        blocks(hairEdge, [[a - 2, 11, 7, 17], [a - 1, 28, 5, 3]]);
        px(a - 1, 12, 5, 16, C.hair);
        px(a, 17, 1, 11, hairLight);
      }
    }
  }
  if (hair === 'bun') {
    blocks(hairEdge, [[11, -4, 8, 2], [9, -2, 12, 6]]);
    px(11, -2, 8, 5, C.hair);
    px(12, -2, 5, 1, hairLight);
  }
  if (back) {
    blocks(hairEdge, [[5, 7, 20, 13], [7, 20, 16, 4]]);
    px(6, 7, 18, 13, C.hair);
    px(8, 20, 14, hair === 'bob' ? 3 : 1, hairDark);
  } else {
    blocks(edge, [[7, 7, 16, 2], [5, 9, 20, 9], [6, 18, 18, 3], [8, 21, 14, 2]]);
    if (side) px(24, 14, 2, 4, edge);
    blocks(C.skin, [[7, 9, 16, 2], [6, 11, 18, 7], [7, 18, 16, 3], [9, 21, 12, 1]]);
    if (side) px(23, 15, 2, 2, C.skin);
    px(9, 21, 12, 1, faceShade);
    px(22, 15, 2, 4, faceShade);
  }

  const cap = DOLL_HAIR_CAPS[hair];
  const crownRise = hair === 'spiky' ? 3 : 2;
  for (const [row, [a, w]] of cap.slice(0, crownRise + 1).entries()) {
    px(a, row - crownRise, w, 2, hairEdge);
    px(a + 1, row - crownRise + 1, w - 2, 1, C.hair);
  }
  for (const [row, [a, w]] of cap.entries()) {
    px(a - 1, row, w + 2, 2, hairEdge);
  }
  for (const [row, [a, w]] of cap.entries()) {
    px(a, row + 1, w, 1, row > 5 ? hairDark : C.hair);
  }
  blocks(C.hair, back ? [[6, 8, 18, 10], [8, 18, 14, 2]] :
    side ? [[5, 8, 10, 8], [14, 8, 9, 3], [20, 9, 5, 3]] :
      [[5, 8, 6, 5], [10, 7, 5, 5], [14, 8, 5, 5], [19, 8, 5, 3], [23, 8, 3, 5]]);
  if (hair === 'bob' && !back) blocks(hairDark, [[4, 9, 3, 10], ...(side ? [] : [[23, 9, 3, 10]])]);
  blocks(hairLight, [[8, 4, 7, 1], [6, 5, 6, 1], [12, 5, 5, 1], [18, 6, 4, 1], [9, 6, 2, 1]]);
  if (back) {
    px(9, 9, 1, 9, hairLight);
    px(17, 10, 1, 9, hairDark);
  } else {
    const eyes = side ? [20] : [10, 20];
    for (const eye of eyes) {
      if (L.acc === 'glasses') {
        blocks(edge, [[eye - 3, 12, 7, 2], [eye - 4, 14, 9, 5], [eye - 3, 19, 7, 1]]);
        blocks(shade(C.skin, .08), [[eye - 2, 13, 5, 6], [eye - 3, 14, 7, 4]]);
        px(eye - 2, 13, 2, 1, '#fff3e5');
      }
      if (sleeping || o.blink) px(eye - 1, 16, 3, 1, edge);
      else {
        px(eye, 14, 2, 4, edge);
        px(eye, 14, 1, 1, '#fff5e9');
      }
    }
    if (L.acc === 'glasses' && !side) px(14, 14, 3, 2, edge);
    const blush = C.skin === OUTFIT.skin.at(-1) ? '#ab665f' : '#e9a395';
    if (!side) px(7, 18, 2, 1, blush);
    px(side ? 22 : 21, 18, 2, 1, blush);
    px(side ? 22 : 14, 20, o.happy ? 3 : 2, 1, o.happy ? '#b66a74' : faceShade);
  }

  drawDollAccessory(px, blocks, L, C, side, back);
  c.restore();
}

function drawDollAccessory(px, blocks, L, C, side, back) {
  const edge = '#5f4151';
  if (L.acc === 'bow') {
    const a = side ? 6 : 13;
    blocks(edge, [[a, -3, 6, 7], [a + 7, -2, 6, 7], [a + 5, 0, 3, 4]]);
    blocks('#d88b9f', [[a + 1, -2, 4, 5], [a + 8, -1, 4, 5], [a + 5, 1, 3, 2]]);
    px(a + 1, -2, 3, 1, '#f4bdc0');
    px(a + 9, -1, 3, 1, '#f4bdc0');
  } else if (L.acc === 'phones') {
    px(6, 0, 17, 2, edge);
    for (const a of side ? [7] : [3, 24]) {
      blocks(edge, [[a, 8, 4, 9], [a + 1, 7, 3, 11]]);
      px(a + 1, 9, 2, 6, C.top);
    }
  } else if (L.acc === 'cap') {
    blocks(edge, [[7, -2, 16, 2], [5, 0, 21, 7], [side ? 19 : 7, 6, side ? 11 : 18, 3]]);
    px(7, 0, 17, 5, C.top);
    px(8, 0, 12, 1, shade(C.top, .17));
    if (!back) px(side ? 19 : 8, 6, side ? 10 : 16, 1, shade(C.top, -.1));
  } else if (L.acc === 'flower') {
    const a = side ? 6 : 22;
    blocks('#e9a5ae', [[a, 0, 3, 7], [a - 2, 2, 7, 3]]);
    px(a, 2, 3, 2, '#fff1b5');
  } else if (L.acc === 'cat') {
    for (const a of [6, 20]) {
      blocks(edge, [[a, -4, 4, 6], [a, -2, 6, 5]]);
      px(a + 1, -2, 3, 3, '#e5a4ab');
    }
  } else if (L.acc === 'crown') {
    blocks('#a27961', [[9, -4, 2, 6], [14, -5, 2, 7], [19, -4, 2, 6], [9, -1, 12, 4]]);
    blocks('#efc278', [[10, -1, 10, 3], [14, -4, 2, 3]]);
    px(14, 0, 2, 1, '#cd8296');
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
  const top = pick(keys(OUTFIT.top));
  return {
    skin: r(OUTFIT.skin.length), hair: pick(keys(OUTFIT.hair)), hairColor: r(OUTFIT.hairColor.length),
    top, topColor: r(OUTFIT.clothColor.length), bottom: pick(keys(OUTFIT.bottom)), bottomColor: r(OUTFIT.clothColor.length),
    shoes: r(OUTFIT.shoes.length), acc: pick(keys(OUTFIT.acc)),
  };
}
