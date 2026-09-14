// Images: RGBA pixel grids to bitmaps (threshold or dither) and to sketches (a tonal ramp with an edge pass).
import { RAMPS } from './ramps.js';

/** Luma per pixel, 0 to 255, with transparency composited over a background level. */
export function grayscale(image, { bg = 255 } = {}) {
  const { width, height, data } = image;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    out[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) * a + bg * (1 - a);
  }
  return { width, height, data: out };
}

/** Area-averaging resample of a gray grid to W by H. */
export function resample(gray, W, H) {
  const { width: w, height: h, data } = gray;
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const y0 = Math.floor((Y * h) / H), y1 = Math.min(h, Math.max(y0 + 1, Math.floor(((Y + 1) * h) / H)));
    for (let X = 0; X < W; X++) {
      const x0 = Math.floor((X * w) / W), x1 = Math.min(w, Math.max(x0 + 1, Math.floor(((X + 1) * w) / W)));
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += data[y * w + x]; n++; }
      out[Y * W + X] = n ? sum / n : 0;
    }
  }
  return { width: W, height: H, data: out };
}

/** The image's average color under each cell of a W by H grid, as W * H * 3 bytes. */
export function resampleRGB(image, W, H) {
  const { width, height, data } = image, out = new Uint8Array(W * H * 3);
  for (let c = 0; c < 3; c++) {
    const chan = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) chan[i] = data[i * 4 + c];
    const r = resample({ width, height, data: chan }, W, H);
    for (let i = 0; i < W * H; i++) out[i * 3 + c] = Math.round(r.data[i]);
  }
  return out;
}

/** Otsu's threshold, and how well two classes explain the image: 1 for two flat tones, about 0.75 for an even gradient, less for a photo. */
export function otsu(gray) {
  const hist = new Float64Array(256);
  for (const v of gray.data) hist[Math.max(0, Math.min(255, Math.round(v)))]++;
  const total = gray.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) { best = between; threshold = t; }
  }
  const mean = sum / total;
  let totalVar = 0;
  for (let i = 0; i < 256; i++) totalVar += hist[i] * (i - mean) ** 2;
  return { threshold, separability: totalVar ? best / (total * totalVar) : 0 };
}

/** A logo has two flat tones; a photo does not. */
export function classify(gray) {
  const { separability } = otsu(gray);
  return { kind: separability > 0.9 ? 'logo' : 'photo', separability };
}

const borderLuma = (gray) => {
  const { width: w, height: h, data } = gray;
  let sum = 0, n = 0;
  for (let x = 0; x < w; x++) { sum += data[x] + data[(h - 1) * w + x]; n += 2; }
  for (let y = 1; y < h - 1; y++) { sum += data[y * w] + data[y * w + w - 1]; n += 2; }
  return n ? sum / n : 255;
};

function floydSteinberg(gray) {
  const { width: w, height: h } = gray, v = Float32Array.from(gray.data), bright = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, old = v[i], next = old < 128 ? 0 : 255, err = old - next;
    bright[i] = next === 255 ? 1 : 0;
    if (x + 1 < w) v[i + 1] += (err * 7) / 16;
    if (y + 1 < h) { if (x > 0) v[i + w - 1] += (err * 3) / 16; v[i + w] += (err * 5) / 16; if (x + 1 < w) v[i + w + 1] += (err * 1) / 16; }
  }
  return bright;
}

/** Drop on pixels with no on neighbor. */
export function despeckle(on, w, h) {
  const out = Uint8Array.from(on);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on[y * w + x]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && on[ny * w + nx]) n++;
    }
    if (!n) out[y * w + x] = 0;
  }
  return out;
}

// Square pixels: the grid is `cols` wide and `cols * height / width` tall, rounded to an even number, two per cell. Shrinks to fit maxRows.
function fitPixels(gray, cols, maxRows) {
  let W = cols, H = Math.round((cols * gray.height) / gray.width);
  if (maxRows && H > 2 * maxRows) { H = 2 * maxRows; W = Math.max(1, Math.round((H * gray.width) / gray.height)); }
  if (H % 2) H++;
  return { W, H: Math.max(2, H) };
}

/**
 * Bitmap mode. `ink` is which side is on: dark pixels, light pixels, or auto (a light border means dark ink).
 * @returns {{bitmap: object, threshold: number, inkDark: boolean, kind: string, separability: number, cols: number}}
 */
