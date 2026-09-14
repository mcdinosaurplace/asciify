// Outline fonts through opentype.js: parse a TrueType or OpenType file, and fill text or single glyphs into a coverage grid.
import opentype from 'opentype.js';

export function parseFont(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return opentype.parse(buf);
}

// path commands to polygons of [x, y] points, curves flattened
function polygons(commands, ox = 0, oy = 0) {
  const polys = [];
  let cur = null, last = [0, 0];
  const push = (x, y) => { cur.push([x + ox, y + oy]); last = [x, y]; };
  for (const c of commands) {
    if (c.type === 'M') { cur = []; polys.push(cur); push(c.x, c.y); }
    else if (c.type === 'L') push(c.x, c.y);
    else if (c.type === 'Q') { const [x0, y0] = last; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; push(u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y); } }
    else if (c.type === 'C') { const [x0, y0] = last; for (let i = 1; i <= 12; i++) { const t = i / 12, u = 1 - t; push(u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x, u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y); } }
  }
  return polys.filter((p) => p.length > 2);
}

/** Add nonzero-winding coverage of the polygons into `data` (width by height), four samples per row, exact span ends. */
export function fillPolygons(polys, width, height, data = new Float32Array(width * height), samples = 4) {
  const edges = [];
  for (const poly of polys) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if (a[1] === b[1]) continue;
    edges.push(a[1] < b[1] ? { x0: a[0], y0: a[1], x1: b[0], y1: b[1], dir: 1 } : { x0: b[0], y0: b[1], x1: a[0], y1: a[1], dir: -1 });
  }
  const minY = Math.max(0, Math.floor(Math.min(...edges.map((e) => e.y0)))), maxY = Math.min(height, Math.ceil(Math.max(...edges.map((e) => e.y1))));
  const weight = 1 / samples;
  for (let py = minY; py < maxY; py++) for (let s = 0; s < samples; s++) {
    const y = py + (s + 0.5) / samples, xs = [];
    for (const e of edges) if (y >= e.y0 && y < e.y1) xs.push({ x: e.x0 + ((y - e.y0) * (e.x1 - e.x0)) / (e.y1 - e.y0), dir: e.dir });
    xs.sort((a, b) => a.x - b.x);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i].dir;
      if (wind === 0) continue;
      const xa = Math.max(0, xs[i].x), xb = Math.min(width, xs[i + 1].x);
      for (let x = Math.floor(xa); x < xb; x++) data[py * width + x] += (Math.min(x + 1, xb) - Math.max(x, xa)) * weight;
    }
  }
  return data;
}

/** Coverage of a line of text at `size` pixels, tightly boxed with `padding` pixels around it. */
export function rasterizeText(font, text, { size = 64, padding = 2, letterSpacing = 0 } = {}) {
  const path = font.getPath(text, 0, 0, size, { kerning: true, letterSpacing });
  const bb = path.getBoundingBox();
  const ox = padding - Math.floor(bb.x1), oy = padding - Math.floor(bb.y1);
  const width = Math.ceil(bb.x2 - bb.x1) + 2 * padding, height = Math.ceil(bb.y2 - bb.y1) + 2 * padding;
  const data = fillPolygons(polygons(path.commands, ox, oy), width, height);
  for (let i = 0; i < data.length; i++) if (data[i] > 1) data[i] = 1;
  return { width, height, data, baseline: oy };
}

/** Paint one glyph into an existing coverage grid with its baseline at (x, y). */
export function paintGlyph(font, ch, x, y, size, grid) {
  const path = font.getPath(ch, x, y, size, { kerning: false });
  const polys = polygons(path.commands);
  if (polys.length) fillPolygons(polys, grid.width, grid.height, grid.data);
}

/** The SVG path data of a glyph with its baseline at (x, y). */
export const glyphPathData = (font, ch, x, y, size) => font.getPath(ch, x, y, size, { kerning: false }).toPathData(2);

/** The pixel size at which the font's line height equals `cellH`, and the advance of a glyph at that size. */
export const cellMetrics = (font, cellH) => {
  const size = (cellH * font.unitsPerEm) / (font.ascender - font.descender);
  return { size, baseline: (font.ascender * size) / font.unitsPerEm, advance: (ch) => (font.charToGlyph(ch).advanceWidth * size) / font.unitsPerEm };
};
