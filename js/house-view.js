// Two cutaway storeys over the existing simulation grid. The front edges
// are shallow in screen space while the back walls and sprites stay upright.
const HOUSE_X = 14;
const HOUSE_HEIGHT = 310;
const HOUSE_MARGIN = 60;
const FLOOR_STEP = 3;
const WALL_STEP = 18;
const STOREYS = [
  { wall: 165, back: 225, front: 252, row: WALL_ROWS, wallRow: 0,
    rooms: ['#edbdb7', '#f4d9ae'], floors: ['#c99783', '#c69669'] },
  { wall: 74, back: 134, front: 158, row: FLOOR_SPLIT, wallRow: UPPER_WALL,
    rooms: ['#625a76', '#d7b9c6'], floors: ['#766481', '#a4ad8c'] },
];
const YARD = { wall: 258, back: 258, front: 300, row: ROWS, step: 7 };
const storeyOf = row => row >= ROWS ? YARD : STOREYS[+(row < 0 || row >= FLOOR_SPLIT)];

function houseY(y, storey) {
  return storey.back + (y - storey.row * T) * (storey.step || FLOOR_STEP) / T;
}

function stairPoint(progress) {
  const x = HOUSE_X + stairsColumn() * T + 8;
  const edge = HOUSE_X + W;
  const top = houseY(UPPER_LANDING * T + 14, STOREYS[1]);
  const bottom = houseY(LOWER_LANDING * T + 14, STOREYS[0]);
  if (progress < .2) return { x: mixNum(x, edge + 8, progress / .2), y: top };
  if (progress > .8) return { x: mixNum(edge + 28, x, (progress - .8) / .2), y: bottom };
  const t = (progress - .2) / .6;
  return { x: mixNum(edge + 8, edge + 28, t), y: mixNum(top, bottom, t) };
}

function houseDollPoint(d) {
  if (d.state === 'lift') return { x: d.liftX, y: d.liftY };
  if (takingStairs(d)) {
    return stairPoint((UPPER_LANDING * T + 14 - d.y) / ((UPPER_LANDING - LOWER_LANDING) * T));
  }
  if (takingYardPath(d)) {
    const inside = FLOOR_SPLIT - 1, outside = ROWS;
    const progress = (d.y - (inside * T + 14)) / ((outside - inside) * T);
    return { x: HOUSE_X + d.x, y: mixNum(houseY(inside * T + 14, STOREYS[0]), houseY(outside * T + 14, YARD), progress) };
  }
  if (d.act?.onFurn) {
    const f = d.act.furn;
    const offset = f.id === 'gardenSwing' ? swingOffset(G.t) : 0;
    return { x: HOUSE_X + d.x, y: houseFurnitureRect(f).y + d.y - f.y * T + offset };
  }
  return { x: HOUSE_X + d.x, y: houseY(d.y, storeyOf(d.ty)) };
}

function houseFurnitureRect(f) {
  const F = FURNITURE[f.id], storey = storeyOf(f.y);
  const x = HOUSE_X + f.x * T, w = F.w * T;
  const layer = layerOf(f.id);
  const wall = layer === 'wall';
  const bottom = wall ? storey.wall + 5 + (f.y - storey.wallRow) * WALL_STEP + F.h * T : houseY((f.y + F.h) * T, storey);
  const y = bottom - F.h * (layer === 'floor' ? FLOOR_STEP : T);
  return { x, y, w, bottom, top: y - (layer === 'solid' ? TALL[f.id] || 0 : 0), storey };
}

