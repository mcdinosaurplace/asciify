// Geometry: shapes are predicates on design coordinates (X, Y), which also receive the pixel coordinates (x, y).
// Layers stack in order. A layer with a gap clears that many design units around its mask in the layers below it.

export const rect = (x0, y0, x1, y1) => (X, Y) => X >= x0 && X <= x1 && Y >= y0 && Y <= y1;
export const ellipse = (cx, cy, rx, ry) => (X, Y) => ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1;
/** A four-point star as an astroid: |dx/r|^p + |dy/r|^p <= 1. At p = 0.75 it reads as the ✨ glyph. */
export const star = (cx, cy, r, p = 0.75) => (X, Y) => (Math.abs(X - cx) / r) ** p + (Math.abs(Y - cy) / r) ** p <= 1;
/** A line segment of a given thickness. */
export const line = (x0, y0, x1, y1, thickness = 1) => (X, Y) => {
  const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((X - x0) * dx + (Y - y0) * dy) / len2));
  const px = x0 + t * dx, py = y0 + t * dy;
  return Math.hypot(X - px, Y - py) <= thickness / 2;
};
/** A polygon from [x, y] points, by even-odd ray casting. */
export const polygon = (points) => (X, Y) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i], [xj, yj] = points[j];
    if (yi > Y !== yj > Y && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
export const union = (...shapes) => (X, Y, x, y) => shapes.some((s) => s(X, Y, x, y));
export const intersect = (...shapes) => (X, Y, x, y) => shapes.every((s) => s(X, Y, x, y));
export const subtract = (shape, ...holes) => (X, Y, x, y) => shape(X, Y, x, y) && !holes.some((h) => h(X, Y, x, y));
/** The border of a shape: on where the shape is on and a neighbor at distance t is off. */
export const outline = (shape, t = 1) => (X, Y, x, y) => shape(X, Y, x, y) && !(shape(X - t, Y, x, y) && shape(X + t, Y, x, y) && shape(X, Y - t, x, y) && shape(X, Y + t, x, y));

/**
 * @param {{key: string, shape: Function, mask?: Function, gap?: number}[]} layers bottom first. `mask` is what occludes lower
 *   layers (default: the shape itself); `gap` is the clear margin around the mask, in design units, at least one pixel.
 * @param {{width: number, height: number, scale?: number}} canvas in pixels; pixel (x, y) samples the shapes at (x / scale, y / scale)
 * @returns a bitmap whose cells hold the layer keys
 */
export function renderScene(layers, { width, height, scale = 1 }) {
  const masks = layers.map((l) => {
    const mask = l.mask ?? l.shape;
    return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => !!mask(x / scale, y / scale, x, y)));
  });
  const gaps = layers.map((l) => (l.gap ? Math.max(1, Math.round(l.gap * scale)) : 0));
  const near = (m, x, y, g) => {
    for (let dy = -g; dy <= g; dy++) for (let dx = -g; dx <= g; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && m[ny][nx]) return true;
    }
    return false;
  };
  const cells = Array.from({ length: height }, () => new Array(width).fill(null));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    for (let i = layers.length - 1; i >= 0; i--) {
      if (masks[i][y][x]) { cells[y][x] = layers[i].shape(x / scale, y / scale, x, y) ? layers[i].key : null; break; }
      if (gaps[i] && near(masks[i], x, y, gaps[i])) break;
    }
  }
  return { width, height, cells };
}
