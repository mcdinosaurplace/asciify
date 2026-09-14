import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameFromText, frameToText, paintFrame, frameFromBitmap, ansiFrame, htmlFrame, clipToJSON, clipFromJSON, EFFECTS, effectNames, animate, parseEffects, encodeGIF, inspectGIF, imageFromFrame, render, check, fitColorway, PRESETS, parseBitmap, stripAnsi } from '../index.js';

const art = render('WIZ', 'ANSI Regular').text;
const palette = fitColorway({ name: 'synthwave', ...PRESETS.synthwave }, 'dark');
const base = paintFrame(frameFromText(art), palette);
const lit = (f) => f.cells.flat().filter((c) => c !== ' ').length;

test('frames pad to one width, paint from a palette, and round-trip through JSON and text', () => {
  const f = frameFromText('ab\nc\n');
  assert.deepEqual([f.width, f.height, f.cells[1]], [2, 2, ['c', ' ']]);
  assert.equal(frameToText(f), 'ab\nc\n');
  assert.equal(frameToText(f, { pad: true }), 'ab\nc \n');
  assert.ok(base.fg[0][0] && !base.fg[0][2], 'lit cells get a color, gaps do not');
  const clip = animate(base, { effects: parseEffects('typewriter,glitch:0.5'), fps: 6, seed: 3 });
  const back = clipFromJSON(clipToJSON(clip));
  assert.equal(clipToJSON(back), clipToJSON(clip));
  assert.equal(stripAnsi(ansiFrame(base)), frameToText(base, { pad: true }));
  assert.ok(htmlFrame(base).includes('<span style="color:#'));
});

test('every effect keeps the frame size, and a seed reproduces a run while another seed does not', () => {
  for (const name of Object.keys(EFFECTS)) {
    for (const t of [0, 0.37, 1]) {
      const a = EFFECTS[name].apply(base, t, { intensity: 0.8, seed: 5, index: 3, params: {} });
      const b = EFFECTS[name].apply(base, t, { intensity: 0.8, seed: 5, index: 3, params: {} });
      assert.deepEqual([a.width, a.height, a.cells.length, a.cells[0].length], [base.width, base.height, base.height, base.width], name);
      assert.deepEqual(a, b, `${name} reproduces with the same seed`);
    }
  }
  const s1 = EFFECTS.dissolve.apply(base, 0.5, { intensity: 1, seed: 1, index: 0, params: {} });
  const s2 = EFFECTS.dissolve.apply(base, 0.5, { intensity: 1, seed: 2, index: 0, params: {} });
  assert.notDeepEqual(s1.cells, s2.cells);
});

test('reveals build up to the source: nothing at zero intensity changes, full intensity ends on the source', () => {
  for (const name of effectNames('reveal')) {
    const end = EFFECTS[name].apply(base, 1, { intensity: 1, seed: 1, index: 9, params: {} });
    assert.deepEqual(end.cells, base.cells, `${name} ends on the source`);
    const untouched = EFFECTS[name].apply(base, 0.2, { intensity: 0, seed: 1, index: 9, params: {} });
    assert.deepEqual(untouched.cells, base.cells, `${name} at intensity 0 does nothing`);
  }
  const t = [0, 0.25, 0.5, 0.75, 1].map((p) => lit(EFFECTS.typewriter.apply(base, p, { intensity: 1, seed: 1, index: 0, params: {} })));
  assert.ok(t.every((v, i) => i === 0 || v >= t[i - 1]) && t[0] === 0 && t[4] === lit(base), `typewriter climbs: ${t}`);
  const half = EFFECTS.wipe.apply(base, 0.5, { intensity: 1, seed: 1, index: 0, params: {} });
  assert.ok(half.cells.every((row) => row.slice(Math.ceil(base.width / 2)).every((c) => c === ' ')), 'a wipe hides the right half at midway');
});