export function imageToBitmap(image, { cols, maxRows, threshold, dither = false, ink = 'auto', bg = 255, despeckle: clean = true } = {}) {
  const gray = grayscale(image, { bg });
  const { W, H } = fitPixels(gray, cols, maxRows);
  const small = resample(gray, W, H);
  const o = otsu(small);
  const t = threshold ?? o.threshold;
  const inkDark = ink === 'dark' ? true : ink === 'light' ? false : borderLuma(small) >= 128;
  let on = new Uint8Array(W * H);
  const bright = dither ? floydSteinberg(small) : small.data.map((v) => (v > t ? 1 : 0));
  for (let i = 0; i < W * H; i++) on[i] = inkDark ? (bright[i] ? 0 : 1) : bright[i] ? 1 : 0;
  if (clean) on = despeckle(on, W, H);
  const cells = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (on[y * W + x] ? '#' : null)));
  return { bitmap: { width: W, height: H, cells }, threshold: t, inkDark, kind: classify(small).kind, separability: o.separability, cols: W };
}

const STROKES = ['-', '\\', '|', '/'];
const LOCAL_RADIUS = 3;    // cells; the neighborhood a boundary is compared against
const PEAK_FACTOR = 4;     // a peak stands this many times above its neighbourhood's mean, so smooth gradients read as tone
const NOISE_FLOOR = 0.1;   // as a fraction of the strongest edge; keeps flat regions from amplifying noise
function edgeMap(px, C, R) {
  // Sobel on the pixel grid (C by 2R), then the stronger of each cell's two pixels, normalized by
  // max(global*floor, local_mean*factor) so a faint isolated boundary counts but a smooth gradient does not.
  const { width: w, height: h, data } = px;
  const at = (x, y) => data[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  const mag = new Float32Array(C * R), stroke = new Uint8Array(C * R);
  let max = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    const m = Math.hypot(gx, gy), cell = (y >> 1) * C + x;
    if (m > mag[cell]) {
      mag[cell] = m;
      const phi = (((Math.atan2(gy, gx) + Math.PI / 2) % Math.PI) + Math.PI) % Math.PI;   // the edge's own direction, 0 to pi
      stroke[cell] = Math.round(phi / (Math.PI / 4)) % 4;
    }
    if (m > max) max = m;
  }
  if (!max) return { mag, stroke };
  const floor = max * NOISE_FLOOR, norm = new Float32Array(C * R);
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
    let sum = 0, n = 0;
    const y0 = Math.max(0, y - LOCAL_RADIUS), y1 = Math.min(R, y + LOCAL_RADIUS + 1);
    const x0 = Math.max(0, x - LOCAL_RADIUS), x1 = Math.min(C, x + LOCAL_RADIUS + 1);
    for (let ny = y0; ny < y1; ny++) for (let nx = x0; nx < x1; nx++) { sum += mag[ny * C + nx]; n++; }
    const denom = Math.max(floor, (sum / n) * PEAK_FACTOR);
    norm[y * C + x] = mag[y * C + x] / denom;
  }
  return { mag: norm, stroke };
}

/**
 * Sketch mode: one ramp character per cell from the cell's average luma, edges drawn as strokes. Needs 60 columns or more.
 * `ground` is the page behind the art: on a dark ground bright pixels get dense characters; on a light ground the reverse.
 */
export function imageToSketch(image, { cols, maxRows, ramp = 'long', ground = 'dark', stretch = true, edges = 0.3, bg = 255 } = {}) {
  if (cols < 60) throw new Error(`sketch mode needs 60 columns or more; at ${cols} columns it turns to mush. Use bitmap mode at this size.`);
  if (!RAMPS[ramp]) throw new Error(`unknown ramp: ${ramp}. Ramps: ${Object.keys(RAMPS).join(', ')}.`);
  const gray = grayscale(image, { bg });
  const { W: C, H } = fitPixels(gray, cols, maxRows);
  if (C < 60) throw new Error(`sketch mode needs 60 columns or more, and fitting ${maxRows} rows leaves ${C}. Allow more rows or use bitmap mode.`);
  const R = H / 2;
  const lum = Float32Array.from(resample(gray, C, R).data);
  if (stretch) {
    const sorted = Float32Array.from(lum).sort();
    const lo = sorted[Math.floor(sorted.length * 0.02)], hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
    if (hi > lo) for (let i = 0; i < lum.length; i++) lum[i] = Math.max(0, Math.min(255, ((lum[i] - lo) * 255) / (hi - lo)));
  }
  const chars = [...RAMPS[ramp]];
  const edge = edges ? edgeMap(resample(gray, C, H), C, R) : null;
  const rows = [];
  for (let y = 0; y < R; y++) {
    let row = '';
    for (let x = 0; x < C; x++) {
      const i = y * C + x, v = lum[i] / 255;
      let ch = chars[Math.round((ground === 'dark' ? v : 1 - v) * (chars.length - 1))];
      if (edge && edge.mag[i] >= edges) ch = STROKES[edge.stroke[i]];
      row += ch;
    }
    rows.push(row.replace(/\s+$/, ''));
  }
  return { text: rows.join('\n') + '\n', cols: C, rows: R, rgb: resampleRGB(image, C, R) };
}
