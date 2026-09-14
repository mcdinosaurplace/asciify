// Wordmarks: render text in a font, step down the ladder until it fits the band, and offer previews by family.
import { renderRaw, renderLine, trimBlankRows, fontNames, fontInfo, fontGlyphs, hasFont, families } from './figlet.js';
import { measure } from './measure.js';
import { check, BANDS } from './check.js';

const FAMILY_LABEL = { block: 'block-letter', box: 'box-drawing', sans: 'sans-serif', serif: 'serif', script: 'script', '3d': 'three-dimensional', retro: 'retro', decorative: 'decorative' };
const TAIL = ['Calvin S', 'Small'];
const width = (rows) => rows.reduce((w, r) => { const n = [...r].length; return n > w ? n : w; }, 0);
const maxColsOf = (band) => { const n = typeof band === 'number' ? band : BANDS[band]; if (n === undefined) throw new Error(`unknown band: ${band}`); return n; };

export function alt(text, font) {
  const label = FAMILY_LABEL[fontInfo(font)?.family];
  return `${text.replace(/\n/g, ' ')}, ${label ? `${label} ` : ''}wordmark in ${font}`;
}

// Wide tracking: each character on its own, joined by `n` columns. Rows keep the font's full height so baselines line up.
function spaced(line, font, layout, n) {
  const glyphs = [...line].map((ch) => renderRaw(ch, font, { layout }));
  const height = Math.max(...glyphs.map((g) => g.length));
  const rows = [];
  for (let r = 0; r < height; r++) {
    rows.push(glyphs.map((g) => { const row = g[r] ?? ''; return row + ' '.repeat(width(g) - [...row].length); }).join(' '.repeat(n)).replace(/\s+$/, ''));
  }
  return trimBlankRows(rows);
}

/** Render text (lines split on newline) in one font. Returns {text, cols, rows}. */
export function render(text, font, { layout, letterSpacing = 0, leading = 0, align = 'left' } = {}) {
  const blocks = text.split('\n').map((line) => (letterSpacing > 0 ? spaced(line, font, layout, letterSpacing) : renderLine(line, font, { layout })));
  const widest = Math.max(...blocks.map(width));
  const rows = [];
  blocks.forEach((block, i) => {
    if (i > 0) for (let k = 0; k < leading; k++) rows.push('');
    const w = width(block);
    const pad = align === 'center' ? Math.floor((widest - w) / 2) : align === 'right' ? widest - w : 0;
    for (const row of block) rows.push(row ? ' '.repeat(pad) + row : '');
  });
  const out = rows.join('\n') + '\n';
  const m = measure(out);
  return { text: out, cols: m.cols, rows: m.rows };
}

// Break at the space that makes the two lines most even in the font.
function splitTwo(text, font, layout) {
  const words = text.split(' ');
  let best;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const w = Math.max(width(renderLine(a, font, { layout })), width(renderLine(b, font, { layout })));
    if (!best || w < best.w) best = { w, text: `${a}\n${b}` };
  }
  return best.text;
}

function preferredIn(family) {
  const names = fontNames({ family });
  if (!names.length) throw new Error(`unknown family: ${family}. Families: ${families().join(', ')}.`);
  return names.find((n) => fontInfo(n).blessed) ?? names[0];
}

/**
 * The ladder: the preferred font on one line, then ANSI Regular if the preferred was ANSI Shadow, then the preferred on two lines
 * broken at a space, then Calvin S and Small. The first that fits the band wins. If nothing fits, the last try comes back with fits false.
 */
export function wordmark(text, options = {}) {
  const { font, family, band = 'standard', maxRows = 20, layout, letterSpacing, leading, align } = options;
  if (font && !hasFont(font)) throw new Error(`unknown font: ${font}`);
  const maxCols = maxColsOf(band);
  const preferred = font ?? (family ? preferredIn(family) : 'ANSI Shadow');
  const ladder = [];
  const push = (f, lines) => { if (!ladder.some((s) => s.font === f && s.lines === lines)) ladder.push({ font: f, lines }); };
  push(preferred, 1);
  if (preferred === 'ANSI Shadow') push('ANSI Regular', 1);
  if (text.includes(' ')) push(preferred, 2);
  for (const f of TAIL) { push(f, 1); if (text.includes(' ')) push(f, 2); }
  let last;
  for (const step of ladder) {
    const input = step.lines === 2 ? splitTwo(text, step.font, layout) : text;
    const r = render(input, step.font, { layout, letterSpacing, leading, align });
    last = { ...r, font: step.font, lines: step.lines, input, fits: r.cols <= maxCols && r.rows <= maxRows };
    if (last.fits) break;
  }
  const result = check(last.text, { mode: 'wordmark', band, maxRows, allow: fontGlyphs(last.font) });
  return { ...last, check: result, alt: alt(text, last.font) };
}

/** Alternates from a family, fitting ones first. */
export function previews(text, { family, exclude, count = 3, band = 'standard', maxRows = 20, layout } = {}) {
  const fam = family ?? fontInfo(exclude)?.family ?? 'block';
  const maxCols = maxColsOf(band);
  const all = fontNames({ family: fam }).filter((n) => n !== exclude).map((name) => {
    const r = render(text, name, { layout });
    return { ...r, font: name, fits: r.cols <= maxCols && r.rows <= maxRows };
  });
  return [...all.filter((p) => p.fits), ...all.filter((p) => !p.fits)].slice(0, count);
}
