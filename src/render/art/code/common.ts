// Small helpers shared by the code-art modules: ordered dither and a deterministic hash.

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither test: draw this pixel when fading to a density of t (0..1). */
export function keep(x: number, y: number, t: number): boolean {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < t;
}

/** Deterministic hash of two ints and a seed -> 0..1 (stable art, no Math.random). */
export function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
