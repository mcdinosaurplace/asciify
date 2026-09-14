// An animated GIF encoder with no dependencies: one global palette from the frames' colors, LZW-compressed frames, a loop.

// LZW as GIF wants it: variable code width, a clear code, an end code, sub-blocks of up to 255 bytes
function lzw(indices, minCodeSize) {
  const out = [];
  let bitBuf = 0, bitLen = 0, block = [];
  const emitByte = (b) => { block.push(b); if (block.length === 255) { out.push(255, ...block); block = []; } };
  const emit = (code, width) => { bitBuf |= code << bitLen; bitLen += width; while (bitLen >= 8) { emitByte(bitBuf & 255); bitBuf >>>= 8; bitLen -= 8; } };
  const clear = 1 << minCodeSize, eoi = clear + 1;
  let width = minCodeSize + 1, next = eoi + 1, dict = new Map();
  emit(clear, width);
  let prefix = -1;
  for (const k of indices) {
    const key = prefix * 4096 + k;
    if (prefix >= 0 && dict.has(key)) { prefix = dict.get(key); continue; }
    if (prefix >= 0) {
      emit(prefix, width);
      if (next < 4096) { dict.set(key, next++); if (next - 1 === 1 << width && width < 12) width++; }
      else { emit(clear, width); dict = new Map(); next = eoi + 1; width = minCodeSize + 1; }
    }
    prefix = k;
  }
  if (prefix >= 0) emit(prefix, width);
  emit(eoi, width);
  if (bitLen > 0) emitByte(bitBuf & 255);
  if (block.length) out.push(block.length, ...block);
  out.push(0);
  return out;
}

const key = (r, g, b) => (r << 16) | (g << 8) | b;
/** The palette: every distinct opaque color when there are 255 or fewer, else the colors rounded to 5 bits per channel. */
function palette(frames) {
  let colors = new Map();
  const collect = (round) => { colors = new Map(); for (const f of frames) for (let i = 0; i < f.width * f.height; i++) { if (f.data[i * 4 + 3] < 128) continue; let r = f.data[i * 4], g = f.data[i * 4 + 1], b = f.data[i * 4 + 2]; if (round) { r &= 0xf8; g &= 0xf8; b &= 0xf8; } const k = key(r, g, b); if (!colors.has(k)) colors.set(k, [r, g, b]); if (colors.size > 255) return false; } return true; };
  if (!collect(false)) collect(true);
  const entries = [...colors.values()].slice(0, 255);
  const index = new Map(entries.map((c, i) => [key(...c), i]));
  const nearest = (r, g, b) => { let best = 0, bd = Infinity; entries.forEach((c, i) => { const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  return { entries, lookup: (r, g, b) => index.get(key(r, g, b)) ?? index.get(key(r & 0xf8, g & 0xf8, b & 0xf8)) ?? nearest(r, g, b) };
}

/**
 * @param {{width, height, data}[]} frames RGBA images of one size; alpha under 128 is transparent
 * @param {{fps?: number, loop?: boolean}} options loop repeats forever
 * @returns {Uint8Array}
 */
export function encodeGIF(frames, { fps = 12, loop = true } = {}) {
  const { width, height } = frames[0];
  const pal = palette(frames);
  const transparent = 255;                             // the last slot is reserved for transparency
  const size = 256, bits = 8, delay = Math.max(2, Math.round(100 / fps));
  const out = [];
  const u16 = (v) => out.push(v & 255, (v >> 8) & 255);
  out.push(...[...'GIF89a'].map((c) => c.charCodeAt(0)));
  u16(width); u16(height); out.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);
  for (let i = 0; i < size; i++) { const c = pal.entries[i] ?? [0, 0, 0]; out.push(c[0], c[1], c[2]); }
  if (loop) out.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  for (const f of frames) {
    if (f.width !== width || f.height !== height) throw new Error('every frame must have the same size');
    out.push(0x21, 0xf9, 4, 0x09, delay & 255, (delay >> 8) & 255, transparent, 0);   // dispose to background, transparency on
    out.push(0x2c); u16(0); u16(0); u16(width); u16(height); out.push(0);
    const indices = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) indices[i] = f.data[i * 4 + 3] < 128 ? transparent : pal.lookup(f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2]);
    out.push(bits, ...lzw(indices, bits));
  }
  out.push(0x3b);
  return Uint8Array.from(out);
}

/** The parts of a GIF worth checking: size, frame count, and whether it loops. */
export function inspectGIF(bytes) {
  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  const width = bytes[6] | (bytes[7] << 8), height = bytes[8] | (bytes[9] << 8);
  let frames = 0, loops = false, i = 13 + 3 * (1 << ((bytes[10] & 7) + 1));
  const skipBlocks = () => { while (bytes[i] !== 0) i += bytes[i] + 1; i++; };
  while (i < bytes.length && bytes[i] !== 0x3b) {
    if (bytes[i] === 0x21) { if (bytes[i + 1] === 0xff) loops = true; i += 2; skipBlocks(); }
    else if (bytes[i] === 0x2c) { frames++; i += 10; if (bytes[i - 1] & 0x80) i += 3 * (1 << ((bytes[i - 1] & 7) + 1)); i++; skipBlocks(); }
    else break;
  }
  return { signature: sig, width, height, frames, loops, trailer: bytes[bytes.length - 1] === 0x3b };
}
