// The legibility checks. Size, hygiene, and frames are errors; glyph set, feature size, separation, and themes are warnings.
import { measure } from './measure.js';
import { halfblocksToPixels, components, erode } from './pixels.js';
import { RAMPS } from './ramps.js';
import { contrast } from './contrast.js';

export const BANDS = { narrow: 44, standard: 78, wide: 120 };

// Modes with a fixed glyph set. Text and wordmark modes allow the safe Unicode blocks instead.
const MODE_GLYPHS = { bitmap: ' ▀▄█', sketch: RAMPS.short + RAMPS.blocks + RAMPS.long, wordmark: '', text: '' };

// Safe blocks: printable Basic Latin, Box Drawing, Block Elements.
const inSafeBlock = (c) => (c >= 0x20 && c <= 0x7e) || (c >= 0x2500 && c <= 0x259f);

// A short table of double-width ranges, enough to catch CJK, Hangul, fullwidth forms, and emoji. Not the full Unicode data.
const WIDE = [[0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd]];
const isWide = (c) => WIDE.some(([lo, hi]) => c >= lo && c <= hi);
const isZeroWidth = (c) => (c >= 0x300 && c <= 0x36f) || (c >= 0x200b && c <= 0x200f) || c === 0xfeff || (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0x20d0 && c <= 0x20ff);
const isControl = (c) => (c < 0x20 && c !== 0x09 && c !== 0x0d && c !== 0x1b) || c === 0x7f || (c >= 0x80 && c <= 0x9f);
const hex = (c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;

const MIN_FEATURE = 4;     // pixels; a piece or a hole below this is a speck or a notch
const MIN_SHAPE = 16;      // pixels; only shapes this big are tested for a thin bridge
const MIN_PIECE = 8;       // pixels; pieces this big count after erosion
const MAX_FRAMES = 240;    // twenty seconds at twelve frames per second

/**
 * @param {string} text the plain form of a render
 * @param {object} [options]
 * @param {'bitmap'|'wordmark'|'sketch'|'text'} [options.mode='text']
 * @param {'narrow'|'standard'|'wide'|number} [options.band='standard'] maximum width in columns
 * @param {number} [options.maxRows=20]
 * @param {string} [options.allow=''] extra characters the user asked for, or a font's own glyphs
 * @param {string[]} [options.frames] the frames of an animation, each a plain render
 * @param {string} [options.source] the frame a reveal must end on
 * @param {number} [options.maxFrames=240]
 * @param {{light?: string[], dark?: string[], ansi?: string[]}} [options.colors] hex colors to test per theme
 * @param {{light?: string, dark?: string}} [options.backgrounds] page backgrounds, default #ffffff and #111111
 * @returns {{ok: boolean, errors: {check: string, message: string}[], warnings: {check: string, message: string}[]}}
 */
export function check(text, options = {}) {
  const { mode = 'text', band = 'standard', maxRows = 20, allow = '', frames, source, maxFrames = MAX_FRAMES, colors, backgrounds = {} } = options;
  if (!(mode in MODE_GLYPHS)) throw new Error(`unknown mode: ${mode}`);
  const maxCols = typeof band === 'number' ? band : BANDS[band];
  if (maxCols === undefined) throw new Error(`unknown band: ${band}`);
  const errors = [], warnings = [];
  const error = (check, message) => errors.push({ check, message });
  const warn = (check, message) => warnings.push({ check, message });

  const m = measure(text);
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  // size
  m.widths.forEach((w, i) => { if (w > maxCols) error('size', `line ${i + 1} is ${w} columns, over the limit of ${maxCols}`); });
  if (m.rows > maxRows) error('size', `${m.rows} rows, over the limit of ${maxRows}`);

  // hygiene and glyphs, one pass over the characters
  if (text.length && !text.endsWith('\n')) error('hygiene', 'no final newline');
  const fixed = MODE_GLYPHS[mode];
  const allowed = new Set([...fixed, ...allow]);
  lines.forEach((line, i) => {
    const n = i + 1;
    if (line.endsWith('\r')) error('hygiene', `line ${n} ends with a carriage return; use LF line endings`);
    if (/[ \t ]$/.test(line.replace(/\r$/, ''))) error('hygiene', `line ${n} has trailing whitespace`);
    let col = 0;
    for (const ch of line) {
      col++;
      const c = ch.codePointAt(0);
      if (c === 0x0d) continue;
      if (c === 0x09) error('hygiene', `line ${n}, column ${col}: a tab`);
      else if (c === 0x1b) error('hygiene', `line ${n}, column ${col}: an escape code; check the plain form`);
      else if (isControl(c)) error('hygiene', `line ${n}, column ${col}: control character ${hex(c)}`);
      else if (isWide(c)) error('size', `line ${n}, column ${col}: "${ch}" is double-width`);
      else if (isZeroWidth(c)) error('size', `line ${n}, column ${col}: zero-width character ${hex(c)}`);
      else if (!(allowed.has(ch) || (!fixed && inSafeBlock(c)))) warn('glyphs', `line ${n}, column ${col}: "${ch}" is outside the ${mode} glyph set`);
    }
  });

  // feature size and separation, bitmap mode only
  if (mode === 'bitmap') {
    const grid = halfblocksToPixels(text);
    const at = (p) => `(${p[0]}, ${p[1]})`;
    const plural = (n) => `${n} pixel${n === 1 ? '' : 's'}`;
    const shapes = components(grid, { value: true, connectivity: 8 });
    for (const piece of shapes) if (piece.size < MIN_FEATURE) warn('features', `a piece of ${plural(piece.size)} at ${at(piece.pixels[0])} reads as a speck`);
    for (const hole of components(grid, { value: false, connectivity: 4 })) {
      if (!hole.touchesBorder && hole.size < MIN_FEATURE) warn('features', `a hole of ${plural(hole.size)} at ${at(hole.pixels[0])} reads as a notch`);
    }
    // a shape that falls into two real pieces after eroding one pixel is two shapes joined by a thin bridge
    const eroded = erode(grid);
    for (const shape of shapes) {
      if (shape.size < MIN_SHAPE) continue;
      const mine = new Set(shape.pixels.map(([x, y]) => y * grid.width + x));
      const sub = { width: grid.width, height: grid.height, rows: eroded.rows.map((row, y) => row.map((v, x) => v && mine.has(y * grid.width + x))) };
      const pieces = components(sub, { value: true, connectivity: 8 }).filter((p) => p.size >= MIN_PIECE);
      if (pieces.length >= 2) warn('separation', `the shape at ${at(shape.pixels[0])} is ${pieces.length} shapes joined by a thin bridge; leave a one-pixel gap`);
    }
    // two real shapes that meet only at a corner render as ambiguous half-cells
    const four = components(grid, { value: true, connectivity: 4 });
    const owner = new Map();
    four.forEach((c, i) => c.pixels.forEach(([x, y]) => owner.set(y * grid.width + x, i)));
    const reported = new Set();
    for (let y = 0; y + 1 < grid.height; y++) for (let x = 0; x + 1 < grid.width; x++) {
      const a = grid.rows[y][x], b = grid.rows[y][x + 1], c = grid.rows[y + 1][x], d = grid.rows[y + 1][x + 1];
      const pair = a && d && !b && !c ? [[x, y], [x + 1, y + 1]] : b && c && !a && !d ? [[x + 1, y], [x, y + 1]] : null;
      if (!pair) continue;
      const [i, j] = pair.map(([px, py]) => owner.get(py * grid.width + px));
      if (i === j || four[i].size < MIN_FEATURE || four[j].size < MIN_FEATURE) continue;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (reported.has(key)) continue;
      reported.add(key);
      warn('separation', `two shapes meet only at a corner near (${x}, ${y}); leave a one-pixel gap`);
    }
  }

  // frames
  if (frames) {
    if (frames.length > maxFrames) error('frames', `${frames.length} frames, over the limit of ${maxFrames}`);
    const sizes = [...new Set(frames.map((f) => { const fm = measure(f); return `${fm.cols}x${fm.rows}`; }))];
    if (sizes.length > 1) error('frames', `frames differ in size: ${sizes.join(', ')}`);
    if (source !== undefined && frames.length && frames[frames.length - 1] !== source) error('frames', 'the last frame is not the source frame');
  }

  // themes
  if (colors) {
    const bg = { light: backgrounds.light ?? '#ffffff', dark: backgrounds.dark ?? '#111111' };
    for (const theme of ['light', 'dark']) {
      for (const color of colors[theme] ?? []) {
        const ratio = contrast(color, bg[theme]);
        if (ratio < 4.5) warn('themes', `${color} on the ${theme} background ${bg[theme]} has a contrast of ${ratio.toFixed(2)} to 1, under 4.5`);
      }
    }
    for (const color of colors.ansi ?? []) {
      for (const [name, base] of [['black', '#000000'], ['white', '#ffffff']]) {
        if (contrast(color, base) < 1.5) warn('themes', `${color} is too close to a ${name} terminal background`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
