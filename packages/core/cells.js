// Geometric painters for block and box-drawing glyphs: each paints a w by h pixel cell. Glyphs that need a font return undefined.
// Rectangles are fractions of the cell for the block elements, and pixel runs for the box-drawing lines.

const R = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
const BLOCKS = {
  '█': [R(0, 0, 1, 1)], '▀': [R(0, 0, 1, 0.5)], '▄': [R(0, 0.5, 1, 1)], '▌': [R(0, 0, 0.5, 1)], '▐': [R(0.5, 0, 1, 1)],
  '▁': [R(0, 7 / 8, 1, 1)], '▂': [R(0, 6 / 8, 1, 1)], '▃': [R(0, 5 / 8, 1, 1)], '▅': [R(0, 3 / 8, 1, 1)], '▆': [R(0, 2 / 8, 1, 1)], '▇': [R(0, 1 / 8, 1, 1)], '▔': [R(0, 0, 1, 1 / 8)],
  '▏': [R(0, 0, 1 / 8, 1)], '▎': [R(0, 0, 2 / 8, 1)], '▍': [R(0, 0, 3 / 8, 1)], '▋': [R(0, 0, 5 / 8, 1)], '▊': [R(0, 0, 6 / 8, 1)], '▉': [R(0, 0, 7 / 8, 1)], '▕': [R(7 / 8, 0, 1, 1)],
  '▖': [R(0, 0.5, 0.5, 1)], '▗': [R(0.5, 0.5, 1, 1)], '▘': [R(0, 0, 0.5, 0.5)], '▝': [R(0.5, 0, 1, 0.5)],
  '▙': [R(0, 0, 0.5, 1), R(0.5, 0.5, 1, 1)], '▚': [R(0, 0, 0.5, 0.5), R(0.5, 0.5, 1, 1)], '▛': [R(0, 0, 1, 0.5), R(0, 0.5, 0.5, 1)],
  '▜': [R(0, 0, 1, 0.5), R(0.5, 0.5, 1, 1)], '▞': [R(0.5, 0, 1, 0.5), R(0, 0.5, 0.5, 1)], '▟': [R(0.5, 0, 1, 0.5), R(0, 0.5, 1, 1)],
  '·': [R(3 / 8, 7 / 16, 5 / 8, 9 / 16)],
};
const SHADES = { '░': (x, y) => x % 2 === 0 && y % 2 === 0, '▒': (x, y) => (x + y) % 2 === 0, '▓': (x, y) => !(x % 2 === 1 && y % 2 === 1) };

