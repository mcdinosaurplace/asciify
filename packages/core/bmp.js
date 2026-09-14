// BMP: a pure decoder for the uncompressed 24 and 32 bit files that macOS sips writes, top-down or bottom-up.
const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const i32 = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24);
const u16 = (b, i) => b[i] | (b[i + 1] << 8);

/** @returns {{width: number, height: number, data: Uint8ClampedArray}} RGBA */
export function decodeBMP(bytes) {
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) throw new Error('not a BMP file');
  const offset = u32(bytes, 10), width = i32(bytes, 18), rawHeight = i32(bytes, 22), bpp = u16(bytes, 28), compression = u32(bytes, 30);
  if (bpp !== 24 && bpp !== 32) throw new Error(`BMP with ${bpp} bits per pixel is not supported`);
  if (compression !== 0 && compression !== 3) throw new Error(`compressed BMP (type ${compression}) is not supported`);
  const height = Math.abs(rawHeight), topDown = rawHeight < 0, stride = Math.floor((bpp * width + 31) / 32) * 4, step = bpp / 8;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const src = offset + (topDown ? y : height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const i = src + x * step, o = (y * width + x) * 4;
      data[o] = bytes[i + 2]; data[o + 1] = bytes[i + 1]; data[o + 2] = bytes[i]; data[o + 3] = step === 4 ? bytes[i + 3] : 255;
    }
  }
  return { width, height, data };
}
