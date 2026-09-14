// HTML: a `pre` whose runs of cells carry classes for the gradient step, the shadow slot, or a region, with CSS variables
// for both themes; or, for image color, spans per run of the image's own color on a ground baked into the file.
// The gradient is quantized into steps and applied by class, not clipped to the text: clipping leaves seams at glyph edges.
import { toHex, gradient } from './color.js';
import { glyphClass, regionKeys } from './ansi.js';

const FONT = '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
const STEPS = 32;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const splitLines = (text) => { const lines = text.split('\n'); if (lines.length && lines[lines.length - 1] === '') lines.pop(); return lines; };
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0').slice(0, 6); };
const position = (direction, x, y, cols, rows) => {
  const fx = x / Math.max(1, cols - 1), fy = y / Math.max(1, rows - 1);
  return direction === 'horizontal' ? fx : direction === 'diagonal' ? (fx + fy) / 2 : fy;
};
const step = (t) => Math.round(Math.max(0, Math.min(1, t)) * (STEPS - 1));

// Runs of cells sharing one class pair become one span. `cells` per row: [{ch, cls, bg}] with cls null for the ground.
function body(rows) {
  return rows.map((cells) => {
    let out = '', run = '', cur = null;
    const flush = () => {
      if (!run) return;
      const classes = cur ? [cur.cls, cur.bg && `b-${cur.bg}`].filter(Boolean).join(' ') : '';
      out += classes ? `<span class="${classes}">${esc(run)}</span>` : esc(run);
      run = '';
    };
    for (const cell of cells) {
      const key = cell.ch === ' ' ? cur : { cls: cell.cls, bg: cell.bg ?? null };
      const same = cur === key || (cur && key && cur.cls === key.cls && cur.bg === key.bg);
      if (!same) { flush(); cur = key; }
      run += cell.ch;
    }
    flush();
    return out;
  }).join('\n');
}

// `dark` and `light`: fitted palettes; `regions`: [{cls, dark, light}] fixed colors; `ground`: bake one background, no theme switch
function wrap({ id, cols, alt, rows, dark, light, regions = [], steps = true, ground }) {
  const vars = (p, theme) => [
    `--bg:${p.background}`,
    ...(steps ? Array.from({ length: STEPS }, (_, i) => `--g${i}:${toHex(gradient(p.stops, i / (STEPS - 1)))}`) : [`--fg:${toHex(p.stops[0])}`]),
    `--shadow:${toHex(p.shadow)}`,
    ...regions.map((r) => `--${r.cls}:${toHex(r[theme])}`),
  ].join(';');
  const css = [
    `.${id}{${vars(dark, 'dark')};display:inline-block;padding:1em;background:var(--bg)}`,
    ground ? '' : `.${id}.light{${vars(light, 'light')}}`,
    ground ? '' : `@media (prefers-color-scheme:light){.${id}:not(.dark){${vars(light, 'light')}}}`,
    `.${id} pre{--cols:${cols};margin:0;font:14px/1 ${FONT};letter-spacing:0;font-variant-ligatures:none;white-space:pre;color:var(${steps ? '--g0' : '--fg'})}`,
    ...(steps ? Array.from({ length: STEPS }, (_, i) => `.${id} .g${i}{color:var(--g${i})}`) : []),
    `.${id} .s{color:var(--shadow)}`,
    ...regions.map((r) => `.${id} .${r.cls}{color:var(--${r.cls})}.${id} .b-${r.cls}{background:var(--${r.cls})}`),
    `@media print{.${id}{background:none}.${id} pre{color:#000;font-size:calc(100vw / (var(--cols) * 0.62))}.${id} pre span{color:#000;background:none}.${id} .s{color:#555}}`,
  ].filter(Boolean).join('\n');
  // a browser drops the first newline after <pre>, so one is always emitted and a blank first row survives
  return `<style>\n${css}\n</style>\n<div class="${id}"><pre role="img" aria-label="${esc(alt)}">\n${body(rows)}</pre></div>\n`;
}