function houseTile(p, id) {
  const storey = p.y >= YARD.back ? YARD : p.y < STOREYS[0].wall ? STOREYS[1] : STOREYS[0];
  const F = id && FURNITURE[id];
  const wall = F && layerOf(id) === 'wall';
  const x = F ? Math.round((p.x - HOUSE_X) / T - F.w / 2) : Math.floor((p.x - HOUSE_X) / T);
  if (p.x < HOUSE_X || p.x >= HOUSE_X + W || p.y < storey.wall || p.y >= storey.front) return null;
  if (wall) {
    if (p.y >= storey.back) return null;
    const row = Math.round((p.y - storey.wall - 5 - F.h * T / 2) / WALL_STEP);
    return { x, y: storey.wallRow + Math.max(0, Math.min(WALL_ROWS - F.h, row)) };
  }
  if (p.y < storey.back) return null;
  const y = storey.row + (p.y - storey.back) / (storey.step || FLOOR_STEP);
  const end = storey === YARD ? YARD_END : storey === STOREYS[1] ? ROWS : FLOOR_SPLIT;
  return { x, y: F ? Math.max(storey.row, Math.min(end - F.h, Math.round(y - F.h / 2))) : Math.floor(y) };
}

function housePath(c, points) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.closePath();
}

function housePoly(c, color, ...points) {
  c.fillStyle = color;
  housePath(c, points);
  c.fill();
}

function drawHouseGarden(c, left, right) {
  const width = W + HOUSE_MARGIN;
  R(c, 0, 0, width, HOUSE_HEIGHT, G.sky);
  const season = seasonOf(G.day).id;
  const snowy = G.weather === 'snow';
  const grass = season === 'autumn' ? '#b9b181' : snowy ? '#cbdace' : '#a7bd8b';
  const leaf = season === 'autumn' ? '#c4a172' : '#89a97d';
  const canopy = shade(leaf, -.10), leafLight = shade(leaf, .08);
  const sky = c.createLinearGradient(0, 18, 0, 230);
  sky.addColorStop(0, G.night ? '#35315100' : '#86b5dc48');
  sky.addColorStop(1, G.night ? '#b59bc35b' : '#ffefd496');
  c.fillStyle = sky;
  c.fillRect(0, 0, width, 230);
  const horizon = snowy ? '#b9c9ca' : '#a6baa2';
  housePoly(c, horizon, [0, 213], [19, 196], [63, 224], [right - 18, 213],
    [right + 22, 194], [width, 211], [width, 239], [0, 239]);
  R(c, 0, 229, width, HOUSE_HEIGHT - 229, grass);
  for (const [x, y, size] of [[-13, 171, 42], [right + 2, 165, 37], [right + 21, 197, 40]]) {
    R(c, x + 14, y - 4, 6, 231 - y, '#785749');
    R(c, x + 16, y - 3, 2, 229 - y, '#aa8061');
    for (const [dx, dy, w] of [[0, -13, size], [4, -19, size - 6], [8, -25, size - 14], [13, -29, size - 22]]) {
      R(c, x + dx, y + dy, w, 14, canopy);
      R(c, x + dx + 2, y + dy, w - 6, 7, leaf);
    }
    for (let i = 0; i < 9; i++) {
      const dx = 5 + Math.floor(rnd(x + i * 17) * (size - 14)), dy = -10 - Math.floor(rnd(x + i * 41) * 12);
      R(c, x + dx, y + dy, 4, 2, i % 3 ? leaf : leafLight);
      detail(c, x + dx + 1, y + dy - .5, 2, .5, leafLight);
    }
  }
  const lawn = c.createLinearGradient(0, YARD.back, 0, YARD.front);
  lawn.addColorStop(0, shade(grass, -.045));
  lawn.addColorStop(.5, shade(grass, .055));
  lawn.addColorStop(1, shade(grass, .09));
  c.fillStyle = lawn;
  c.fillRect(left - 5, YARD.back, W + 10, YARD.front - YARD.back);
  R(c, 0, 301, width, 9, '#d4c0a2');
  R(c, 0, 301, width, 1, '#e0d3b5');
  for (let x = 0; x < width; x += 16) R(c, x, 303, 1, 6, '#b0a88e');
  const gate = left + 10 * T;
  housePoly(c, '#d2c2a2', [gate + 2, 253], [gate + 14, 253], [gate + 25, 301], [gate - 9, 301]);
  for (let y = 261; y < 300; y += 7) {
    const spread = Math.floor((y - 253) / 5);
    R(c, gate + 2 - spread, y, 12 + spread * 2, 1, '#e9dac0');
    detail(c, gate + 3 - spread, y + 1, 9 + spread * 2, .5, '#bdaa8c');
  }
  for (const x of [left - 7, right + 5]) {
    R(c, x, 254, 3, 44, '#b69b7b');
    R(c, x + 1, 254, 1, 44, '#e8d2af');
    for (let y = 256; y < 300; y += 7) R(c, x - 1, y, 5, 3, '#d5bc99');
  }
  for (const [x, y] of [[3, 43], [right + 12, 57], [right - 25, 8]]) {
    const glow = G.night ? '#d9d2ec' : '#fff0d4', underside = G.night ? '#9e9cbc' : '#edc7ba';
    R(c, x, y + 8, 32, 4, underside);
    R(c, x + 2, y + 6, 27, 4, glow);
    R(c, x + 6, y + 3, 19, 5, glow);
    R(c, x + 11, y, 9, 5, glow);
    detail(c, x + 4, y + 10, 23, .5, '#fff4dc');
  }
  const grassDark = shade(grass, -.14);
  for (let i = 0; i < 44; i++) {
    const x = Math.round(rnd(i + 690) * width), y = Math.round(261 + rnd(i + 810) * 36);
    if (Math.abs(x - gate - 8) < 18) continue;
    R(c, x, y + 1, 2, 1, grassDark);
    if (i % 5 !== 0 || snowy) continue;
    detail(c, x + .5, y - 1, .5, 3, grassDark);
    R(c, x - 1, y - 1, 3, 1, i % 2 ? '#fff4d9' : '#f2c0b6');
    detail(c, x + .5, y - 2, .5, 3, '#fff0d3');
    detail(c, x + .5, y - 1, .5, .5, '#ddae6a');
  }
  const picnic = G.community?.active;
  if (G.weather === 'rain' || (picnic?.showerAt && absNow() >= picnic.showerAt)) {
    for (let i = 0; i < 26; i++) {
      const x = rnd(i + 460) * width, y = 252 + (rnd(i + 361) * 58 + G.t * 85) % 58;
      R(c, x, y, 1, 5, '#d7e6eeaa');
    }
  }
}

