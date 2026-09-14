// Effects: pure functions of a frame, a time from 0 to 1, an intensity from 0 to 1, and a seed. Reveals build the frame up
// from nothing once; loops cycle over the finished frame; color effects change colors and leave the glyphs alone.
import { cloneFrame, blankFrame } from './frames.js';
import { rgbToHsl, hslToRgb, mix } from './color.js';

/** mulberry32: a small seeded generator, so every run with a seed reproduces. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NOISE = [...'!@#$%&*+=-<>?/\\|~^;:░▒▓█▀▄'];
const RAIN = [...'01ABCDEF7X9Z░▒'];
const DEFAULT = [230, 230, 230];
// a random number per cell that stays the same for the whole clip
const field = (frame, seed, salt = 0) => { const r = rng(seed * 7919 + salt); return frame.cells.map((row) => row.map(() => r())); };
const smooth = (f) => f.map((row, y) => row.map((_, x) => { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = f[y + dy]?.[x + dx]; if (v !== undefined) { s += v; n++; } } return s / n; }));
const progress = (t, intensity) => 1 - intensity * (1 - t);   // at intensity 0 a reveal is always complete
const hide = (out, x, y) => { out.cells[y][x] = ' '; out.fg[y][x] = null; out.bg[y][x] = null; };
const lit = (frame, x, y) => frame.cells[y][x] !== ' ' || frame.bg[y][x];
const shade = (rgb, k) => (rgb ?? DEFAULT).map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
const brighten = (rgb, k) => mix(rgb ?? DEFAULT, [255, 255, 255], k);
const eachColor = (frame, f) => { const out = cloneFrame(frame); for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y)) { out.fg[y][x] = f(out.fg[y][x] ?? DEFAULT, x, y); if (out.bg[y][x]) out.bg[y][x] = f(out.bg[y][x], x, y); } return out; };
const reveal = (frame, visible) => { const out = cloneFrame(frame); for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y) && !visible(x, y)) hide(out, x, y); return out; };
const shiftRow = (out, src, y, dx) => { for (let x = 0; x < out.width; x++) { const sx = x - dx; const on = sx >= 0 && sx < out.width; out.cells[y][x] = on ? src.cells[y][sx] : ' '; out.fg[y][x] = on ? src.fg[y][sx] : null; out.bg[y][x] = on ? src.bg[y][sx] : null; } };

export const EFFECTS = {
  // reveals
  typewriter: { kind: 'reveal', apply(frame, t, { intensity }) {
    const p = progress(t, intensity), order = [];
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) if (lit(frame, x, y)) order.push(y * frame.width + x);
    const shown = Math.floor(p * order.length + 1e-9), set = new Set(order.slice(0, shown));
    return reveal(frame, (x, y) => set.has(y * frame.width + x));
  } },
  wipe: { kind: 'reveal', apply(frame, t, { intensity, params }) {
    const p = progress(t, intensity), d = params.direction ?? 'left';
    return reveal(frame, (x, y) => (d === 'left' ? x < p * frame.width : d === 'right' ? frame.width - 1 - x < p * frame.width : d === 'down' ? y < p * frame.height : frame.height - 1 - y < p * frame.height));
  } },
  dissolve: { kind: 'reveal', apply(frame, t, { intensity, seed }) { const p = progress(t, intensity), f = field(frame, seed); return reveal(frame, (x, y) => f[y][x] <= p); } },
  rain: { kind: 'reveal', apply(frame, t, { intensity, seed }) {
    const p = progress(t, intensity), r = rng(seed * 31 + 5), delay = Array.from({ length: frame.width }, () => r() * 0.5);
    return reveal(frame, (x, y) => p >= delay[x] + (y / frame.height) * 0.5);
  } },
  static: { kind: 'reveal', apply(frame, t, { intensity, seed, index }) {
    const p = progress(t, intensity), f = field(frame, seed, index + 1), out = cloneFrame(frame), r = rng(seed * 13 + index);
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y) && f[y][x] > p) { out.cells[y][x] = NOISE[Math.floor(r() * NOISE.length)]; out.fg[y][x] = shade(out.fg[y][x], 0.6); out.bg[y][x] = null; }
    return out;
  } },
  burn: { kind: 'reveal', apply(frame, t, { intensity, seed }) {
    const p = progress(t, intensity), f = smooth(field(frame, seed)), out = reveal(frame, (x, y) => f[y][x] <= p);
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(frame, x, y) && f[y][x] > p && f[y][x] <= p + 0.12) { out.cells[y][x] = f[y][x] <= p + 0.06 ? '▓' : '▒'; out.fg[y][x] = brighten(frame.fg[y][x], f[y][x] <= p + 0.06 ? 0.6 : 0.2); }
    return out;
  } },
  // loops
  glitch: { kind: 'loop', apply(frame, t, { intensity, seed, index }) {
    const r = rng(seed * 101 + index), out = cloneFrame(frame), reach = Math.ceil(3 * intensity);
    for (let y = 0; y < out.height; y++) if (r() < 0.15 * intensity) shiftRow(out, frame, y, Math.round((r() * 2 - 1) * reach));
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y) && r() < 0.03 * intensity) out.cells[y][x] = NOISE[Math.floor(r() * NOISE.length)];
    return out;
  } },
  crt: { kind: 'loop', apply(frame, t, { intensity, params }) {
    const center = t * (frame.height + 4) - 2, trail = params.trail ?? 1.5;
    return eachColor(frame, (c, x, y) => { const d = center - y; if (d >= -1.5 && d < 0) return brighten(c, 0.7 * intensity); if (d >= 0 && d < trail + 1.5) return brighten(c, 0.7 * intensity * Math.max(0, 1 - d / (trail + 1.5))); return c; });
  } },
  phosphor: { kind: 'loop', apply(frame, t, ctx) { return EFFECTS.crt.apply(frame, t, { ...ctx, params: { trail: 2 + 8 * ctx.intensity } }); } },
  interlace: { kind: 'loop', apply(frame, t, { intensity, index }) { return eachColor(frame, (c, x, y) => ((y + index) % 2 ? shade(c, 1 - 0.35 * intensity) : c)); } },
  flicker: { kind: 'loop', apply(frame, t, { intensity, seed, index }) {
    const r = rng(seed * 37 + index), k = 1 - 0.4 * intensity * r(), out = eachColor(frame, (c) => shade(c, k));
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y) && r() < 0.01 * intensity) hide(out, x, y);
    return out;
  } },
  vhs: { kind: 'loop', apply(frame, t, { intensity, seed, index }) {
    const r = rng(seed * 53 + index), out = cloneFrame(frame), center = Math.floor(t * frame.height), reach = Math.round(4 * intensity);
    for (let y = Math.max(0, center - 1); y <= Math.min(frame.height - 1, center + 1); y++) {
      shiftRow(out, frame, y, Math.round((r() * 2 - 1) * reach));
      for (let x = 0; x < out.width; x++) if (lit(out, x, y) && r() < 0.05 * intensity) out.cells[y][x] = NOISE[Math.floor(r() * NOISE.length)];
    }
    return out;
  } },
  roll: { kind: 'loop', apply(frame, t, { intensity }) {
    const out = cloneFrame(frame), off = Math.floor(t * frame.height * intensity);
    for (let y = 0; y < out.height; y++) { const sy = (y + off) % out.height; out.cells[y] = [...frame.cells[sy]]; out.fg[y] = [...frame.fg[sy]]; out.bg[y] = [...frame.bg[sy]]; }
    return out;
  } },
  blink: { kind: 'loop', apply(frame, t, { intensity }) { return t >= 1 - 0.5 * intensity ? blankFrame(frame) : cloneFrame(frame); } },
  scroll: { kind: 'loop', apply(frame, t, { intensity, params }) {
    const d = params.direction ?? 'left', gap = params.gap ?? 4, out = cloneFrame(frame);
    if (d === 'left' || d === 'right') {
      const span = frame.width + gap, off = Math.floor(t * span * intensity);
      for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) { const sx = (((d === 'left' ? x + off : x - off) % span) + span) % span; const on = sx < frame.width; out.cells[y][x] = on ? frame.cells[y][sx] : ' '; out.fg[y][x] = on ? frame.fg[y][sx] : null; out.bg[y][x] = on ? frame.bg[y][sx] : null; }
    } else {
      const span = frame.height + gap, off = Math.floor(t * span * intensity);
      for (let y = 0; y < out.height; y++) { const sy = (((d === 'up' ? y + off : y - off) % span) + span) % span; const on = sy < frame.height; out.cells[y] = on ? [...frame.cells[sy]] : new Array(frame.width).fill(' '); out.fg[y] = on ? [...frame.fg[sy]] : new Array(frame.width).fill(null); out.bg[y] = on ? [...frame.bg[sy]] : new Array(frame.width).fill(null); }
    }
    return out;
  } },
  matrix: { kind: 'loop', apply(frame, t, { intensity, seed, index }) {
    const r = rng(seed * 71), out = cloneFrame(frame), span = frame.height + 8, glyphs = rng(seed * 73 + index);
    for (let x = 0; x < frame.width; x++) {
      const active = r() < 0.6 * intensity, phase = r(), length = 3 + Math.floor(r() * 6);
      if (!active) continue;
      const head = Math.floor(((t + phase) % 1) * span) - 8;
      for (let y = head - length; y <= head; y++) if (y >= 0 && y < frame.height && !lit(frame, x, y)) { out.cells[y][x] = RAIN[Math.floor(glyphs() * RAIN.length)]; out.fg[y][x] = y === head ? [180, 255, 180] : shade([0, 200, 70], 0.4 + (0.6 * (y - (head - length))) / length); }
    }
    return out;
  } },
  // color layer
  'hue-cycle': { kind: 'color', apply(frame, t, { intensity }) { return eachColor(frame, (c) => { const [h, s, l] = rgbToHsl(c); return hslToRgb([(h + t * intensity) % 1, s, l]); }); } },
  pulse: { kind: 'color', apply(frame, t, { intensity }) { const k = 1 + 0.35 * intensity * Math.sin(2 * Math.PI * t); return eachColor(frame, (c) => (k >= 1 ? brighten(c, k - 1) : shade(c, k))); } },
  'color-flicker': { kind: 'color', apply(frame, t, { intensity, seed, index }) { const k = 1 - 0.5 * intensity * rng(seed * 89 + index)(); return eachColor(frame, (c) => shade(c, k)); } },
  'gradient-scroll': { kind: 'color', apply(frame, t, { intensity, params }) {
    const out = cloneFrame(frame), vertical = (params.direction ?? 'vertical') === 'vertical';
    const n = vertical ? frame.height : frame.width, off = Math.floor(t * n * intensity);
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y)) { const sy = vertical ? (y + off) % n : y, sx = vertical ? x : (x + off) % n; out.fg[y][x] = frame.fg[sy][sx] ?? frame.fg[y][x]; }
    return out;
  } },
  'channel-offset': { kind: 'color', apply(frame, t, { intensity }) {
    const k = Math.ceil(3 * intensity), out = cloneFrame(frame), at = (x, y) => (x >= 0 && x < frame.width ? frame.fg[y][x] ?? (lit(frame, x, y) ? DEFAULT : null) : null);
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) if (lit(out, x, y)) { const c = at(x, y) ?? DEFAULT, l = at(x + k, y) ?? c, rr = at(x - k, y) ?? c; out.fg[y][x] = [l[0], c[1], rr[2]]; }
    return out;
  } },
  glow: { kind: 'color', apply(frame, t, { intensity }) {
    const out = cloneFrame(frame), k = (0.5 + 0.5 * Math.sin(2 * Math.PI * t)) * intensity;
    for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
      if (lit(frame, x, y)) continue;
      let near = null;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (frame.cells[y + dy]?.[x + dx] !== undefined && lit(frame, x + dx, y + dy)) { near = frame.fg[y + dy][x + dx] ?? DEFAULT; break; }
      if (near && k > 0.05) { out.cells[y][x] = '░'; out.fg[y][x] = shade(near, 0.15 + 0.45 * k); }
    }
    return out;
  } },
};
export const effectNames = (kind) => Object.keys(EFFECTS).filter((n) => !kind || EFFECTS[n].kind === kind);
