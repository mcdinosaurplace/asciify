// ANSI color: truecolor or 256-color escapes, gradients over a render, the half-block trick for regions, and per-cell sketch color.
import { gradient } from './color.js';

export const RESET = '\x1b[0m';
const LEVELS = [0, 95, 135, 175, 215, 255];

/** The nearest of the 256-color cube and gray ramp. */
export function nearest256([r, g, b]) {
  const q = (v) => LEVELS.reduce((best, l, i) => (Math.abs(l - v) < Math.abs(LEVELS[best] - v) ? i : best), 0);
  const ci = [q(r), q(g), q(b)], cube = ci.map((i) => LEVELS[i]);
  const gi = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10))), gv = 8 + gi * 10;
  const d = (c) => (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
  return d(cube) <= d([gv, gv, gv]) ? 16 + 36 * ci[0] + 6 * ci[1] + ci[2] : 232 + gi;
}
const code = (rgb, depth, layer) => (depth === '256' ? `\x1b[${layer};5;${nearest256(rgb)}m` : `\x1b[${layer};2;${rgb.map(Math.round).join(';')}m`);
export const fg = (rgb, depth = 'truecolor') => code(rgb, depth, 38);
export const bg = (rgb, depth = 'truecolor') => code(rgb, depth, 48);

/** Box Drawing glyphs and the light shades are a font's shadow; everything else is fill. */
export const glyphClass = (ch) => { const c = ch.codePointAt(0); return (c >= 0x2500 && c <= 0x257f) || '░▒▓'.includes(ch) ? 'shadow' : 'fill'; };

const position = (direction, x, y, cols, rows) => {
  const fx = x / Math.max(1, cols - 1), fy = y / Math.max(1, rows - 1);
  return direction === 'horizontal' ? fx : direction === 'diagonal' ? (fx + fy) / 2 : fy;
};
const splitLines = (text) => { const lines = text.split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop(); return lines; };

/** Color a plain render: fill glyphs run the gradient, shadow glyphs take the shadow slot. Runs of one color share one escape. */
export function colorizeText(text, palette, { depth = 'truecolor', direction = palette.direction ?? 'vertical' } = {}) {
  const lines = splitLines(text);
  const rows = lines.length, cols = lines.reduce((w, l) => Math.max(w, [...l].length), 0);
  return lines.map((line, y) => {
    let out = '', current = null;
    [...line].forEach((ch, x) => {
      if (ch === ' ') { out += ch; return; }
      const color = glyphClass(ch) === 'shadow' ? palette.shadow : gradient(palette.stops, position(direction, x, y, cols, rows));
      const c = fg(color, depth);
      if (c !== current) { out += c; current = c; }
      out += ch;
    });
    return current ? out + RESET : out;
  }).join('\n') + '\n';
}

/** A bitmap's region keys, largest area first. */
export function regionKeys(bitmap) {
  const area = new Map();
  for (const row of bitmap.cells) for (const c of row) if (c !== null) area.set(c, (area.get(c) ?? 0) + 1);
  return [...area.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

/**
 * Color a bitmap by region: the largest region runs the gradient, others take fixed colors from `regionColors` (key to [r, g, b])
 * or the accent and shadow slots in turn. Two regions in one cell render as ▀ with the top color in front and the bottom behind.
 */
/** The color of a region's pixel: the largest region runs the gradient by cell position, the rest take fixed colors. */
export function regionPainter(bitmap, palette, { regionColors = {}, direction = palette.direction ?? 'vertical' } = {}) {
  const keys = regionKeys(bitmap);
  const fallback = [palette.accent, palette.shadow, ...palette.stops];
  const fixed = new Map();
  keys.slice(1).forEach((k, i) => fixed.set(k, regionColors[k] ?? fallback[i % fallback.length]));
  if (regionColors[keys[0]]) fixed.set(keys[0], regionColors[keys[0]]);
  const rows = bitmap.height / 2;
  return (key, x, y) => fixed.get(key) ?? gradient(palette.stops, position(direction, x, y, bitmap.width, rows));
}

export function colorizeBitmap(bitmap, palette, { depth = 'truecolor', direction = palette.direction ?? 'vertical', regionColors = {} } = {}) {
  const rows = bitmap.height / 2;
  const colorOf = regionPainter(bitmap, palette, { regionColors, direction });
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let out = '', current = '';
    let lastNonSpace = 0;
    for (let x = 0; x < bitmap.width; x++) {
      const t = bitmap.cells[2 * y][x], b = bitmap.cells[2 * y + 1][x];
      let ch = ' ', c = '';
      if (t !== null && b !== null) { ch = t === b ? '█' : '▀'; c = fg(colorOf(t, x, y), depth) + (t === b ? '' : bg(colorOf(b, x, y), depth)); }
      else if (t !== null) { ch = '▀'; c = fg(colorOf(t, x, y), depth); }
      else if (b !== null) { ch = '▄'; c = fg(colorOf(b, x, y), depth); }
      if (ch !== ' ') lastNonSpace = x + 1;
      if (c !== current) { out += current && (!c || current.includes('[48')) ? RESET + c : c; current = c; }
      out += ch;
    }
    out = current ? out + RESET : out;
    lines.push(lastNonSpace === bitmap.width ? out : trimColoredTail(out));
  }
  return lines.join('\n') + '\n';
}
// trailing spaces after the last glyph carry no color, so cut them before the final reset
const trimColoredTail = (s) => s.replace(/ +(\x1b\[0m)?$/, '$1');

/** Per-cell color from the image under each cell of a sketch. `rgb` is width by height by 3. */
export function colorizeSketch(text, rgb, width, { depth = 'truecolor' } = {}) {
  return splitLines(text).map((line, y) => {
    let out = '', current = null;
    [...line].forEach((ch, x) => {
      if (ch === ' ') { out += ch; return; }
      const i = (y * width + x) * 3, c = fg([rgb[i], rgb[i + 1], rgb[i + 2]], depth);
      if (c !== current) { out += c; current = c; }
      out += ch;
    });
    return current ? out + RESET : out;
  }).join('\n') + '\n';
}

/** The plain form again: every escape removed. */
export const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
