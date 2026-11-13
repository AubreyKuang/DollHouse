// Two cutaway storeys over the existing simulation grid. The front edges
// are shallow in screen space while the back walls and sprites stay upright.
const HOUSE_X = 14;
const HOUSE_HEIGHT = 310;
const HOUSE_MARGIN = 76;
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
  if (progress < .2) return { x: mixNum(x, edge + 10, progress / .2), y: top };
  if (progress > .8) return { x: mixNum(edge + 42, x, (progress - .8) / .2), y: bottom };
  const t = (progress - .2) / .6;
  return { x: mixNum(edge + 10, edge + 42, t), y: mixNum(top, bottom, t) };
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
  const center = (left + right) / 2, eave = 70;
  // The two pitches share one center and one eave height at every house size.
  housePoly(c, '#76505a', [left - 8, eave], [center, 7], [right + 8, eave]);
  housePoly(c, '#c18a82', [left - 3, eave], [center, 12], [right + 3, eave]);
  housePoly(c, '#f4d6b3', [left + 12, eave], [center, 20], [right - 12, eave]);
  housePoly(c, '#ffe5c3', [left + 20, eave], [center, 24], [right - 20, eave]);

  // A single centered attic window keeps the gable light and uncluttered.
  const x = center - 10, y = 35;
  bevel(c, x - 2, y - 2, 24, 25, '#b58c75', '#a37b69');
  bevel(c, x, y, 20, 21, '#fff0d6', '#dfb998');
  R(c, x + 3, y + 3, 14, 15, G.sky);
  if (G.night) R(c, x + 12, y + 5, 2, 2, '#fff3c6');
  else R(c, x + 4, y + 7, 5, 2, '#fff7e7');
  R(c, center - 1, y + 2, 2, 17, '#fff0d6');
  R(c, x + 2, y + 10, 16, 2, '#fff0d6');
  R(c, x - 3, y + 22, 26, 2, '#c69b7c');
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
  }
  for (const x of bathEdge > left ? [bathEdge, mid] : [mid]) {
    R(c, x - 2, top, 5, front - top, '#8a615c');
    R(c, x - 2, top, 1, front - top, '#d1a68a');
    R(c, x + 2, top, 1, front - top, '#67454d');
  }
}

function drawHouseStairs(c) {
  const edge = HOUSE_X + W;
  const start = stairPoint(.2), end = stairPoint(.8);
  const steps = 12, halfWidth = 9;
  const rise = (end.y - start.y) / steps;
  // One continuous stair body replaces the old backboard and floating stripes.
  housePoly(c, '#a57e67', [start.x - halfWidth, start.y], [start.x + halfWidth, start.y],
    [end.x + halfWidth, end.y + 4], [end.x - halfWidth, end.y + 4]);
  for (let i = 0; i < steps; i++) {
    const p = stairPoint(.2 + .6 * i / steps);
    const x = Math.round(p.x) - halfWidth, y = Math.round(p.y);
    R(c, x, y, halfWidth * 2, Math.ceil(rise) + 1, '#b38c70');
    R(c, x, y, halfWidth * 2, 2, '#eed1aa');
    R(c, x, y + 2, halfWidth * 2, 1, '#d4ac85');
  }
  // Landings, posts and rail meet the same stair coordinates used by residents.
  for (const p of [start, end]) {
    R(c, edge - 3, Math.round(p.y), p.x + halfWidth - edge + 3, 4, '#b38c70');
    R(c, edge - 3, Math.round(p.y), p.x + halfWidth - edge + 3, 2, '#eed1aa');
  }
  const rail = [start, end].map(p => ({ x: Math.round(p.x) + halfWidth, y: Math.round(p.y) }));
  for (let i = 0; i <= 3; i++) {
    const p = stairPoint(.2 + .6 * i / 3);
    R(c, Math.round(p.x) + halfWidth - 1, Math.round(p.y) - 10, 2, 14, '#98745f');
  }
  housePoly(c, '#98745f', [rail[0].x - 1, rail[0].y - 12], [rail[1].x + 1, rail[1].y - 12],
    [rail[1].x + 1, rail[1].y - 9], [rail[0].x - 1, rail[0].y - 9]);
  R(c, rail[1].x - 1, rail[1].y + 4, 3, STOREYS[0].front - rail[1].y - 4, '#98745f');
}

function drawHouseShell(c, wall, floor) {
  const l = HOUSE_X, r = l + W;
  drawHouseGarden(c, l, r);
  drawHouseRoof(c, l, r);
  for (const storey of STOREYS) drawStorey(c, storey, wall, floor);
  for (const [y, h] of [[69, 5], [158, 7], [252, 6]]) {
    R(c, l - 4, y, W + 8, h, '#916953');
    R(c, l - 3, y + 1, W + 6, h - 2, '#c69d79');
    R(c, l - 3, y + 1, W + 6, 1, '#ebc9a2');
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
