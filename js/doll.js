// Each atlas row is a transparent part, with front, profile and back columns.
// Neutral pixels carry material shading. Colored stitching, trim and eyes
// keep their painted colors when a player changes a swatch.
const dollAtlas = document.getElementById('dollAtlas');
const DOLL_TILE = 96;
const DOLL_PARTS = Object.fromEntries([
  'head', 'eyes', 'blink', 'smile', 'short', 'long', 'twin', 'bun', 'spiky', 'bob',
  'tee', 'hoodie', 'dress', 'overall', 'stripe', 'suit', 'cardigan',
  'pants', 'shorts', 'skirt', 'shoe', 'arm', 'hand',
  'cap', 'bow', 'glasses', 'phones', 'cat', 'flower', 'crown',
].map((part, row) => [part, row]));
const dollPalettes = new Map();
const starterSprites = ['p-tao', 'p-lan', 'p-jing', 'p-tuan'].map(pid =>
  DEFAULT_SAVE.dolls.find(doll => doll.pid === pid).look
);
const lookFields = Object.keys(starterSprites[0]);
const starterSpriteRow = Object.keys(DOLL_PARTS).length;

// The default outfits have a hand-painted front view. The last rows of the
// atlas keep these portraits at the same scale and foot anchor as the parts.
function drawStarterDoll(c, x, y, look, walking, frame) {
  const index = starterSprites.findIndex(outfit => lookFields.every(key => outfit[key] === look[key]));
  if (index === -1) return false;
  const sx = index % 3 * DOLL_TILE;
  const sy = (starterSpriteRow + Math.floor(index / 3)) * DOLL_TILE;
  c.save();
  c.imageSmoothingEnabled = true;
  const bob = walking && frame % 2 ? .65 : 0;
  const left = x - 12, top = y - 23.5 - bob;
  const step = walking && frame % 2;
  if (step) {
    const cuff = 85;
    c.drawImage(dollAtlas, sx, sy, 96, cuff, left, top, 24, cuff / 4);
    for (const foot of [0, 1]) {
      const shift = foot === (frame === 1 ? 0 : 1) ? -.8 : .4;
      c.drawImage(dollAtlas, sx + foot * 48, sy + cuff, 48, 96 - cuff,
        left + foot * 12, top + cuff / 4 + shift, 12, (96 - cuff) / 4);
    }
  } else {
    c.drawImage(dollAtlas, sx, sy, 96, 96, left, top, 24, 24);
  }
  c.restore();
  return true;
}

function dollArtReady() {
  return Boolean(dollAtlas?.complete && dollAtlas.naturalWidth);
}

function dollPart(c, part, direction, x, y, color) {
  const sx = direction * DOLL_TILE, sy = DOLL_PARTS[part] * DOLL_TILE;
  if (!color) {
    c.drawImage(dollAtlas, sx, sy, DOLL_TILE, DOLL_TILE, x, y, 48, 48);
    return;
  }

  const key = [part, direction, color].join(':');
  let tile = dollPalettes.get(key);
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = tile.height = DOLL_TILE;
    const layer = tile.getContext('2d');
    layer.drawImage(dollAtlas, sx, sy, DOLL_TILE, DOLL_TILE, 0, 0, DOLL_TILE, DOLL_TILE);
    const pixels = layer.getImageData(0, 0, DOLL_TILE, DOLL_TILE);
    const channels = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
    const midpoint = part === 'head' || part === 'hand' ? 190 : 148;
    const data = pixels.data;
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i];
      if (!data[i + 3] || Math.max(value, data[i + 1], data[i + 2]) - Math.min(value, data[i + 1], data[i + 2]) > 4) continue;
      const delta = value - midpoint;
      for (let j = 0; j < 3; j++) {
        const base = channels[j];
        data[i + j] = base + (delta < 0 ? delta * base / midpoint : delta * (255 - base) / (255 - midpoint));
      }
    }
    layer.putImageData(pixels, 0, 0);
    dollPalettes.set(key, tile);
  }
  c.drawImage(tile, x, y, 48, 48);
}

