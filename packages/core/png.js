// PNG: a pure decoder and encoder. Compression is injected: `inflate` and `deflate` take bytes and return bytes or a promise of them.
// The decoder reads bit depths 1 to 16 and every color type, non-interlaced; the encoder writes 8-bit RGBA with no filtering.

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CRC_TABLE = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (bytes) => { let c = -1; for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b, i, n) => String.fromCharCode(...b.subarray(i, i + n));
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

/** @returns {Promise<{width: number, height: number, data: Uint8ClampedArray}>} RGBA, 8 bits per channel */
export async function decodePNG(bytes, inflate) {
  if (!SIGNATURE.every((v, i) => bytes[i] === v)) throw new Error('not a PNG file');
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  for (let i = 8; i < bytes.length;) {
    const len = u32(bytes, i), name = ascii(bytes, i + 4, 4), body = bytes.subarray(i + 8, i + 8 + len);
    if (name === 'IHDR') { width = u32(body, 0); height = u32(body, 4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') trns = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
    i += 12 + len;
  }
  if (interlace) throw new Error('interlaced PNGs are not supported; re-save without interlacing (on a Mac, any format through sips works)');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!channels) throw new Error(`unknown PNG color type ${type}`);
  const joined = new Uint8Array(idat.reduce((n, c) => n + c.length, 0));
  idat.reduce((off, c) => (joined.set(c, off), off + c.length), 0);
  const raw = new Uint8Array(await inflate(joined));
  const bpp = Math.max(1, (channels * depth) >> 3), stride = Math.ceil((width * channels * depth) / 8);
  const rows = new Uint8Array(height * stride);
  for (let y = 0, p = 0; y < height; y++) {
    const filter = raw[p++], row = rows.subarray(y * stride, (y + 1) * stride), prev = y ? rows.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const v = raw[p++], a = x >= bpp ? row[x - bpp] : 0, b = prev ? prev[x] : 0, c = prev && x >= bpp ? prev[x - bpp] : 0;
      row[x] = filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b : filter === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c);
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  const max = (1 << depth) - 1;
  const sample = (row, i) => {   // the i-th sample of a row, scaled to 0..255
    if (depth === 8) return row[i];
    if (depth === 16) return row[i * 2];
    const bit = i * depth, byte = row[bit >> 3], shift = 8 - depth - (bit & 7);
    const v = (byte >> shift) & max;
    return type === 3 ? v : Math.round((v * 255) / max);
  };
  for (let y = 0; y < height; y++) {
    const row = rows.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, s = x * channels;
      if (type === 0) { const g = sample(row, s); data[o] = data[o + 1] = data[o + 2] = g; data[o + 3] = trns && g === sample(trns, 0) ? 0 : 255; }
      else if (type === 2) { data[o] = sample(row, s); data[o + 1] = sample(row, s + 1); data[o + 2] = sample(row, s + 2); data[o + 3] = 255; }
      else if (type === 3) { const i = sample(row, s); data[o] = palette[i * 3]; data[o + 1] = palette[i * 3 + 1]; data[o + 2] = palette[i * 3 + 2]; data[o + 3] = trns && i < trns.length ? trns[i] : 255; }
      else if (type === 4) { const g = sample(row, s); data[o] = data[o + 1] = data[o + 2] = g; data[o + 3] = sample(row, s + 1); }
      else { data[o] = sample(row, s); data[o + 1] = sample(row, s + 1); data[o + 2] = sample(row, s + 2); data[o + 3] = sample(row, s + 3); }
    }
  }
  return { width, height, data };
}

const chunk = (name, body) => {
  const out = new Uint8Array(12 + body.length);
  const len = body.length;
  out.set([len >>> 24, (len >>> 16) & 255, (len >>> 8) & 255, len & 255], 0);
  out.set([...name].map((c) => c.charCodeAt(0)), 4);
  out.set(body, 8);
  const crc = crc32(out.subarray(4, 8 + len));
  out.set([crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255], 8 + len);
  return out;
};

/** @param {{width: number, height: number, data: Uint8ClampedArray|Uint8Array}} image RGBA */
export async function encodePNG(image, deflate) {
  const { width, height, data } = image;
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y++) { raw[y * (1 + width * 4)] = 0; raw.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1); }
  const ihdr = new Uint8Array(13);
  ihdr.set([width >>> 24, (width >>> 16) & 255, (width >>> 8) & 255, width & 255, height >>> 24, (height >>> 16) & 255, (height >>> 8) & 255, height & 255, 8, 6, 0, 0, 0]);
  const parts = [new Uint8Array(SIGNATURE), chunk('IHDR', ihdr), chunk('IDAT', new Uint8Array(await deflate(raw))), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((off, p) => (out.set(p, off), off + p.length), 0);
  return out;
}
