import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync, deflateSync } from 'node:zlib';
import { decodePNG, encodePNG, decodeBMP, grayscale, resample, otsu, classify, imageToBitmap, imageToSketch, renderHalfblocks, RAMPS } from '../index.js';

const inflate = (b) => inflateSync(b), deflate = (b) => deflateSync(b);
const image = (w, h, fn) => { const data = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4); return { width: w, height: h, data }; };
const white = [255, 255, 255, 255], black = [0, 0, 0, 255];
const disc = (w, h, r, fg, bgc) => image(w, h, (x, y) => (Math.hypot(x - w / 2 + 0.5, y - h / 2 + 0.5) <= r ? fg : bgc));
const onCount = (bitmap) => bitmap.cells.flat().filter((c) => c !== null).length;

test('PNG round trip through our encoder and decoder', async () => {
  const src = image(5, 3, (x, y) => [x * 50, y * 100, 7, x === 2 ? 128 : 255]);
  const out = await decodePNG(await encodePNG(src, deflate), inflate);
  assert.deepEqual([out.width, out.height], [5, 3]);
  assert.deepEqual([...out.data], [...src.data]);
});

// a PNG writer for the tests: any color type, bit depth, and per-row filter, so the decoder's unfiltering and unpacking are exercised
function png({ width, height, depth, type, rows, palette, trns, filters, interlace = 0 }) {
  const chan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], stride = Math.ceil((width * chan * depth) / 8), bpp = Math.max(1, (chan * depth) >> 3);
  const raw = [];
  let prev = new Uint8Array(stride);
  rows.forEach((row, y) => {
    const f = filters[y % filters.length];
    raw.push(f);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c), pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      raw.push((row[x] - (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pred)) & 255);
    }
    prev = Uint8Array.from(row);
  });
  const be32 = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const chunk = (name, body) => { const nb = [...name].map((ch) => ch.charCodeAt(0)); let c = -1; for (const v of [...nb, ...body]) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return [...be32(body.length), ...nb, ...body, ...be32((c ^ -1) >>> 0)]; };
  const parts = [[137, 80, 78, 71, 13, 10, 26, 10], chunk('IHDR', [...be32(width), ...be32(height), depth, type, 0, 0, interlace])];
  if (palette) parts.push(chunk('PLTE', palette));
  if (trns) parts.push(chunk('tRNS', trns));
  parts.push(chunk('IDAT', [...deflateSync(Uint8Array.from(raw))]), chunk('IEND', []));
  return Uint8Array.from(parts.flat());
}

test('PNG decoder: every filter type, 1-bit and 16-bit gray, palette with transparency, gray with alpha, and a refusal of interlacing', async () => {
  const rgb = await decodePNG(png({ width: 4, height: 5, depth: 8, type: 2, filters: [0, 1, 2, 3, 4], rows: Array.from({ length: 5 }, (_, y) => Array.from({ length: 12 }, (_, i) => (i * 37 + y * 91) & 255)) }), inflate);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) for (let c = 0; c < 3; c++) assert.equal(rgb.data[(y * 4 + x) * 4 + c], ((x * 3 + c) * 37 + y * 91) & 255);
  const g1 = await decodePNG(png({ width: 8, height: 1, depth: 1, type: 0, filters: [0], rows: [[0b10100000]] }), inflate);
  assert.deepEqual([g1.data[0], g1.data[4], g1.data[8], g1.data[12]], [255, 0, 255, 0]);
  const g16 = await decodePNG(png({ width: 2, height: 1, depth: 16, type: 0, filters: [2], rows: [[0x12, 0x34, 0xab, 0xcd]] }), inflate);
  assert.deepEqual([g16.data[0], g16.data[4]], [0x12, 0xab]);
  const pal = await decodePNG(png({ width: 2, height: 1, depth: 8, type: 3, filters: [1], rows: [[0, 1]], palette: [10, 20, 30, 40, 50, 60], trns: [255, 0] }), inflate);
  assert.deepEqual([...pal.data], [10, 20, 30, 255, 40, 50, 60, 0]);
  const ga = await decodePNG(png({ width: 1, height: 2, depth: 8, type: 4, filters: [4], rows: [[100, 200], [50, 25]] }), inflate);
  assert.deepEqual([...ga.data], [100, 100, 100, 200, 50, 50, 50, 25]);
  await assert.rejects(decodePNG(png({ width: 1, height: 1, depth: 8, type: 0, filters: [0], rows: [[0]], interlace: 1 }), inflate), /interlaced/);
});

