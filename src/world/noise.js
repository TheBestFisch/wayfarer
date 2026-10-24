/** Deterministic hash of an integer lattice point, in [0, 1). */
export function hash2(x, z, seed) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Mulberry32 PRNG: fast, seedable, good enough for procedural content. */
export function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/** Smoothly interpolated 2D value noise with fractal Brownian motion. */
export class ValueNoise {
  constructor(seed) {
    this.seed = seed | 0;
  }

  sample(x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const tx = smooth(x - x0);
    const tz = smooth(z - z0);
    const top = lerp(hash2(x0, z0, this.seed), hash2(x0 + 1, z0, this.seed), tx);
    const bottom = lerp(hash2(x0, z0 + 1, this.seed), hash2(x0 + 1, z0 + 1, this.seed), tx);
    return lerp(top, bottom, tz);
  }

  /** Normalized fBm in [0, 1). */
  fbm(x, z, octaves = 4) {
    let amplitude = 1;
    let frequency = 1;
    let total = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.sample(x * frequency, z * frequency) * amplitude;
      norm += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total / norm;
  }
}
