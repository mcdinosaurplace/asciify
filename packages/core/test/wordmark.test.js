import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FONTS, fontNames, fontGlyphs, renderLine, wordmark, previews, render, alt, interpret, check } from '../index.js';

const render05 = readFileSync(new URL('./fixtures/05-wordmark-list-sorcerer-two-lines.txt', import.meta.url), 'utf8');
const width = (rows) => Math.max(0, ...rows.map((r) => [...r].length));

test('the nine blessed fonts render WIZARD and LIST SORCERER at their expected sizes', () => {
  const table = { 'Calvin S': [16, 36, 3], Pagga: [24, 50, 3], Small: [34, 58, 4], Standard: [42, 73, 5], 'ANSI Regular': [44, 96, 5],
    'ANSI Shadow': [45, 97, 6], 'Delta Corps Priest 1': [65, 144, 9], Electronic: [78, 161, 11], 'DOS Rebel': [79, 148, 8] };
  for (const [font, [w1, w2, rows]] of Object.entries(table)) {
    const a = render('WIZARD', font), b = render('LIST SORCERER', font);
    assert.deepEqual([a.cols, b.cols, a.rows], [w1, w2, rows], font);
  }
});

test('the catalog numbers match live renders for every embedded font', () => {
  for (const [name, info] of Object.entries(FONTS)) {
    const rows = renderLine('ABCDEFGHIJKLMNOPQRSTUVWXYZ', name);
    assert.equal(rows.length, info.rows, `${name} rows`);
    assert.equal((width(rows) / 26).toFixed(1), info.perLetter.toFixed(1), `${name} per letter`);
  }
  assert.ok(Object.keys(FONTS).length >= 32);
  assert.equal(Object.values(FONTS).filter((f) => f.blessed).length, 9);
});

test('WIZARD passes the checks in every embedded font, size aside', (t) => {
  const warned = [];
  for (const name of fontNames()) {
    const r = render('WIZARD', name);
    const c = check(r.text, { mode: 'wordmark', band: 200, maxRows: 20, allow: fontGlyphs(name) });
    assert.deepEqual(c.errors, [], `${name}: ${JSON.stringify(c.errors)}`);
    if (c.warnings.length) warned.push(`${name}: ${c.warnings[0].message}`);
  }
  for (const w of warned) t.diagnostic(w);
});

test('the ladder breaks LIST SORCERER into two lines of ANSI Shadow, and the render matches a snapshot of the current engine', () => {
  const r = wordmark('LIST SORCERER');
  assert.deepEqual([r.font, r.lines, r.cols, r.rows, r.fits], ['ANSI Shadow', 2, 65, 12, true]);
  assert.equal(r.text, render05);
  assert.equal(r.check.ok, true);
  assert.equal(r.alt, 'LIST SORCERER, block-letter wordmark in ANSI Shadow');
});

test('the ladder keeps WIZARD on one line: ANSI Shadow in the standard band, ANSI Regular in the narrow band', () => {
  const s = wordmark('WIZARD');
  assert.deepEqual([s.font, s.lines, s.cols, s.rows], ['ANSI Shadow', 1, 45, 6]);
  const n = wordmark('WIZARD', { band: 'narrow' });
  assert.deepEqual([n.font, n.lines, n.cols, n.rows, n.fits], ['ANSI Regular', 1, 44, 5, true]);
});

test('a named font or family leads the ladder', () => {
  assert.equal(wordmark('WIZARD', { font: 'Pagga' }).font, 'Pagga');
  assert.equal(wordmark('WIZARD', { family: 'serif', band: 'wide' }).font, 'Roman');
  assert.throws(() => wordmark('WIZARD', { font: 'No Such Font' }), /unknown font/);
  assert.throws(() => wordmark('WIZARD', { family: 'nope' }), /unknown family/);
});

test('when nothing fits, the last try comes back with fits false and size errors', () => {
  const r = wordmark('SUPERCALIFRAGILISTIC', { band: 'narrow' });
  assert.equal(r.fits, false);
  assert.equal(r.font, 'Small');
  assert.ok(r.check.errors.some((e) => e.check === 'size'));
});

test('tracking, leading, and alignment', () => {
  const plain = render('WIZ', 'ANSI Regular');
  const tracked = render('WIZ', 'ANSI Regular', { letterSpacing: 2 });
  assert.ok(tracked.cols > plain.cols);
  assert.equal(tracked.rows, plain.rows);
  const two = render('AB\nWIZARD', 'ANSI Regular');
  const led = render('AB\nWIZARD', 'ANSI Regular', { leading: 1 });
  assert.equal(led.rows, two.rows + 1);
  const centered = render('AB\nWIZARD', 'ANSI Regular', { align: 'center' });
  assert.ok(centered.text.startsWith('   '), 'the short line is padded in');
  assert.equal(centered.cols, two.cols);
});

test('style words and typography terms become options', () => {
  assert.deepEqual(interpret('heavy tight centered').options, { font: 'Delta Corps Priest 1', layout: 'universal smushing', align: 'center' });
  assert.deepEqual(interpret('loose leading').options, { leading: 1 });
  assert.deepEqual(interpret('wide tracking').options, { letterSpacing: 1, layout: 'full' });
  assert.deepEqual(interpret('small caps, serif').options, { font: 'Small Caps', family: 'serif' });
  assert.deepEqual(interpret('blocky retro terminal').options, { family: 'block' }, 'retro means the terminal look, not the LCD family');
  assert.deepEqual(interpret('dot matrix').options, { family: 'retro' });
  const r = interpret('drop shadow please');
  assert.deepEqual(r.options, { font: 'ANSI Shadow' });
  assert.deepEqual(r.ignored, ['please']);
});

test('the font glyph set and the alt text', () => {
  const g = fontGlyphs('ANSI Shadow');
  assert.ok(g.includes('█') && g.includes('╗') && !g.includes('a'));
  assert.equal(alt('WIZARD', 'Calvin S'), 'WIZARD, box-drawing wordmark in Calvin S');
});

test('previews come from the family, fitting ones first, excluding the chosen font', () => {
  const p = previews('WIZ', { family: 'block', exclude: 'ANSI Shadow', count: 3 });
  assert.equal(p.length, 3);
  assert.ok(p.every((x) => x.font !== 'ANSI Shadow' && FONTS[x.font].family === 'block'));
  assert.ok(p.every((x) => x.fits));
});
