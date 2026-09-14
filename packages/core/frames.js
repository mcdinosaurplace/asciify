// Frames: a character grid with a foreground and a background color per cell, the unit every effect and player works on.
import { glyphClass, regionPainter, regionKeys, fg as fgCode, bg as bgCode, RESET } from './ansi.js';
import { gradient, toHex } from './color.js';

const splitLines = (text) => { const lines = text.split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop(); return lines; };
const grid = (w, h, v) => Array.from({ length: h }, () => new Array(w).fill(v));

/** A frame from plain text: rows padded to one width. */
export function frameFromText(text) {
  const rows = splitLines(text).map((l) => [...l]);
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0), height = rows.length;
  return { width, height, cells: rows.map((r) => [...r, ...new Array(width - r.length).fill(' ')]), fg: grid(width, height, null), bg: grid(width, height, null) };
}
export const cloneFrame = (f) => ({ width: f.width, height: f.height, cells: f.cells.map((r) => [...r]), fg: f.fg.map((r) => [...r]), bg: f.bg.map((r) => [...r]) });
export const blankFrame = (f) => ({ width: f.width, height: f.height, cells: grid(f.width, f.height, ' '), fg: grid(f.width, f.height, null), bg: grid(f.width, f.height, null) });

/** Plain text of a frame; padded keeps every row at the frame's width, which the frame checks and the players want. */
export function frameToText(frame, { pad = false } = {}) {
  return frame.cells.map((r) => (pad ? r.join('') : r.join('').replace(/\s+$/, ''))).join('\n') + '\n';
}

const position = (direction, x, y, cols, rows) => {
  const fx = x / Math.max(1, cols - 1), fy = y / Math.max(1, rows - 1);
  return direction === 'horizontal' ? fx : direction === 'diagonal' ? (fx + fy) / 2 : fy;
};

/** Foreground colors from a palette, the way colorizeText paints: the gradient by position, the shadow slot for shadow glyphs. */
export function paintFrame(frame, palette, { direction = palette.direction ?? 'vertical' } = {}) {
  const out = cloneFrame(frame);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const ch = out.cells[y][x];
    if (ch !== ' ') out.fg[y][x] = glyphClass(ch) === 'shadow' ? palette.shadow : gradient(palette.stops, position(direction, x, y, out.width, out.height));
  }
  return out;
}

/** A frame from a bitmap with the half-block trick: a cell whose pixels belong to two regions carries both colors. */
export function frameFromBitmap(bitmap, palette = null, { regionColors = {}, direction = 'vertical' } = {}) {
  const rows = bitmap.height / 2, out = { width: bitmap.width, height: rows, cells: grid(bitmap.width, rows, ' '), fg: grid(bitmap.width, rows, null), bg: grid(bitmap.width, rows, null) };
  const colorOf = palette ? regionPainter(bitmap, palette, { regionColors, direction }) : () => null;
  for (let y = 0; y < rows; y++) for (let x = 0; x < bitmap.width; x++) {
    const t = bitmap.cells[2 * y][x], b = bitmap.cells[2 * y + 1][x];
    if (t !== null && b !== null) { out.cells[y][x] = t === b ? '█' : '▀'; out.fg[y][x] = colorOf(t, x, y); if (t !== b) out.bg[y][x] = colorOf(b, x, y); }
    else if (t !== null) { out.cells[y][x] = '▀'; out.fg[y][x] = colorOf(t, x, y); }
    else if (b !== null) { out.cells[y][x] = '▄'; out.fg[y][x] = colorOf(b, x, y); }
  }
  return out;
}

/** One frame as ANSI text: runs of one color share an escape, every row ends with a reset, rows keep the frame's width. */
export function ansiFrame(frame, { depth = 'truecolor' } = {}) {
  return frame.cells.map((row, y) => {
    let out = '', current = '';
    row.forEach((ch, x) => {
      const f = frame.fg[y][x], b = frame.bg[y][x];
      const code = ch === ' ' && !b ? '' : (f ? fgCode(f, depth) : '') + (b ? bgCode(b, depth) : '');
      if (code !== current) { out += (current ? RESET : '') + code; current = code; }
      out += ch;
    });
    return out + (current ? RESET : '');
  }).join('\n') + '\n';
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** One frame as HTML rows with spans per run of one color pair, for the web player. */
export function htmlFrame(frame) {
  return frame.cells.map((row, y) => {
    let out = '', run = '', cur = null;
    const flush = () => { if (run) out += cur ? `<span style="${cur}">${esc(run)}</span>` : esc(run); run = ''; };
    row.forEach((ch, x) => {
      const f = frame.fg[y][x], b = frame.bg[y][x];
      const style = ch === ' ' && !b ? cur : [f ? `color:${toHex(f)}` : '', b ? `background:${toHex(b)}` : ''].filter(Boolean).join(';') || null;
      if (style !== cur) { flush(); cur = style; }
      run += ch;
    });
    flush();
    return out;
  }).join('\n');
}

/** A clip as JSON: frames as padded text with colors as hex per cell (null for none), so a file round-trips exactly. */
export function clipToJSON(clip) {
  const hexGrid = (g) => (g.every((r) => r.every((c) => c === null)) ? null : g.map((r) => r.map((c) => (c ? toHex(c) : null))));
  return JSON.stringify({ version: 1, fps: clip.fps, width: clip.width, height: clip.height, loopFrom: clip.loopFrom, frames: clip.frames.map((f) => ({ text: frameToText(f, { pad: true }), fg: hexGrid(f.fg), bg: hexGrid(f.bg) })) });
}
export function clipFromJSON(json) {
  const o = typeof json === 'string' ? JSON.parse(json) : json;
  const rgb = (h) => (h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : null);
  const frames = o.frames.map((f) => {
    const fr = frameFromText(f.text);
    if (f.fg) fr.fg = f.fg.map((r) => r.map(rgb));
    if (f.bg) fr.bg = f.bg.map((r) => r.map(rgb));
    return fr;
  });
  return { fps: o.fps, width: o.width, height: o.height, loopFrom: o.loopFrom ?? null, frames };
}
