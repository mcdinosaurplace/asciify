// A worked example: a wizard's hat standing on a lined page with a folded corner. Designed on a 46 by 38 pixel grid.
// Render: node scripts/asciify.mjs scene references/examples/badge.mjs --scale 1.5
// The scene function receives the geometry library and returns layers, bottom first. Shapes get design coordinates (X, Y)
// and pixel coordinates (x, y); the page works in pixels so its border stays one whole pixel wide at any scale.
export const design = { width: 46, height: 38 };

export function scene({ ellipse, star, subtract, union }, scale) {
  const px = (v) => Math.round(v * scale);
  const b = Math.max(1, Math.round(scale));                       // border thickness in pixels
  const PX0 = px(8), PY0 = px(12), PX1 = px(45), PY1 = px(37), EAR = px(7);

  // the page: a border, a folded corner, and three ruled lines
  const page = (X, Y, x, y) => {
    if (x < PX0 || x > PX1 || y < PY0 || y > PY1) return false;
    const fold = x - (PX1 - EAR) - (y - PY0);                     // above the fold diagonal is cut away
    if (fold > 0) return false;
    if (x < PX0 + b || x > PX1 - b || y < PY0 + b || y > PY1 - b) return true;
    if (x >= PX1 - EAR && y <= PY0 + EAR) return fold > -b || x < PX1 - EAR + b || y > PY0 + EAR - b;
    const thickness = scale >= 2 ? 2 : 1;
    for (let k = 0; k < 3; k++) {
      let ly = px(24 + 4 * k);
      if (thickness === 2 && ly % 2) ly++;
      if (y >= ly && y < ly + thickness && x >= px(12) && x <= (k === 2 ? px(30) : px(41))) return true;
    }
    return false;
  };

  // the hat: a brim, a crown whose tip curls right, a band with a buckle, and three stars cut out
  const CX = 23, TOP = 3;
  const crownCx = (Y) => CX + (Y < 7 ? ((7 - Y) / 6) ** 2 * 3 : 0);
  const crown = (X, Y0) => { const Y = Y0 - TOP; return Y >= 1 && Y <= 16 && Math.abs(X - crownCx(Y)) <= (10 * (Y - 1)) / 15 + 0.3; };
  const silhouette = union(ellipse(CX, 17 + TOP, 12, 2.2), crown);
  const band = (X, Y0) => { const Y = Y0 - TOP; return Y >= 13 && Y < 15 && Math.abs(X - crownCx(Y)) > 1.2; };
  const hat = subtract(silhouette, band, star(23, 9.5 + TOP, 2.6), star(19, 12 + TOP, 1.3), star(25.5, 6.5 + TOP, 1.1));

  return [
    { key: 'P', shape: page },
    { key: 'H', shape: hat, mask: silhouette, gap: 1 },
  ];
}
