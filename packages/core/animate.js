// The composer: a base frame and a list of effects become a clip of frames, a reveal segment then a loop segment.
import { EFFECTS } from './effects.js';
import { cloneFrame } from './frames.js';

/** "typewriter,glitch:0.5,scroll:1:direction=up" into [{name, intensity, params}]. */
export function parseEffects(spec) {
  if (!spec) return [];
  return String(spec).split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [name, intensity, ...rest] = s.split(':');
    if (!EFFECTS[name]) throw new Error(`unknown effect: ${name}. Effects: ${Object.keys(EFFECTS).join(', ')}.`);
    const params = {};
    for (const kv of rest) { const [k, v] = kv.split('='); params[k] = isNaN(Number(v)) ? v : Number(v); }
    return { name, intensity: intensity === undefined || intensity === '' ? 1 : Math.max(0, Math.min(1, Number(intensity))), params };
  });
}

/**
 * @param {object} base a frame
 * @param {object} spec {effects: [{name, intensity, params}], fps, revealSeconds, loopSeconds, cycles, seed}
 * @returns {{fps, width, height, frames, loopFrom}} loopFrom is the index the players return to, or null when the clip plays once
 */
export function animate(base, { effects = [], fps = 12, revealSeconds = 2, loopSeconds = 2, cycles = 1, seed = 1 } = {}) {
  const reveals = effects.filter((e) => EFFECTS[e.name].kind === 'reveal'), loops = effects.filter((e) => EFFECTS[e.name].kind === 'loop'), colors = effects.filter((e) => EFFECTS[e.name].kind === 'color');
  const run = (list, frame, t, index) => list.reduce((f, e) => EFFECTS[e.name].apply(f, t, { intensity: e.intensity, seed, index, params: e.params ?? {} }), frame);
  const frames = [];
  const nReveal = reveals.length ? Math.max(2, Math.round(fps * revealSeconds)) : 0;
  for (let i = 0; i < nReveal; i++) { const t = i / (nReveal - 1); frames.push(run(colors, run(reveals, base, t, i), t, i)); }
  const perCycle = loops.length || (colors.length && !reveals.length) ? Math.max(2, Math.round(fps * loopSeconds)) : 0;
  for (let i = 0; i < perCycle * cycles; i++) { const t = (i % perCycle) / perCycle; frames.push(run(colors, run(loops, base, t, nReveal + i), t, nReveal + i)); }
  if (!frames.length) frames.push(cloneFrame(base));
  return { fps, width: base.width, height: base.height, frames, loopFrom: perCycle ? nReveal : null };
}
