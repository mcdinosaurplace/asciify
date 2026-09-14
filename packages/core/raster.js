// Rasters: character grids and bitmaps as pixel images and as SVG. Block and box glyphs paint geometrically; other glyphs
// come from an outline font when one is given.
import { paintCell } from './cells.js';
import { glyphClass, regionPainter } from './ansi.js';
import { gradient, toHex } from './color.js';
import { paintGlyph, glyphPathData, cellMetrics } from './fontraster.js';
import { frameToText } from './frames.js';

const splitLines = (text) => { const lines = text.split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop(); return lines; };
const position = (direction, x, y, cols, rows) => {
  const fx = x / Math.max(1, cols - 1), fy = y / Math.max(1, rows - 1);
  return direction === 'horizontal' ? fx : direction === 'diagonal' ? (fx + fy) / 2 : fy;
};

/** Coverage for a character grid, plus a color per cell from the palette. `missing` lists glyphs no painter or font could draw. */
export function rasterizeGrid(text, { cellW = 8, cellH = 16, font = null, palette = null, direction = 'vertical' } = {}) {
  const lines = splitLines(text), rows = lines.length;
  const cols = lines.reduce((w, l) => Math.max(w, [...l].length), 0);
  const width = cols * cellW, height = rows * cellH;
  const grid = { width, height, data: new Float32Array(width * height) };
  const colors = new Array(rows * cols).fill(null), missing = new Set();
  const metrics = font ? cellMetrics(font, cellH) : null;
  lines.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch === ' ') return;
    const cell = paintCell(ch, cellW, cellH);
    if (cell) { for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) if (cell[y * cellW + x]) grid.data[(r * cellH + y) * width + c * cellW + x] = 1; }
    else if (font) { const adv = metrics.advance(ch); paintGlyph(font, ch, c * cellW + Math.max(0, (cellW - adv) / 2), r * cellH + metrics.baseline, metrics.size, grid); }
    else { missing.add(ch); return; }
    if (palette) colors[r * cols + c] = glyphClass(ch) === 'shadow' ? palette.shadow : gradient(palette.stops, position(direction, c, r, cols, rows));
  }));
  for (let i = 0; i < grid.data.length; i++) if (grid.data[i] > 1) grid.data[i] = 1;
  return { ...grid, cols, rows, cellW, cellH, colors, missing: [...missing] };
}

/** An RGBA image from a rasterized grid: coverage becomes alpha over the background, or transparency when there is none. */
export function imageFromGrid(raster, { background = null, color = [230, 230, 230] } = {}) {
  const { width, height, data, cols, cellW, cellH, colors } = raster;
  const img = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, a = data[y * width + x];
    const c = colors[Math.floor(y / cellH) * cols + Math.floor(x / cellW)] ?? color;
    if (background) { img[i] = background[0] + (c[0] - background[0]) * a; img[i + 1] = background[1] + (c[1] - background[1]) * a; img[i + 2] = background[2] + (c[2] - background[2]) * a; img[i + 3] = 255; }
    else { img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = Math.round(a * 255); }
  }
  return { width, height, data: img };
}

/** An RGBA image from a bitmap at `px` image pixels per art pixel, colored by region. */
export function imageFromBitmap(bitmap, { px = 8, palette, regionColors = {}, direction = 'vertical', background = null, color = [230, 230, 230] } = {}) {
  const colorOf = palette ? regionPainter(bitmap, palette, { regionColors, direction }) : () => color;
  const width = bitmap.width * px, height = bitmap.height * px, img = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const key = bitmap.cells[Math.floor(y / px)][Math.floor(x / px)], i = (y * width + x) * 4;
    const c = key === null ? background : colorOf(key, Math.floor(x / px), Math.floor(y / px) / 2);
    if (c) { img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255; }
  }
  return { width, height, data: img };
}