function drawHouseRoof(c, left, right) {
  const peak = left + Math.round(W * .58), eave = 70;
  const pitch = (color, outer, inner) => housePoly(c, color, ...outer, ...[...inner].reverse());
  const ridge = [[left - 7, eave], [peak, 7], [right + 9, 32]];
  const rim = [[left - 3, eave + 1], [peak, 13], [right + 8, 38]];
  const face = [[left + 8, eave + 1], [peak, 20], [right + 1, 44]];
  const underside = [[left + 17, eave + 1], [peak, 25], [right - 5, 47]];
  housePoly(c, '#f8ddba', ...ridge, [right + 9, eave]);
  pitch('#684450', ridge, rim);
  pitch('#ab6b6d', rim, face);
  pitch('#dca68d', face, underside);
  const glint = [[left + 2, eave], [peak, 15], [right + 7, 40]];
  pitch('#d19488', rim, glint);
  R(c, right + 1, 37, 8, 32, '#80525a');
  R(c, right + 1, 43, 2, 26, '#bc8274');
  c.save();
  housePath(c, [...underside, [right - 5, eave], [left + 17, eave]]);
  c.clip();
  const plaster = c.createLinearGradient(0, 20, 0, eave);
  plaster.addColorStop(0, '#f1c395');
  plaster.addColorStop(.65, '#ffe4be');
  plaster.addColorStop(1, '#edc198');
  c.fillStyle = plaster;
  c.fillRect(left, 20, W, eave - 20);
  housePoly(c, '#ce9b7666', [left + 13, eave], [left + 67, 49], [left + 67, eave]);
  for (let x = left + 72; x < right; x += 24) detail(c, x, 23, .5, 45, '#bc886818');
  c.restore();
  R(c, left + 65, 49, 3, 21, '#a38877');
  R(c, left + 69, 62, W - 76, 8, '#d7b18c');
  for (let y = 63; y < eave; y += 2) R(c, left + 69, y, W - 76, 1, '#c5a07f');
  for (const [x, y, w, h] of [[peak - 48, 52, 24, 14], [peak - 22, 45, 15, 21], [peak - 3, 41, 22, 25], [right - 42, 54, 18, 12], [right - 23, 48, 15, 18]]) {
    bevel(c, x, y, w, h, '#bb8962', '#9a674f');
    R(c, x + 1, y + 1, w - 2, 2, '#e4b48a');
    R(c, x + w - 5, y + 3, 4, h - 4, '#a47455');
    detail(c, x + 2, y + h - 3, w - 8, .5, '#d29b73');
    R(c, x + 3, y + 3, w - 10, 1, '#d9b489');
    R(c, x + w - 9, y + 5, 3, 2, '#a27b62');
    detail(c, x + w - 9, y + 5, 2.5, .5, '#ebc292');
  }
  box(c, peak + 26, 31, 13, 15, '#f5e9d5', '#9b8074');
  R(c, peak + 28, 33, 9, 10, G.sky);
  R(c, peak + 32, 33, 1, 10, '#f5e9d5');
  R(c, peak + 28, 37, 9, 1, '#f5e9d5');
  R(c, peak + 24, 46, 17, 2, '#b38e76');
}

