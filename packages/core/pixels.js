// Pixel grids: `rows` is an array of boolean arrays, height by width.
// Half-block text decodes to two pixel rows per text row: ▀ top, ▄ bottom, █ both, space neither.

export function halfblocksToPixels(text) {
  const lines = text.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  const cells = lines.map((line) => [...line]);
  const width = cells.reduce((w, line) => (line.length > w ? line.length : w), 0);
  const rows = [];
  for (const line of cells) {
    const top = new Array(width).fill(false);
    const bottom = new Array(width).fill(false);
    line.forEach((ch, x) => {
      if (ch === '█' || ch === '▀') top[x] = true;
      if (ch === '█' || ch === '▄') bottom[x] = true;
    });
    rows.push(top, bottom);
  }
  return { width, height: rows.length, rows };
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Connected components of pixels equal to `value`. Each has `pixels` as [x, y] pairs and `touchesBorder`. */
export function components(grid, { value = true, connectivity = 8 } = {}) {
  const { width, height, rows } = grid;
  const seen = rows.map((row) => row.map(() => false));
  const steps = connectivity === 4 ? N4 : N8;
  const out = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (seen[y][x] || rows[y][x] !== value) continue;
      const pixels = [];
      let touchesBorder = false;
      const stack = [[x, y]];
      seen[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        pixels.push([cx, cy]);
        if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) touchesBorder = true;
        for (const [dx, dy] of steps) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (seen[ny][nx] || rows[ny][nx] !== value) continue;
          seen[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      out.push({ pixels, size: pixels.length, touchesBorder });
    }
  }
  return out;
}

/** Erode by one pixel: a pixel stays on only if it and its four neighbors are on. The border counts as off. */
export function erode(grid) {
  const { width, height, rows } = grid;
  const on = (x, y) => x >= 0 && y >= 0 && x < width && y < height && rows[y][x];
  const eroded = rows.map((row, y) => row.map((v, x) => v && N4.every(([dx, dy]) => on(x + dx, y + dy))));
  return { width, height, rows: eroded };
}
