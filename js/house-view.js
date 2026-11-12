// Two cutaway storeys over the existing simulation grid. The front edges
// are shallow in screen space while the back walls and sprites stay upright.
const HOUSE_X = 14;
const HOUSE_HEIGHT = 266;
const HOUSE_MARGIN = 60;
const FLOOR_STEP = 3;
const WALL_STEP = 18;
const STOREYS = [
  { wall: 165, back: 225, front: 252, row: WALL_ROWS, wallRow: 0,
    rooms: ['#efc5c3', '#f4e6cb'], floors: ['#d7b6af', '#bf9d73'] },
  { wall: 74, back: 134, front: 158, row: FLOOR_SPLIT, wallRow: UPPER_WALL,
    rooms: ['#666780', '#d9c5cc'], floors: ['#655c70', '#a7b9aa'] },
];
const storeyOf = row => STOREYS[+(row < 0 || row >= FLOOR_SPLIT)];

function houseY(y, storey) {
  return storey.back + (y - storey.row * T) * FLOOR_STEP / T;
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
  if (d.act?.onFurn) {
    const f = d.act.furn;
    return { x: HOUSE_X + d.x, y: houseFurnitureRect(f).y + d.y - f.y * T };
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
  const storey = p.y < STOREYS[0].wall ? STOREYS[1] : STOREYS[0];
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
  const y = storey.row + (p.y - storey.back) / FLOOR_STEP;
  const end = storey === STOREYS[1] ? ROWS : FLOOR_SPLIT;
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
  R(c, 0, 231, width, HOUSE_HEIGHT - 231, '#a6b597');
  R(c, 0, 259, width, 7, '#bdc7a6');
  R(c, left - 5, 258, right - left + 44, 4, '#83947e');
  for (const [x, y] of [[4, 38], [right + 12, 62], [right - 28, 14]]) {
    R(c, x, y + 6, 22, 4, '#f4f6ebbb');
    R(c, x + 4, y + 2, 14, 6, '#f4f6ebbb');
    R(c, x + 8, y, 6, 3, '#f4f6ebbb');
  }
  for (let i = 0; i < 34; i++) {
    const x = rnd(i + 690) * width, y = 261 + rnd(i + 810) * 5;
    R(c, x, y, 2, 1, i % 5 === 0 ? '#e9d1a5' : '#97a885');
  }
}

function drawHouseRoof(c, left, right) {
  const peak = left + Math.round(W * .58), eave = 70;
  housePoly(c, '#60545b', [left - 7, eave], [peak, 7], [right + 9, 32], [right + 9, eave]);
  housePoly(c, '#946d70', [left - 4, eave], [peak, 11], [right + 6, 36], [right + 6, eave]);
  housePoly(c, '#e5c9a8', [left + 2, eave], [peak, 19], [right - 1, 41], [right - 1, eave]);
  housePoly(c, '#f4e0c3', [left + 13, eave], [peak, 23], [right - 8, 44], [right - 8, eave]);
  housePoly(c, '#cfad8c', [left + 13, eave], [left + 67, 49], [left + 67, eave]);
  R(c, left + 65, 49, 3, 21, '#a38877');
  R(c, left + 69, 62, W - 76, 8, '#d7b18c');
  for (let y = 63; y < eave; y += 2) R(c, left + 69, y, W - 76, 1, '#c5a07f');
  for (const [x, y, w, h] of [[peak - 48, 52, 24, 14], [peak - 22, 45, 15, 21], [peak - 3, 41, 22, 25], [right - 42, 54, 18, 12], [right - 23, 48, 15, 18]]) {
    R(c, x, y, w, h, '#b9916c');
    R(c, x, y, w, 2, '#d2ab81');
    R(c, x + w - 5, y + 2, 5, h - 2, '#987457');
    R(c, x + 3, y + 3, w - 10, 1, '#d9b489');
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

function drawStorey(c, storey, wall, floor) {
  const left = HOUSE_X, right = left + W, mid = left + BX * T;
  const { back, front, wall: top } = storey;
  for (const [i, x, end] of [[0, left, mid], [1, mid, right]]) {
    const base = wall.id === 'cream' ? storey.rooms[i] : shade(wall.base, i ? .01 : -.05);
    const alt = wall.id === 'cream' ? shade(base, .045) : wall.alt;
    const floorBase = floor.id === 'oak' ? storey.floors[i] : floor.base;
    const inset = 9;

    c.save();
    housePath(c, [[x, front], [x + inset, back], [end - inset, back], [end, front]]);
    c.clip();
    c.translate(left, back);
    c.scale(1, FLOOR_STEP / T);
    c.translate(0, -storey.row * T);
    drawFloor(c, { ...floor, base: floorBase, alt: shade(floorBase, -.06) },
      storey.row * T, (storey === STOREYS[1] ? ROWS : FLOOR_SPLIT) * T);
    c.restore();

    R(c, x, top, end - x, back - top, base);
    c.save();
    c.beginPath();
    c.rect(x + inset, top, end - x - inset * 2, back - top - 1);
    c.clip();
    c.translate(left, top);
    drawWall(c, { ...wall, base, alt }, back - top);
    c.restore();
    housePoly(c, shade(base, -.10), [x, top], [x + inset, top + 6], [x + inset, back], [x, front]);
    housePoly(c, shade(base, -.045), [end, top], [end - inset, top + 6], [end - inset, back], [end, front]);
    R(c, x + inset, back - 12, end - x - inset * 2, 10, shade(base, .085));
    for (let px = x + inset + 3; px < end - inset; px += 5) R(c, px, back - 10, 1, 7, shade(base, -.025));
    R(c, x + inset, back - 13, end - x - inset * 2, 1, shade(base, -.09));
    R(c, x + inset, back - 2, end - x - inset * 2, 2, shade(base, -.13));
    R(c, x, top, end - x, 3, '#49364d28');
    if (wall.id === 'cream') drawRoomDetails(c, x, end, top, back, storey, i);
  }
  R(c, mid - 2, top, 5, front - top, '#928482');
  R(c, mid - 2, top, 1, front - top, '#c7b5a9');
  R(c, mid + 2, top, 1, front - top, '#6f656c');
}

function drawHouseStairs(c) {
  const edge = HOUSE_X + W;
  const top = stairPoint(0).y, bottom = stairPoint(1).y;
  R(c, edge + 4, top - 10, 29, bottom - top + 15, '#b6a596');
  R(c, edge + 33, top - 10, 3, 252 - top + 10, '#897a77');
  R(c, edge + 33, top - 10, 1, 252 - top + 10, '#c5b2a2');
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
    R(c, l - 4, y, W + 8, h, '#807471');
    R(c, l - 3, y + 1, W + 6, 2, '#c6b6ab');
    R(c, l - 3, y + 3, W + 6, 1, '#a3948d');
    if (h > 5) for (let x = l + 1; x < r; x += 9) R(c, x, y + 4, 1, 2, '#938480');
  }
  for (const x of [l - 4, r]) {
    R(c, x, STOREYS[1].wall, 4, STOREYS[0].front - STOREYS[1].wall, '#958684');
    R(c, x + 1, STOREYS[1].wall, 1, STOREYS[0].front - STOREYS[1].wall, '#c7b5a9');
  }
  drawHouseStairs(c);
}
