// A pixel bitmap of a wizard's hat standing on a lined document, rendered with half-block characters:
// each character cell is two pixels tall (top ▀, bottom ▄, both █). Pixels are square on screen.
// Usage: node pixel.mjs [scale]   scale 1 = 44x36 px (44 cols x 18 rows), 2 = 88x72 px
const S = +(process.argv[2] ?? 1);
const SHADOW = process.argv.includes("--shadow");
const W = Math.round(46 * S), H = Math.round(38 * S) + (Math.round(38 * S) % 2);
const px = (v) => Math.round(v * S);

// the page
const PX0 = px(8), PY0 = px(12), PX1 = px(45), PY1 = px(37), EAR = px(7);
function page(x, y) {
  if (x < PX0 || x > PX1 || y < PY0 || y > PY1) return false;
  const fold = (x - (PX1 - EAR)) - (y - PY0);            // > 0 above the fold diagonal: cut away
  if (fold > 0) return false;
  const b = Math.max(1, Math.round(S));                  // border thickness
  if (x < PX0 + b || x > PX1 - b + 0 || y < PY0 + b || y > PY1 - b + 0) return true;
  if (x >= PX1 - EAR && y <= PY0 + EAR) {                // the folded corner: its diagonal and inner edges
    if (fold > -b) return true;
    if (x < PX1 - EAR + b || y > PY0 + EAR - b) return true;
    return false;
  }
  const lt = S >= 2 ? 2 : 1;                              // ruled lines: one pixel thin below scale 2, a full cell row above
  for (let k = 0; k < 3; k++) {
    let ly = px(24 + 4 * k); if (lt === 2 && ly % 2) ly++;
    const x1 = k === 2 ? px(30) : px(41);
    if (y >= ly && y < ly + lt && x >= px(12) && x <= x1) return true;
  }
  return false;
}

// the hat, upright, standing on the page
const CX = 23, HAT_DY = 3, BRIM_Y = 17 + HAT_DY;                             // the hat stands a few pixels inside the page
const crownCx = (y) => CX + (y < 7 ? Math.pow((7 - y) / 6, 2) * 3 : 0);   // the tip curls right
function hatSilhouette(x, y) {
  const X = x / S, Y = y / S - HAT_DY;
  if (Math.pow((X - CX) / 12, 2) + Math.pow((Y - (BRIM_Y - HAT_DY)) / 2.2, 2) <= 1) return true;   // brim
  if (Y >= 1 && Y <= 16) { const w = 10 * (Y - 1) / 15; if (Math.abs(X - crownCx(Y)) <= w + 0.3) return true; }
  return false;
}
function hatHole(x, y) {
  const X = x / S, Y = y / S - HAT_DY;
  if (Y >= 13 && Y < 15 && Math.abs(X - crownCx(Y)) > 1.2) return true;                    // the band, with a buckle left in
  const star = (cx, cy, r) => { const dx = Math.abs(X - cx), dy = Math.abs(Y - cy); return Math.pow(dx / r, 0.75) + Math.pow(dy / r, 0.75) <= 1; };
  return star(23, 9.5, 2.6) || star(19, 12, 1.3) || star(25.5, 6.5, 1.1);               // the sparkle
}
function on(x, y) {
  if (hatSilhouette(x, y)) return !hatHole(x, y);
  const g = Math.max(1, Math.round(S));
  for (let dx = -g; dx <= g; dx++) for (let dy = -g; dy <= g; dy++) if (hatSilhouette(x + dx, y + dy)) return false;   // a one-pixel gap around the hat
  return page(x, y);
}

const rows = [];
for (let r = 0; r < H / 2; r++) {
  let line = "";
  for (let c = 0; c < W; c++) {
    const t = on(c, 2 * r), b = on(c, 2 * r + 1);
    let ch = t && b ? "█" : t ? "▀" : b ? "▄" : " ";
    if (SHADOW && ch === " " && c > 0 && r > 0 && (on(c - 1, 2 * r - 2) || on(c - 1, 2 * r - 1))) ch = "░";   // a drop shadow one cell right and down
    line += ch;
  }
  rows.push(line.replace(/\s+$/, ""));
}
console.log(rows.join("\n"));