function drawDoll(c, cx, by, look, options = {}) {
  if (!dollArtReady()) return;
  const { dir = 'down', frame = 0, pose = 'stand', hop = 0, blink = false, happy = false } = options;
  const profile = dir === 'left' || dir === 'right';
  const direction = profile ? 1 : dir === 'up' ? 2 : 0;
  const sleeping = pose === 'head', sitting = pose === 'sit', walking = pose === 'walk';
  const skin = OUTFIT.skin[look.skin] || OUTFIT.skin[0];
  const hair = OUTFIT.hairColor[look.hairColor] || OUTFIT.hairColor[0];
  const top = OUTFIT.clothColor[look.topColor] || OUTFIT.clothColor[0];
  const bottom = OUTFIT.clothColor[look.bottomColor] || OUTFIT.clothColor[0];
  const shoe = OUTFIT.shoes[look.shoes] || OUTFIT.shoes[0];
  const hairStyle = Object.hasOwn(OUTFIT.hair, look.hair) ? look.hair : 'short';
  const topStyle = Object.hasOwn(OUTFIT.top, look.top) ? look.top : 'tee';
  const bottomStyle = Object.hasOwn(OUTFIT.bottom, look.bottom) ? look.bottom : 'pants';
  const bob = walking && frame % 2 ? -1.5 : pose === 'dance' ? -1 : 0;
  const x = Math.round(cx), y = Math.round(by);
  if (!sleeping && !sitting && pose !== 'lift') contactShadow(c, x - 6, y - 1, 12);
  if (dir === 'down' && (pose === 'stand' || walking) && drawStarterDoll(c, x, y - hop, look, walking, frame)) return;

  c.save();
  c.translate(x, y - hop);
  c.scale(dir === 'left' ? -.365 : .365, .365);
  c.translate(-24, sleeping ? -37 : sitting ? -55 : -65);
  c.imageSmoothingEnabled = true;
  const part = (id, px, py, color) => dollPart(c, id, direction, px, py, color);

  if (!sleeping) {
    const short = topStyle === 'dress' || (topStyle !== 'overall' && bottomStyle !== 'pants');
    const legs = profile ? [-3.5, 3.5] : [-6, 6];
    for (const [i, offset] of legs.entries()) {
      const stride = walking && frame % 2 ? (i === 0 ? frame - 2 : 2 - frame) : 0;
      const lift = walking ? (frame === (i ? 3 : 1) ? -4 : 0) : pose === 'dance' && i === frame % 2 ? -4 : 0;
      const foot = offset + stride * 2 + (sitting && profile ? 4 : 0);
      const legY = sitting ? 32 : 40;
      part('hand', foot, legY - 17 + lift, short ? skin : bottom);
      part('shoe', foot, legY + lift, shoe);
    }

    const bodyY = sitting ? 20 : 25 + bob;
    if (topStyle !== 'dress' && topStyle !== 'overall' && bottomStyle !== 'skirt') part(bottomStyle, 0, bodyY + 4, bottom);
    const arms = profile ? [-8] : [-11, 11];
    const drawArm = (offset, index) => {
      const raised = pose === 'lift' || (pose === 'dance' && index === frame % 2);
      const swing = walking ? Math.sin(frame * Math.PI / 2) * (index ? -1 : 1) : 0;
      c.save();
      c.translate(24 + offset, bodyY + 14);
      c.rotate(raised ? (offset < 0 ? 1.9 : -1.9) : swing * .24 + (sitting ? -.3 : 0));
      c.scale(.94, .79);
      part('hand', -24, -14, skin);
      part('arm', -24, -14, top);
      c.restore();
    };
    if (direction === 2) arms.forEach(drawArm);
    part(topStyle, 0, bodyY - (topStyle === 'dress' ? 4 : 0), top);
    if (topStyle === 'overall') {
      part('pants', 0, bodyY + 2, bottom);
      c.strokeStyle = bottom;
      c.lineWidth = 3.5;
      for (const a of [19, 29]) {
        c.beginPath();
        c.moveTo(a, bodyY + 12);
        c.lineTo(a, bodyY + 23);
        c.stroke();
        c.fillStyle = '#ecc584';
        c.fillRect(a - 1, bodyY + 20, 2, 2);
      }
    }
    if (topStyle !== 'dress' && topStyle !== 'overall' && bottomStyle === 'skirt') part('skirt', 0, bodyY + 4, bottom);
    if (direction !== 2) arms.forEach(drawArm);
  }

  part('head', 0, bob, skin);
  part(hairStyle, 0, bob, hair);
  part(sleeping || blink ? 'blink' : 'eyes', 0, bob);
  if (happy && !sleeping) part('smile', 0, bob);
  if (look.acc !== 'none' && Object.hasOwn(OUTFIT.acc, look.acc)) {
    part(look.acc, 0, bob, ['cap', 'phones'].includes(look.acc) ? top : null);
  }
  c.restore();
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