function drawRoomDetails(c, x, right, top, back, storey, i) {
  if (i === 0) {
    const upper = storey === STOREYS[1];
    const start = x + 10, stop = right - 10, y = top + 11;
    const fabric = upper ? '#4a4963' : '#fff1e5';
    for (let j = 0; j < 3; j++) {
      const a = start + (stop - start) * j / 3, b = start + (stop - start) * (j + 1) / 3;
      housePoly(c, fabric, [a, y], [a + 6, y + 4], [b - 6, y + 4], [b, y],
        [b - 5, y + 7], [a + 5, y + 7]);
      R(c, a - 1, y - 1, 3, 3, upper ? '#b9a6c8' : '#cc858b');
    }
    R(c, stop - 1, y - 1, 3, 3, upper ? '#b9a6c8' : '#cc858b');
    if (!upper) {
      const lampX = x + Math.floor((right - x) * .5);
      R(c, lampX, top + 2, 1, 11, '#976b61');
      R(c, lampX - 8, top + 12, 17, 2, '#976b61');
      for (const [j, dx] of [-8, 0, 8].entries()) {
        const drop = j === 1 ? 6 : 3;
        R(c, lampX + dx, top + 13, 1, drop, '#a77962');
        bevel(c, lampX + dx - 2, top + 13 + drop, 5, 5, '#ffe4ae', '#c89174');
        R(c, lampX + dx - 1, top + 14 + drop, 2, 2, '#fff4cf');
      }
      R(c, x + 14, back - 31, 42, 4, '#cc8d97');
      housePoly(c, '#fff2e5', [x + 14, back - 28], [x + 19, back - 28],
        [x + 18, back - 11], [x + 13, back - 9]);
      housePoly(c, '#fff2e5', [x + 51, back - 28], [x + 56, back - 28],
        [x + 57, back - 9], [x + 52, back - 11]);
    }
  } else {
    const ink = storey === STOREYS[1] ? '#f2e0df' : '#fff2db';
    for (let px = x + 12; px + 19 < right; px += 32) {
      R(c, px, top + 15, 18, 1, ink);
      R(c, px, top + 15, 1, 26, ink);
      R(c, px + 17, top + 15, 1, 26, ink);
    }
  }
}