/** Strategy one: fill glyphs step through the gradient by position, shadow glyphs get the shadow slot. */
export function htmlText(text, { alt = '', dark, light, id }) {
  const lines = splitLines(text);
  const cols = lines.reduce((w, l) => Math.max(w, [...l].length), 0), direction = dark.direction ?? 'vertical';
  const rows = lines.map((line, y) => [...line].map((ch, x) => ({ ch, cls: ch === ' ' ? null : glyphClass(ch) === 'shadow' ? 's' : `g${step(position(direction, x, y, cols, lines.length))}` })));
  return wrap({ id: id ?? `asciify-${hash(text + JSON.stringify(dark))}`, cols, alt, rows, dark, light });
}

/**
 * Strategy one for a bitmap: the largest region steps through the gradient; other regions get classes, and a cell whose top
 * and bottom pixels belong to different regions renders ▀ with the bottom region's color as the span's background.
 */
export function htmlBitmap(bitmap, { alt = '', dark, light, regionColors = {}, id }) {
  const keys = regionKeys(bitmap), direction = dark.direction ?? 'vertical', rowCount = bitmap.height / 2;
  const slot = (p, i) => [p.accent, p.shadow, ...p.stops][((i % (2 + p.stops.length)) + 2 + p.stops.length) % (2 + p.stops.length)];
  const all = keys.map((k, i) => ({ key: k, cls: `r${i}`, dark: regionColors[k]?.dark ?? slot(dark, i - 1), light: regionColors[k]?.light ?? slot(light, i - 1) }));
  const fixed = all.filter((r, i) => i > 0 || regionColors[r.key]);
  const clsOf = (key, x, y) => fixed.find((r) => r.key === key)?.cls ?? `g${step(position(direction, x, y, bitmap.width, rowCount))}`;
  const rows = [];
  for (let y = 0; y < rowCount; y++) {
    let width = bitmap.width;
    while (width > 0 && bitmap.cells[2 * y][width - 1] === null && bitmap.cells[2 * y + 1][width - 1] === null) width--;
    const cells = [];
    for (let x = 0; x < width; x++) {
      const t = bitmap.cells[2 * y][x], b = bitmap.cells[2 * y + 1][x];
      if (t !== null && b !== null) cells.push(t === b ? { ch: '█', cls: clsOf(t, x, y) } : { ch: '▀', cls: clsOf(t, x, y), bg: fixed.find((r) => r.key === b)?.cls ?? 'r0' });
      else if (t !== null) cells.push({ ch: '▀', cls: clsOf(t, x, y) });
      else if (b !== null) cells.push({ ch: '▄', cls: clsOf(b, x, y) });
      else cells.push({ ch: ' ', cls: null });
    }
    rows.push(cells);
  }
  // the largest region needs a variable too when it sits behind a ▀ of another region
  const regions = fixed.some((r) => r.cls === 'r0') || !rows.flat().some((c) => c.bg === 'r0') ? fixed : [{ ...all[0], dark: dark.stops[0], light: light.stops[0] }, ...fixed];
  return wrap({ id: id ?? `asciify-${hash(JSON.stringify([bitmap.cells, dark, regionColors]))}`, cols: bitmap.width, alt, rows, dark, light, regions });
}

/** Strategy two: one span per run of the image's own color, on a ground baked into the file. */
export function htmlSketch(text, rgb, width, { alt = '', ground = 'dark', id }) {
  const lines = splitLines(text);
  const background = ground === 'light' ? '#ffffff' : '#111111';
  const out = lines.map((line, y) => {
    let s = '', run = '', cur = null;
    const flush = () => { if (run) s += cur ? `<span style="color:${cur}">${esc(run)}</span>` : esc(run); run = ''; };
    [...line].forEach((ch, x) => {
      const i = (y * width + x) * 3, hex = ch === ' ' ? cur : toHex([rgb[i], rgb[i + 1], rgb[i + 2]]);
      if (hex !== cur) { flush(); cur = hex; }
      run += ch;
    });
    flush();
    return s;
  }).join('\n');
  const p = { background, stops: [[230, 230, 230]], shadow: [122, 122, 122], accent: [255, 255, 255] };
  const html = wrap({ id: id ?? `asciify-${hash(text + ground)}`, cols: width, alt, rows: [], dark: p, light: p, steps: false, ground });
  return html.replace(/<pre([^>]*)>\n<\/pre>/, `<pre$1>\n${out}</pre>`);
}
