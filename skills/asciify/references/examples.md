# Worked examples

Two ways to design imagery: a hand-typed bitmap for most icons, and a scene module when curves or several scales are needed.

## A hand-typed bitmap: the heart

`references/examples/heart.txt` is 28 pixels wide and 18 rows tall, an even number of rows because every cell holds two pixels. Rows of `.` are off, `#` on. The lobes are two circles that meet at the top; the point is a single pair of pixels at the bottom, which is the smallest feature that still reads.

```
......####........####......
....########....########....
...##########..##########...
..########################..
..########################..
..########################..
...######################...
....####################....
.....##################.....
......################......
.......##############.......
........############........
.........##########.........
..........########..........
...........######...........
............####............
.............##.............
............................```

Rendered with `node scripts/asciify.mjs bitmap references/examples/heart.txt`, 28 columns by 9 rows:

```
    ▄▄████▄▄    ▄▄████▄▄
  ▄██████████▄▄██████████▄
  ████████████████████████
   ▀████████████████████▀
     ▀████████████████▀
       ▀████████████▀
         ▀████████▀
           ▀████▀
             ▀▀
```

The notes that came with it: `# 28 x 18 pixels, 26 x 9 cells `. The map, `--map`, prints the pixels with rulers so a count can be checked before judging the art; its first rows:

```
    0         1         2
    0123456789012345678901234567
  0 ......####........####......
    ....########....########....
    ...##########..##########...
    ..########################..
```

Scaling by a whole number keeps every edge crisp. `--scale 2` gives 56 columns by 18 rows:

```
            ████████                ████████
        ████████████████        ████████████████
      ████████████████████    ████████████████████
    ████████████████████████████████████████████████
    ████████████████████████████████████████████████
    ████████████████████████████████████████████████
      ████████████████████████████████████████████
        ████████████████████████████████████████
          ████████████████████████████████████
            ████████████████████████████████
              ████████████████████████████
                ████████████████████████
                  ████████████████████
                    ████████████████
                      ████████████
                        ████████
                          ████
```

Regions: replace `#` with letters to name parts of the image, and each letter gets its own color slot when the art is colored; two regions in one cell render exactly.

## A scene module: the badge

`references/examples/badge.mjs` draws a wizard's hat standing on a lined page with a folded corner. It exports a `design` size in pixels and a `scene(geometry, scale)` that returns layers, bottom first. The page is a function in pixel coordinates so its border stays one whole pixel wide at any scale; the hat is a union of an ellipse and a crown function with a band and three stars subtracted; the hat layer carries `gap: 1`, which clears one pixel of the page around it. Render it with `node scripts/asciify.mjs scene references/examples/badge.mjs --scale 1.5 --rows 40`; add `--map` to see the two regions, `P` and `H`, and `--color rad-sorcerer` to color them by area, or `--region H=#f566a9` to pin the hat.

## The rules these follow

- A four-point star reads at a radius of 2.5 pixels or more; a band needs two pixels; a buckle two or three. Below that, drop the feature.
- Leave a one-pixel gap wherever one shape crosses another; in a scene that is the layer's `gap`.
- No marks outside the shapes: no scattered texture, no offset copies as shadows.
- Design at the smallest band the image must survive, then scale by whole numbers. A different aspect is a redesign.
- Check the map before judging the render, and read the notes: a speck, a notch, or a thin bridge is reported by pixel position.