function drawRoomFloor(c, x, end, back, front, base, pattern) {
  const width = end - x;
  const edge = shade(base, -.085), light = shade(base, .055);
  R(c, x, back, width, front - back, base);
  if (pattern === 'tile') {
    for (let y = back; y < front; y += 5) {
      R(c, x, y, width, 1, '#abc9bb');
      for (let px = x + (y - back) % 2 * 5; px < end; px += 10) {
        R(c, px, y, 1, 5, '#b7d1c4');
        R(c, px + 1, y + 1, 7, 1, '#deebe1');
      }
    }
  } else if (pattern === 'plank' && cottageArtReady()) {
    c.save();
    c.globalAlpha *= .62;
    c.beginPath();
    c.rect(x, back, width, front - back);
    c.clip();
    for (let px = x; px < end; px += 56) drawCottageSprite(c, 'oak', px, back, 56, front - back);
    c.restore();
  } else if (pattern === 'plank') {
    for (let y = back; y < front; y += 5) {
      detail(c, x, y, width, .5, edge);
      detail(c, x, y + .5, width, .5, light);
      for (let px = x + 7 + ((y - back) * 7) % 36; px < end; px += 36) {
        detail(c, px, y + .5, .5, 4.5, edge);
        const span = 5 + Math.floor(rnd(px + y) * 13);
        detail(c, px + 3, y + 2.5, span, .5, light);
        if ((px + y) % 3 === 0) detail(c, px + 5, y + 3.5, 3, .5, edge);
      }
    }
  } else {
    for (let i = 0; i < width / 2; i++) {
      const px = x + rnd(i + 7) * width, y = back + rnd(i + 39) * (front - back);
      detail(c, px, y, i % 3 === 0 ? 1.5 : .5, .5, i % 4 ? light : edge);
    }
  }
  const contact = c.createLinearGradient(0, back, 0, back + 11);
  contact.addColorStop(0, '#4b354344');
  contact.addColorStop(1, '#4b354300');
  c.fillStyle = contact;
  c.fillRect(x, back, width, 11);
}

function drawStorey(c, storey, wall, floor) {
  const left = HOUSE_X, right = left + W, mid = left + BX * T;
  const { back, front, wall: top } = storey;
  const bathEdge = G.bathroom && storey === STOREYS[1] ? left + BATH_X * T : left;
  const spans = [[0, bathEdge, mid], [1, mid, right]];
  if (bathEdge > left) spans.unshift([2, left, bathEdge]);
  for (const [i, x, end] of spans) {
    const bath = i === 2;
    const base = bath ? '#b5d8ce' : wall.id === 'cream' ? storey.rooms[i] : shade(wall.base, i ? .01 : -.05);
    const alt = wall.id === 'cream' ? shade(base, .032) : wall.alt;
    const floorBase = bath ? '#d1e4dd' : floor.id === 'oak' ? storey.floors[i] : floor.base;
    const inset = 9;

    c.save();
    housePath(c, [[x, front], [x + inset, back], [end - inset, back], [end, front]]);
    c.clip();
    if (bath || floor.id === 'oak') {
      const pattern = bath ? 'tile' : (i === 0 && storey === STOREYS[1]) ? 'carpet' : 'plank';
      drawRoomFloor(c, x, end, back, front, floorBase, pattern);
    } else {
      c.translate(left, back);
      c.scale(1, FLOOR_STEP / T);
      c.translate(0, -storey.row * T);
      drawFloor(c, { ...floor, base: floorBase, alt: shade(floorBase, -.09) },
        storey.row * T, (storey === STOREYS[1] ? ROWS : FLOOR_SPLIT) * T);
    }
    c.restore();

    R(c, x, top, end - x, back - top, base);
    c.save();
    c.beginPath();
    c.rect(x + inset, top, end - x - inset * 2, back - top - 1);
    c.clip();
    c.translate(left, top);
    if (bath) {
      R(c, x - left, back - top - 36, end - x, 36, '#e4eee6');
      for (let row = back - top - 36; row < back - top; row += 8) {
        R(c, x - left, row, end - x, 1, '#a9cbc4');
        for (let col = x - left + (row % 16); col < end - left; col += 16) R(c, col, row, 1, 8, '#b7d4ca');
      }
      R(c, x - left, back - top - 37, end - x, 1, '#83b4aa');
    } else drawWall(c, { ...wall, base, alt }, back - top);
    c.restore();
    housePoly(c, shade(base, -.10), [x, top], [x + inset, top + 6], [x + inset, back], [x, front]);
    housePoly(c, shade(base, -.045), [end, top], [end - inset, top + 6], [end - inset, back], [end, front]);
    const panelWidth = end - x - inset * 2;
    R(c, x + inset, back - 12, panelWidth, 10, shade(base, .08));
    for (let px = x + inset + 4; px + 11 < end - inset; px += 16) {
      const border = shade(base, -.025), face = shade(base, .11);
      bevel(c, px, back - 10, 12, 7, face, border);
      detail(c, px + 2, back - 9, 8, .5, shade(base, .17));
    }
    R(c, x + inset, back - 13, end - x - inset * 2, 1, shade(base, -.09));
    R(c, x + inset, back - 2, end - x - inset * 2, 2, shade(base, -.13));
    const ceilingShade = c.createLinearGradient(0, top, 0, top + 14);
    ceilingShade.addColorStop(0, '#56334442');
    ceilingShade.addColorStop(1, '#56334400');
    c.fillStyle = ceilingShade;
    c.fillRect(x, top, end - x, 14);
    R(c, x + inset, back - 14, end - x - inset * 2, 1, '#fff0d38e');
    if (!bath && wall.id === 'cream') drawRoomDetails(c, x, end, top, back, storey, i);
  }
  for (const x of bathEdge > left ? [bathEdge, mid] : [mid]) {
    R(c, x - 2, top, 5, front - top, '#8a615c');
    R(c, x - 2, top, 1, front - top, '#d1a68a');
    R(c, x + 2, top, 1, front - top, '#67454d');
  }
}

