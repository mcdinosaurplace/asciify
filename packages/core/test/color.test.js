import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseColor, toHex, gradient, fitContrast, contrast, PRESETS, makeColorway, fitColorway, check, nearest256, colorizeText, colorizeBitmap, colorizeSketch, stripAnsi, parseBitmap, htmlText, htmlBitmap, htmlSketch, imageToSketch } from '../index.js';

test('colors parse from hex and rgb, and gradients interpolate', () => {
  assert.deepEqual(parseColor('#f00'), [255, 0, 0]);
  assert.deepEqual(parseColor('00ff00'), [0, 255, 0]);
  assert.deepEqual(parseColor('rgb(1, 2, 3)'), [1, 2, 3]);
  assert.deepEqual(parseColor('rgba(300 2 3 / 0.5)'), [255, 2, 3]);
  assert.throws(() => parseColor('blue'), /not a color/);
  assert.equal(toHex([255, 0, 128]), '#ff0080');
  assert.deepEqual(gradient([[0, 0, 0], [100, 200, 50]], 0.5), [50, 100, 25]);
  assert.deepEqual(gradient([[0, 0, 0], [10, 10, 10], [20, 20, 20]], 0.75), [15, 15, 15]);
});

test('fitContrast pushes a color away from its background until it reads', () => {
  const onWhite = fitContrast([255, 255, 0], '#ffffff');
  assert.ok(contrast(toHex(onWhite), '#ffffff') >= 4.5);
  const onDark = fitContrast([43, 108, 122], '#111111');
  assert.ok(contrast(toHex(onDark), '#111111') >= 4.5);
  assert.deepEqual(fitContrast([0, 0, 255], '#ffffff'), [0, 0, 255], 'a color that already reads is untouched');
});

test('every preset passes the contrast check in both themes once fitted', () => {
  for (const name of Object.keys(PRESETS)) {
    const cw = { name, ...PRESETS[name] };
    const colors = {};
    for (const theme of ['dark', 'light']) {
      const p = fitColorway(cw, theme);
      colors[theme] = [...p.stops, p.shadow, p.accent].map(toHex);
    }
    const r = check('a\n', { colors });
    assert.deepEqual(r.warnings.filter((w) => w.check === 'themes'), [], name);
  }
  assert.equal(Object.keys(PRESETS).length, 7);
});

test('makeColorway derives the missing slots from the primary and keeps the given ones', () => {
  const cw = makeColorway({ name: 'brand', primary: '#3366cc' });
  assert.equal(cw.stops[0], '#3366cc');
  assert.equal(cw.stops.length, 2);
  assert.ok(cw.shadow !== cw.stops[0] && cw.accent !== cw.stops[0]);
  const full = makeColorway({ name: 'b', primary: '#3366cc', secondary: '#cc3366', complementary: '#66cc33' });
  assert.deepEqual([full.stops[1], full.accent], ['#cc3366', '#66cc33']);
});

test('nearest256 lands on the cube or the gray ramp', () => {
  assert.equal(nearest256([0, 0, 0]), 16);
  assert.equal(nearest256([255, 255, 255]), 231);
  assert.equal(nearest256([255, 0, 0]), 196);
  assert.equal(nearest256([128, 128, 128]), 244);
});

test('colorizeText: a vertical gradient by row, shadow glyphs in the shadow slot, runs merged, and a 256 fallback', () => {
  const palette = { stops: [[255, 0, 0], [0, 0, 255]], shadow: [1, 2, 3] };
  assert.equal(colorizeText('AA\nB\n', palette), '\x1b[38;2;255;0;0mAA\x1b[0m\n\x1b[38;2;0;0;255mB\x1b[0m\n');
  assert.equal(colorizeText('A╗\n', palette), '\x1b[38;2;255;0;0mA\x1b[38;2;1;2;3m╗\x1b[0m\n');
  assert.equal(colorizeText('A\n', palette, { depth: '256' }), '\x1b[38;5;196mA\x1b[0m\n');
  const h = colorizeText('AB\n', palette, { direction: 'horizontal' });
  assert.equal(stripAnsi(h), 'AB\n');
  assert.ok(h.includes('255;0;0mA') && h.includes('0;0;255mB'));
});