test('loops: scroll returns to the source at the start of a cycle, blink hides, roll rotates rows, color effects leave glyphs alone', () => {
  const at0 = EFFECTS.scroll.apply(base, 0, { intensity: 1, seed: 1, index: 0, params: {} });
  assert.deepEqual(at0.cells, base.cells);
  const moved = EFFECTS.scroll.apply(base, 0.3, { intensity: 1, seed: 1, index: 0, params: {} });
  assert.notDeepEqual(moved.cells, base.cells);
  assert.equal(lit(EFFECTS.blink.apply(base, 0.9, { intensity: 1, seed: 1, index: 0, params: {} })), 0);
  const rolled = EFFECTS.roll.apply(base, 0.5, { intensity: 1, seed: 1, index: 0, params: {} });
  assert.deepEqual(rolled.cells[0], base.cells[Math.floor(0.5 * base.height)]);
  for (const name of effectNames('color')) {
    const out = EFFECTS[name].apply(base, 0.4, { intensity: 1, seed: 1, index: 0, params: {} });
    if (name !== 'glow') assert.deepEqual(out.cells, base.cells, `${name} keeps the glyphs`);
  }
  const hue = EFFECTS['hue-cycle'].apply(base, 0.5, { intensity: 1, seed: 1, index: 0, params: {} });
  assert.notDeepEqual(hue.fg[0][0], base.fg[0][0]);
});

test('the composer: a reveal then a loop, frame counts from fps and seconds, the loop start, and the frame checks pass', () => {
  const clip = animate(base, { effects: parseEffects('typewriter,crt:0.6,glitch:0.3'), fps: 12, revealSeconds: 2, loopSeconds: 2, cycles: 1, seed: 7 });
  assert.deepEqual([clip.frames.length, clip.loopFrom, clip.fps], [48, 24, 12]);
  assert.equal(frameToText(clip.frames[23]), frameToText(base), 'the reveal ends on the source');
  const texts = clip.frames.map((f) => frameToText(f, { pad: true }));
  const c = check(frameToText(base), { band: 1000, frames: texts.slice(0, 24), source: frameToText(base, { pad: true }) });
  assert.deepEqual(check(frameToText(base), { band: 1000, frames: texts }).errors, []);
  assert.deepEqual(c.errors, []);
  assert.equal(animate(base, { effects: [] }).frames.length, 1);
  assert.equal(animate(base, { effects: parseEffects('scroll'), fps: 10, loopSeconds: 1.5, cycles: 2 }).frames.length, 30);
  assert.throws(() => parseEffects('nope'), /unknown effect/);
  assert.deepEqual(parseEffects('scroll:0.5:direction=up:gap=2')[0], { name: 'scroll', intensity: 0.5, params: { direction: 'up', gap: 2 } });
});

test('a bitmap frame keeps two regions in one cell, and the GIF encoder writes a looping file with every frame', () => {
  const f = frameFromBitmap(parseBitmap('A\nB\n'), palette, { regionColors: { A: [255, 0, 0], B: [0, 0, 255] } });
  assert.deepEqual([f.cells[0][0], f.fg[0][0], f.bg[0][0]], ['▀', [255, 0, 0], [0, 0, 255]]);
  const clip = animate(base, { effects: parseEffects('wipe'), fps: 8, revealSeconds: 1 });
  const images = clip.frames.map((fr) => imageFromFrame(fr, { cellW: 4, cellH: 8, background: [17, 17, 17] }));
  const gif = encodeGIF(images, { fps: 8, loop: true });
  const info = inspectGIF(gif);
  assert.deepEqual(info, { signature: 'GIF89a', width: base.width * 4, height: base.height * 8, frames: 8, loops: true, trailer: true });
  const once = inspectGIF(encodeGIF(images.slice(0, 2), { fps: 8, loop: false }));
  assert.deepEqual([once.frames, once.loops], [2, false]);
  const many = Array.from({ length: 400 }, (_, i) => [i % 256, (i * 7) % 256, (i * 13) % 256, 255]).flat();
  const busy = { width: 20, height: 20, data: new Uint8ClampedArray(20 * 20 * 4) };
  for (let i = 0; i < 400; i++) busy.data.set(many.slice(i * 4, i * 4 + 4), i * 4);
  assert.equal(inspectGIF(encodeGIF([busy])).frames, 1, 'more than 255 colors quantize instead of failing');
});