function drawHouseStairs(c) {
  const edge = HOUSE_X + W;
  const top = stairPoint(0).y, bottom = stairPoint(1).y;
  R(c, edge + 4, top - 10, 29, bottom - top + 15, '#ad846b');
  R(c, edge + 33, top - 10, 3, 252 - top + 10, '#80605c');
  R(c, edge + 33, top - 10, 1, 252 - top + 10, '#d0a386');
  R(c, edge - 5, top - 1, 17, 4, '#c4a384');
  R(c, edge - 5, bottom - 1, 38, 4, '#c4a384');
  housePoly(c, '#a08272', [edge + 2, top], [edge + 14, top],
    [edge + 33, bottom], [edge + 22, bottom]);
  for (let i = 0; i <= 16; i++) {
    const p = stairPoint(.2 + .6 * i / 16);
    R(c, p.x - 5, p.y - 1, 11, 2, '#f2d1a9');
    R(c, p.x - 5, p.y + 1, 11, 2, '#957768');
    if (i % 4 === 0) R(c, p.x + 4, p.y - 9, 1, 9, '#826b63');
  }
  housePoly(c, '#76625e', [edge + 12, top - 10], [edge + 32, bottom - 10],
    [edge + 32, bottom - 8], [edge + 12, top - 8]);
}

function drawHouseShell(c, wall, floor) {
  const l = HOUSE_X, r = l + W;
  drawHouseGarden(c, l, r);
  drawHouseRoof(c, l, r);
  for (const storey of STOREYS) drawStorey(c, storey, wall, floor);
  for (const [y, h] of [[69, 5], [158, 7], [252, 6]]) {
    R(c, l - 4, y, W + 8, h, '#76504c');
    R(c, l - 3, y + 1, W + 6, 2, '#dfb18d');
    detail(c, l - 3, y + 1, W + 6, .5, '#f3c9a2');
    R(c, l - 3, y + 3, W + 6, 1, '#b47e65');
    if (h > 5) {
      for (let x = l + 4; x < r - 12; x += 27) detail(c, x, y + 4.5, 10, .5, '#a36e59');
      detail(c, l - 2, y + h - 1, W + 4, .5, '#d09170');
    }
  }
  for (const x of [l - 4, r]) {
    for (const { wall: y, front } of STOREYS) {
      R(c, x, y, 4, front - y, '#a97c65');
      detail(c, x + .5, y, .5, front - y, '#e9bd99');
      detail(c, x + 3, y, 1, front - y, '#744f4c');
    }
  }
  drawHouseStairs(c);
}