// Box drawing: lines of thickness t through the cell. Light and heavy lines run through the center; double lines sit at ±d.
const LIGHT = (w) => Math.max(1, Math.round(w / 8)), HEAVY = (w) => Math.max(2, Math.round((3 * w) / 8));
function lines(w, h, t) {
  const cx = Math.floor((w - t) / 2), cy = Math.floor((h - t) / 2), d = Math.max(1, Math.round(w / 4));
  const v = (x, y0, y1) => ({ x0: x, y0, x1: x + t, y1 }), hz = (y, x0, x1) => ({ x0, y0: y, x1, y1: y + t });
  const xl = cx - d, xr = cx + d, yt = cy - d, yb = cy + d, W = w, H = h;
  const single = {
    '─': [hz(cy, 0, W)], '│': [v(cx, 0, H)], '┌': [v(cx, cy, H), hz(cy, cx, W)], '┐': [v(cx, cy, H), hz(cy, 0, cx + t)],
    '└': [v(cx, 0, cy + t), hz(cy, cx, W)], '┘': [v(cx, 0, cy + t), hz(cy, 0, cx + t)], '├': [v(cx, 0, H), hz(cy, cx, W)], '┤': [v(cx, 0, H), hz(cy, 0, cx + t)],
    '┬': [hz(cy, 0, W), v(cx, cy, H)], '┴': [hz(cy, 0, W), v(cx, 0, cy + t)], '┼': [hz(cy, 0, W), v(cx, 0, H)],
    '╴': [hz(cy, 0, cx + t)], '╵': [v(cx, 0, cy + t)], '╶': [hz(cy, cx, W)], '╷': [v(cx, cy, H)],
  };
  const double = {
    '═': [hz(yt, 0, W), hz(yb, 0, W)], '║': [v(xl, 0, H), v(xr, 0, H)],
    '╔': [v(xl, yt, H), v(xr, yb, H), hz(yt, xl, W), hz(yb, xr, W)], '╗': [v(xr, yt, H), v(xl, yb, H), hz(yt, 0, xr + t), hz(yb, 0, xl + t)],
    '╚': [v(xl, 0, yb + t), v(xr, 0, yt + t), hz(yb, xl, W), hz(yt, xr, W)], '╝': [v(xr, 0, yb + t), v(xl, 0, yt + t), hz(yb, 0, xr + t), hz(yt, 0, xl + t)],
    '╠': [v(xl, 0, H), v(xr, 0, yt + t), v(xr, yb, H), hz(yt, xr, W), hz(yb, xr, W)], '╣': [v(xr, 0, H), v(xl, 0, yt + t), v(xl, yb, H), hz(yt, 0, xl + t), hz(yb, 0, xl + t)],
    '╦': [hz(yt, 0, W), hz(yb, 0, xl + t), hz(yb, xr, W), v(xl, yb, H), v(xr, yb, H)], '╩': [hz(yb, 0, W), hz(yt, 0, xl + t), hz(yt, xr, W), v(xl, 0, yt + t), v(xr, 0, yt + t)],
    '╬': [v(xl, 0, yt + t), v(xl, yb, H), v(xr, 0, yt + t), v(xr, yb, H), hz(yt, 0, xl + t), hz(yt, xr, W), hz(yb, 0, xl + t), hz(yb, xr, W)],
  };
  return { single, double };
}
const HEAVY_OF = { '━': '─', '┃': '│', '┏': '┌', '┓': '┐', '┗': '└', '┛': '┘', '┣': '├', '┫': '┤', '┳': '┬', '┻': '┴', '╋': '┼', '╸': '╴', '╹': '╵', '╺': '╶', '╻': '╷' };
const ROUNDED = { '╭': '┌', '╮': '┐', '╯': '┘', '╰': '└' };
const DASHED = { '┄': '─', '┅': '━', '┆': '│', '┇': '┃', '┈': '─', '┉': '━', '┊': '│', '┋': '┃', '╌': '─', '╍': '━', '╎': '│', '╏': '┃' };

/** @returns {Uint8Array|undefined} w*h cells of 0 or 1, or undefined when the glyph needs a font */
export function paintCell(ch, w, h) {
  const grid = new Uint8Array(w * h);
  const fill = (rects) => { for (const r of rects) for (let y = Math.max(0, r.y0); y < Math.min(h, r.y1); y++) for (let x = Math.max(0, r.x0); x < Math.min(w, r.x1); x++) grid[y * w + x] = 1; };
  if (BLOCKS[ch]) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = (x + 0.5) / w, fy = (y + 0.5) / h;
      if (BLOCKS[ch].some((r) => fx >= r.x0 && fx < r.x1 && fy >= r.y0 && fy < r.y1)) grid[y * w + x] = 1;
    }
    return grid;
  }
  if (SHADES[ch]) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (SHADES[ch](x, y)) grid[y * w + x] = 1; return grid; }
  const heavy = HEAVY_OF[ch] ?? HEAVY_OF[DASHED[ch]];
  const base = heavy ?? ROUNDED[ch] ?? DASHED[ch] ?? ch;
  const { single, double } = lines(w, h, heavy ? HEAVY(w) : LIGHT(w));
  if (single[base]) { fill(single[base]); return grid; }
  if (double[base]) { fill(double[base]); return grid; }
  if (ch === '╱' || ch === '╲' || ch === '╳') {
    const t = LIGHT(w);
    for (let y = 0; y < h; y++) {
      const f = (y + 0.5) / h;
      if (ch !== '╲') fill([{ x0: Math.round((1 - f) * w - t / 2), y0: y, x1: Math.round((1 - f) * w + t / 2) || 1, y1: y + 1 }]);
      if (ch !== '╱') fill([{ x0: Math.round(f * w - t / 2), y0: y, x1: Math.round(f * w + t / 2) || 1, y1: y + 1 }]);
    }
    return grid;
  }
  return undefined;
}