test('BMP decoder: 24-bit bottom-up and 32-bit top-down', () => {
  const bmp = (w, h, bpp, topDown, pixels) => {
    const stride = Math.floor((bpp * w + 31) / 32) * 4, size = 54 + stride * h, b = new Uint8Array(size);
    const le32 = (i, v) => { b[i] = v & 255; b[i + 1] = (v >> 8) & 255; b[i + 2] = (v >> 16) & 255; b[i + 3] = (v >>> 24) & 255; };
    b[0] = 0x42; b[1] = 0x4d; le32(2, size); le32(10, 54); le32(14, 40); le32(18, w); le32(22, topDown ? -h : h); b[26] = 1; b[28] = bpp; le32(30, 0);
    pixels.forEach((row, y) => row.forEach(([r, g, bl, a], x) => { const i = 54 + (topDown ? y : h - 1 - y) * stride + x * (bpp / 8); b[i] = bl; b[i + 1] = g; b[i + 2] = r; if (bpp === 32) b[i + 3] = a; }));
    return b;
  };
  const a = decodeBMP(bmp(2, 2, 24, false, [[[1, 2, 3], [4, 5, 6]], [[7, 8, 9], [10, 11, 12]]]));
  assert.deepEqual([...a.data], [1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
  const b = decodeBMP(bmp(1, 2, 32, true, [[[1, 2, 3, 4]], [[5, 6, 7, 8]]]));
  assert.deepEqual([...b.data], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('grayscale composites transparency over the background, and resample averages areas', () => {
  const g = grayscale(image(2, 1, (x) => (x ? [0, 0, 0, 0] : black)), { bg: 255 });
  assert.deepEqual([...g.data], [0, 255]);
  const r = resample({ width: 4, height: 2, data: Float32Array.from([0, 0, 200, 200, 100, 100, 200, 200]) }, 2, 1);
  assert.deepEqual([...r.data], [50, 200]);
});

test('Otsu splits a checkerboard cleanly and calls it a logo; a gradient is a photo', () => {
  const board = grayscale(image(8, 8, (x, y) => ((x + y) % 2 ? white : black)));
  const o = otsu(board);
  assert.ok(o.threshold >= 0 && o.threshold < 255 && o.separability > 0.99);
  assert.equal(classify(board).kind, 'logo');
  const grad = grayscale(image(120, 60, (x) => [Math.round((x * 255) / 119), Math.round((x * 255) / 119), Math.round((x * 255) / 119), 255]));
  assert.equal(classify(grad).kind, 'photo');
});

test('bitmap mode: a black disc on white is the ink; a white disc on black inverts on its own', () => {
  const dark = imageToBitmap(disc(64, 64, 20, black, white), { cols: 32 });
  assert.deepEqual([dark.bitmap.width, dark.bitmap.height, dark.inkDark, dark.kind], [32, 32, true, 'logo']);
  assert.equal(dark.bitmap.cells[16][16], '#');
  assert.equal(dark.bitmap.cells[0][0], null);
  const n = onCount(dark.bitmap);
  assert.ok(n > 270 && n < 360, `disc area about 314 pixels, got ${n}`);
  const light = imageToBitmap(disc(64, 64, 20, white, black), { cols: 32 });
  assert.equal(light.inkDark, false);
  assert.equal(light.bitmap.cells[16][16], '#');
  assert.equal(light.bitmap.cells[0][0], null);
  assert.equal(renderHalfblocks(dark.bitmap), renderHalfblocks(light.bitmap));
});

test('bitmap mode fits the row limit by shrinking, keeps an even height, and despeckles', () => {
  const tall = imageToBitmap(disc(64, 64, 20, black, white), { cols: 78, maxRows: 10 });
  assert.equal(tall.bitmap.height, 20);
  assert.equal(tall.bitmap.width, 20);
  const speck = image(16, 16, (x, y) => (x === 8 && y === 8 ? black : white));
  assert.equal(onCount(imageToBitmap(speck, { cols: 16 }).bitmap), 0);
  assert.equal(onCount(imageToBitmap(speck, { cols: 16, despeckle: false }).bitmap), 1);
});

test('dither turns mid gray into a mix; a threshold turns it into one tone', () => {
  const gray = image(40, 40, () => [128, 128, 128, 255]);
  const d = onCount(imageToBitmap(gray, { cols: 40, dither: true, despeckle: false }).bitmap) / 1600;
  assert.ok(d > 0.35 && d < 0.65, `about half on, got ${d}`);
  const t = onCount(imageToBitmap(gray, { cols: 40, ink: 'dark', despeckle: false }).bitmap);
  assert.ok(t === 0 || t === 1600);
});

test('sketch mode: a low-contrast silhouette shows a boundary on the dim side, not only the bright side', () => {
  // A disk on a dark wall, one half slightly brighter than the wall, the other clearly bright.
  // Global-max edge normalization is dominated by the bright arc, so the dim arc's boundary vanishes.
  const w = 120, h = 60, cx = 60, cy = 30, r = 20;
  const pixels = image(w, h, (x, y) => {
    const inside = Math.hypot(x - cx + 0.5, y - cy + 0.5) <= r;
    return inside ? (x < cx ? [55, 55, 55, 255] : [220, 220, 220, 255]) : [40, 40, 40, 255];
  });
  const s = imageToSketch(pixels, { cols: 60 });
  const rows = s.text.split('\n').filter((r) => r !== '');
  const strokes = (str) => (str.match(/[-\\|\/]/g) || []).length;
  const dimBoundary = rows.slice(4, 9).map((r) => r.slice(18, 22)).join('');
  const brightBoundary = rows.slice(4, 9).map((r) => r.slice(38, 42)).join('');
  assert.ok(strokes(brightBoundary) >= 3, `expected the bright arc drawn as strokes, got "${brightBoundary}"`);
  assert.ok(strokes(dimBoundary) >= 3, `expected the dim arc drawn as strokes, got "${dimBoundary}"\n${s.text}`);
});

test('sketch mode: a gradient climbs the ramp, edges become strokes, and the floor is 60 columns', () => {
  const grad = image(120, 60, (x) => [Math.round((x * 255) / 119), Math.round((x * 255) / 119), Math.round((x * 255) / 119), 255]);
  const s = imageToSketch(grad, { cols: 60, edges: 0, ramp: 'short' });   // the long ramp repeats three characters, so the short one proves the climb
  assert.deepEqual([s.cols, s.rows], [60, 15]);
  const ramp = [...RAMPS.short], row = [...s.text.split('\n')[7]];
  const idx = row.map((ch) => ramp.indexOf(ch));
  assert.ok(idx.every((v, i) => i === 0 || v >= idx[i - 1]), 'ramp index never falls along the gradient');
  assert.equal(idx[idx.length - 1], ramp.length - 1);
  const long = [...RAMPS.long];
  assert.equal([...imageToSketch(grad, { cols: 60, edges: 0 }).text.split('\n')[7]].pop(), long[long.length - 1]);
  const light = imageToSketch(grad, { cols: 60, edges: 0, ground: 'light', ramp: 'short' });
  assert.equal([...light.text.split('\n')[7]][0], ramp[ramp.length - 1]);
  const split = image(120, 60, (x) => (x < 60 ? black : white));
  const e = imageToSketch(split, { cols: 60, edges: 0.3 });
  const bars = e.text.split('\n').filter((r) => r.includes('|')).length;
  assert.ok(bars >= 12, `a vertical edge draws | on most rows, got ${bars}`);
  const hsplit = image(120, 60, (x, y) => (y < 30 ? black : white));
  assert.ok(imageToSketch(hsplit, { cols: 60, edges: 0.3 }).text.split('\n').some((r) => (r.match(/-/g) || []).length > 40), 'a horizontal edge draws a row of -');
  assert.throws(() => imageToSketch(grad, { cols: 40 }), /60 columns or more/);
  assert.throws(() => imageToSketch(grad, { cols: 60, ramp: 'nope' }), /unknown ramp/);
});