test('colorizeBitmap: two regions in one cell render ▀ with the bottom color behind', () => {
  const b = parseBitmap('A\nB\n');
  const out = colorizeBitmap(b, { stops: [[9, 9, 9]], shadow: [1, 1, 1], accent: [2, 2, 2] }, { regionColors: { A: [255, 0, 0], B: [0, 0, 255] } });
  assert.equal(out, '\x1b[38;2;255;0;0m\x1b[48;2;0;0;255m▀\x1b[0m\n');
  const one = colorizeBitmap(parseBitmap('##\n##\n'), { stops: [[10, 20, 30]], shadow: [1, 1, 1], accent: [2, 2, 2] });
  assert.equal(one, '\x1b[38;2;10;20;30m██\x1b[0m\n');
  assert.equal(stripAnsi(one), '██\n');
});

test('colorizeSketch colors each cell from the image, and the plain form survives stripping', () => {
  const rgb = Uint8Array.from([255, 0, 0, 0, 255, 0]);
  const out = colorizeSketch('ab\n', rgb, 2);
  assert.equal(out, '\x1b[38;2;255;0;0ma\x1b[38;2;0;255;0mb\x1b[0m\n');
  assert.equal(stripAnsi(out), 'ab\n');
});

test('htmlText carries both themes, stepped gradient classes, shadow spans, a unique id, and the alt text', () => {
  const cw = { name: 'synthwave', ...PRESETS.synthwave };
  const html = htmlText('A╗\nB\n', { alt: 'A, a "test"', dark: fitColorway(cw, 'dark'), light: fitColorway(cw, 'light') });
  assert.ok(html.includes('role="img" aria-label="A, a &quot;test&quot;"'));
  assert.ok(html.includes('aria-label="A, a &quot;test&quot;">\n<span class="g0">A</span><span class="s">╗</span>\n<span class="g31">B</span>'), 'a newline after the pre tag so a blank first row survives');
  assert.ok(!html.includes('background-clip'), 'no clipped gradient, which leaves seams at glyph edges');
  assert.ok(html.includes('prefers-color-scheme:light') && html.includes('@media print'));
  const id = html.match(/<div class="(asciify-[0-9a-f]{6})"/)[1];
  assert.notEqual(id, htmlText('other\n', { alt: '', dark: fitColorway(cw, 'dark'), light: fitColorway(cw, 'light') }).match(/<div class="(asciify-[0-9a-f]{6})"/)[1], 'ids differ per art so several snippets share a page');
  const vars = (block) => [...block.matchAll(/--(?:g\d+|shadow):(#[0-9a-f]{6})/g)].map((m) => m[1]);
  const [darkBlock, lightBlock] = html.split(`.${id}.light`);
  assert.equal(vars(darkBlock).length, 33);
  assert.deepEqual(check('a\n', { colors: { dark: vars(darkBlock), light: vars(lightBlock.split('@media')[0]) } }).warnings, []);
});

test('htmlBitmap gives extra regions classes and the bottom pixel a background class', () => {
  const cw = { name: 'mono', ...PRESETS.mono };
  const html = htmlBitmap(parseBitmap('A\nB\n'), { alt: 'two', dark: fitColorway(cw, 'dark'), light: fitColorway(cw, 'light') });
  assert.ok(html.includes('<span class="g0 b-r1">▀</span>'), html);
  assert.ok(html.includes('.r1{color:var(--r1)}') && html.includes('.b-r1{background:var(--r1)}'));
});

test('htmlSketch bakes the ground and inlines the image colors, and sketch mode returns per-cell color', () => {
  const html = htmlSketch('ab\n', Uint8Array.from([255, 0, 0, 0, 255, 0]), 2, { alt: 's', ground: 'dark' });
  assert.ok(html.includes('<span style="color:#ff0000">a</span><span style="color:#00ff00">b</span>'));
  assert.ok(html.includes('--bg:#111111'));
  const w = 120, h = 60, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([200, 30, 30, 255], i * 4);
  const s = imageToSketch({ width: w, height: h, data }, { cols: 60 });
  assert.equal(s.rgb.length, 60 * 15 * 3);
  assert.deepEqual([s.rgb[0], s.rgb[1], s.rgb[2]], [200, 30, 30]);
});
