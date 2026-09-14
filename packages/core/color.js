// Colors as [r, g, b] triples: parsing, mixing, gradients, and fitting a color to a background for contrast.
import { contrast, luminance } from './contrast.js';

export function parseColor(s) {
  const str = String(s).trim();
  let m;
  if ((m = /^#?([0-9a-f]{3})$/i.exec(str))) return [...m[1]].map((c) => parseInt(c + c, 16));
  if ((m = /^#?([0-9a-f]{6})$/i.exec(str))) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(str))) return [m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Number(v))));
  throw new Error(`not a color: ${s}. Use #rrggbb, #rgb, or rgb(r, g, b).`);
}
export const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** The color at `t` from 0 to 1 along the stops. */
export function gradient(stops, t) {
  if (stops.length === 1) return stops[0];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x));
  return mix(stops[i], stops[i + 1], x - i);
}

export function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, s, l];
}
export function hslToRgb([h, s, l]) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export const withLightness = (rgb, l) => { const [h, s] = rgbToHsl(rgb); return hslToRgb([h, s, Math.max(0, Math.min(1, l))]); };

/** Move the color's lightness away from the background, one step at a time, until the contrast ratio is reached. */
export function fitContrast(rgb, bgHex, ratio = 4.5) {
  if (contrast(toHex(rgb), bgHex) >= ratio) return rgb;
  const darken = luminance(bgHex) > 0.5;
  const [h, s, l0] = rgbToHsl(rgb);
  for (let step = 1; step <= 100; step++) {
    const l = darken ? l0 - step / 100 : l0 + step / 100;
    if (l < 0 || l > 1) break;
    const c = hslToRgb([h, s, l]);
    if (contrast(toHex(c), bgHex) >= ratio) return c;
  }
  return darken ? [0, 0, 0] : [255, 255, 255];
}
