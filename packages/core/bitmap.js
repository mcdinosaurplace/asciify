// Bitmaps: `cells[y][x]` is null for an off pixel or a character naming the pixel's region. Height is always even.

/** Parse rows of text: `.` and space are off; any other character is on and names its region. Short rows pad with off pixels. */
export function parseBitmap(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const rows = lines.map((l) => [...l.replace(/\s+$/, '')]);
  const width = rows.reduce((w, r) => (r.length > w ? r.length : w), 0);
  const cells = rows.map((r) => Array.from({ length: width }, (_, x) => (r[x] === undefined || r[x] === '.' || r[x] === ' ' ? null : r[x])));
  if (cells.length % 2) cells.push(new Array(width).fill(null));
  return { width, height: cells.length, cells };
}

/** The boolean grid the checks use. */
export const toGrid = (bitmap) => ({ width: bitmap.width, height: bitmap.height, rows: bitmap.cells.map((row) => row.map((c) => c !== null)) });

/** Half-block text: ▀ top pixel, ▄ bottom pixel, █ both, space neither. Trailing spaces trimmed, a final newline. `trim` crops blank rows at both ends. */
export function renderHalfblocks(bitmap, { trim = false } = {}) {
  const lines = [];
  for (let y = 0; y < bitmap.height; y += 2) {
    let line = '';
    for (let x = 0; x < bitmap.width; x++) {
      const t = bitmap.cells[y][x] !== null, b = bitmap.cells[y + 1]?.[x] !== null && bitmap.cells[y + 1]?.[x] !== undefined;
      line += t && b ? '█' : t ? '▀' : b ? '▄' : ' ';
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  if (trim) {
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    while (lines.length && lines[0] === '') lines.shift();
  }
  return lines.join('\n') + '\n';
}

/** Nearest-neighbor scaling by a whole number. */
export function scaleBitmap(bitmap, n) {
  if (!Number.isInteger(n) || n < 1) throw new Error(`scale must be a whole number of 1 or more, not ${n}`);
  const cells = [];
  for (const row of bitmap.cells) {
    const wide = row.flatMap((c) => new Array(n).fill(c));
    for (let k = 0; k < n; k++) cells.push([...wide]);
  }
  return { width: bitmap.width * n, height: bitmap.height * n, cells };
}

/** The region map with rulers: a tens row and a units row across the top, a row number every ten rows down the side. */
export function bitmapMap(bitmap) {
  const gutter = 4;
  const tens = Array.from({ length: bitmap.width }, (_, x) => (x % 10 === 0 ? String(Math.floor(x / 10) % 10) : ' ')).join('').replace(/\s+$/, '');
  const units = Array.from({ length: bitmap.width }, (_, x) => String(x % 10)).join('');
  const out = [' '.repeat(gutter) + tens, ' '.repeat(gutter) + units];
  bitmap.cells.forEach((row, y) => {
    const label = y % 10 === 0 ? String(y).padStart(gutter - 1) + ' ' : ' '.repeat(gutter);
    out.push(label + row.map((c) => c ?? '.').join(''));
  });
  return out.join('\n') + '\n';
}