const svgOpen = (w, h, background) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">${background ? `<rect width="${w}" height="${h}" fill="${toHex(background)}"/>` : ''}`;
// rectangles for the runs of one color in a pixel grid described by colorAt(x, y) → hex or null; a run repeated on the
// next row grows downward instead of starting a new rect, so a solid block is one rect
function runs(width, height, colorAt) {
  const rects = [];
  let prev = new Map();
  for (let y = 0; y < height; y++) {
    const cur = new Map();
    let x = 0;
    while (x < width) {
      const c = colorAt(x, y);
      if (!c) { x++; continue; }
      let x1 = x + 1;
      while (x1 < width && colorAt(x1, y) === c) x1++;
      const key = `${x},${x1},${c}`, above = prev.get(key);
      if (above) { above.h++; cur.set(key, above); } else { const r = { x, y, w: x1 - x, h: 1, c }; rects.push(r); cur.set(key, r); }
      x = x1;
    }
    prev = cur;
  }
  return rects.map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.c}"/>`).join('');
}

/** SVG of a bitmap: one rect per run of pixels of one color, in art pixels. */
export function svgFromBitmap(bitmap, { palette, regionColors = {}, direction = 'vertical', background = null, color = [230, 230, 230] } = {}) {
  const colorOf = palette ? regionPainter(bitmap, palette, { regionColors, direction }) : () => color;
  const at = (x, y) => { const k = bitmap.cells[y][x]; return k === null ? null : toHex(colorOf(k, x, y / 2)); };
  return `${svgOpen(bitmap.width, bitmap.height, background)}${runs(bitmap.width, bitmap.height, at)}</svg>\n`;
}

/** SVG of a character grid: rects for the geometric glyphs, outline paths for glyphs drawn from a font. */
export function svgFromGrid(text, { cellW = 8, cellH = 16, font = null, palette = null, direction = 'vertical', background = null, color = [230, 230, 230] } = {}) {
  const lines = splitLines(text), rows = lines.length;
  const cols = lines.reduce((w, l) => Math.max(w, [...l].length), 0);
  const width = cols * cellW, height = rows * cellH, metrics = font ? cellMetrics(font, cellH) : null;
  const paths = [], missing = new Set();
  const grid = new Array(width * height).fill(null);
  lines.forEach((line, r) => [...line].forEach((ch, c) => {
    if (ch === ' ') return;
    const col = toHex(palette ? (glyphClass(ch) === 'shadow' ? palette.shadow : gradient(palette.stops, position(direction, c, r, cols, rows))) : color);
    const cell = paintCell(ch, cellW, cellH);
    if (cell) { for (let y = 0; y < cellH; y++) for (let x = 0; x < cellW; x++) if (cell[y * cellW + x]) grid[(r * cellH + y) * width + c * cellW + x] = col; }
    else if (font) paths.push(`<path d="${glyphPathData(font, ch, c * cellW + Math.max(0, (cellW - metrics.advance(ch)) / 2), r * cellH + metrics.baseline, metrics.size)}" fill="${col}"/>`);
    else missing.add(ch);
  }));
  const svg = `${svgOpen(width, height, background)}${runs(width, height, (x, y) => grid[y * width + x])}${paths.join('')}</svg>\n`;
  return { svg, missing: [...missing] };
}

/** An RGBA image of a frame: glyph coverage in the cell's foreground over the cell's background, or the ground, or nothing. */
export function imageFromFrame(frame, { cellW = 8, cellH = 16, font = null, background = null, color = [230, 230, 230] } = {}) {
  const raster = rasterizeGrid(frameToText(frame, { pad: true }), { cellW, cellH, font });
  const { width, height, data } = raster, img = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const cy = Math.floor(y / cellH), cx = Math.floor(x / cellW), i = (y * width + x) * 4, a = data[y * width + x];
    const f = frame.fg[cy]?.[cx] ?? color, b = frame.bg[cy]?.[cx] ?? background;
    if (b) { img[i] = b[0] + (f[0] - b[0]) * a; img[i + 1] = b[1] + (f[1] - b[1]) * a; img[i + 2] = b[2] + (f[2] - b[2]) * a; img[i + 3] = 255; }
    else { img[i] = f[0]; img[i + 1] = f[1]; img[i + 2] = f[2]; img[i + 3] = Math.round(a * 255); }
  }
  return { width, height, data: img, missing: raster.missing };
}
