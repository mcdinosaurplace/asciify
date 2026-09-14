// Colorways: named palettes with a fill gradient, a shadow slot, and an accent, fitted per theme so the contrast check passes.
import { parseColor, toHex, withLightness, rgbToHsl, fitContrast } from './color.js';

export const BACKGROUNDS = { dark: '#111111', light: '#ffffff' };

export const PRESETS = {
  matrix: { stops: ['#00ff41', '#008f11'], shadow: '#003b00', accent: '#9dffb0' },
  amber: { stops: ['#ffb000', '#ff7a00'], shadow: '#5a2d00', accent: '#ffe08a' },
  mono: { stops: ['#e6e6e6'], shadow: '#7a7a7a', accent: '#ffffff' },
  sunset: { stops: ['#ffd166', '#ef476f', '#7b2cbf'], shadow: '#2b1440', accent: '#ffe8a3' },
  synthwave: { stops: ['#ff9a00', '#ff2e97', '#00d4ff'], shadow: '#3a0a4d', accent: '#fff36b' },
  bladerunner: { stops: ['#5fe3c7', '#2e8db0', '#2b6c7a'], shadow: '#12303a', accent: '#f08ca8' },
  'rad-sorcerer': { stops: ['#c4f24a', '#6ee7d8', '#f566a9', '#9a6fdc'], shadow: '#101010', accent: '#f6e23c' },
};

/** A colorway from a brand's primary, secondary, and complementary colors. Missing slots derive from the primary. */
export function makeColorway({ name, primary, secondary, complementary }) {
  const p = parseColor(primary);
  const [, , l] = rgbToHsl(p);
  return {
    name,
    stops: [toHex(p), secondary ? toHex(parseColor(secondary)) : toHex(withLightness(p, Math.max(0.15, l * 0.6)))],
    shadow: toHex(withLightness(p, Math.max(0.06, l * 0.3))),
    accent: complementary ? toHex(parseColor(complementary)) : toHex(withLightness(p, Math.min(0.92, l + 0.3))),
  };
}

/** The colorway's colors adjusted for a theme: every slot reaches 4.5 to 1 against that theme's background. */
export function fitColorway(colorway, theme = 'dark') {
  const bg = colorway.backgrounds?.[theme] ?? BACKGROUNDS[theme];
  const fit = (hex) => fitContrast(parseColor(hex), bg);
  return {
    theme,
    background: bg,
    stops: colorway.stops.map(fit),
    shadow: fit(colorway.shadow ?? colorway.stops[0]),
    accent: fit(colorway.accent ?? colorway.stops[colorway.stops.length - 1]),
    direction: colorway.direction ?? 'vertical',
  };
}

export const colorwayNames = () => Object.keys(PRESETS);
export const preset = (name) => (PRESETS[name] ? { name, ...PRESETS[name] } : undefined);
