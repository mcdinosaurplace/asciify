// A worked example: a closed grimoire seen from the front, a clasped spine on the left,
// a decorative frame on the cover, and a ring-and-star sigil with four corner marks
// cut from the cover as negative space. Designed on a 46 by 38 pixel grid.
// Render: node scripts/asciify.mjs scene references/examples/badge.mjs --scale 1.5
// The scene function receives the geometry library and returns layers, bottom first.
export const design = { width: 46, height: 38 };

export function scene({ rect, ellipse, star, union, subtract }, scale) {
  // masks: the spine on the left, the cover, and the clasp that clamps the right edge
  const spineMask = rect(4, 2, 8, 35);
  const coverMask = rect(9, 2, 40, 35);
  const claspMask = rect(38, 16, 42, 21);

  // spine: three raised bands cut across it
  const bands = union(rect(4, 7, 8, 8), rect(4, 17, 8, 18), rect(4, 27, 8, 28));
  const spine = subtract(spineMask, bands);

  // cover: a frame one pixel inside the edge, and the eldritch cutouts
  const frame = subtract(rect(10, 3, 39, 34), rect(11, 4, 38, 33));
  const CX = 24.5, CY = 18.5;
  const ring = subtract(ellipse(CX, CY, 7, 7), ellipse(CX, CY, 5, 5));
  const sigil = star(CX, CY, 3);
  const cross = (cx, cy) => union(rect(cx - 2, cy, cx + 2, cy + 1), rect(cx, cy - 2, cx + 1, cy + 2));
  const marks = union(cross(14, 8), cross(35, 8), cross(14, 28), cross(35, 28));
  const cover = subtract(coverMask, frame, ring, sigil, marks);

  return [
    { key: 'S', shape: spine },
    { key: 'B', shape: cover, gap: 1 },
    { key: 'C', shape: claspMask, gap: 1 },
  ];
}
