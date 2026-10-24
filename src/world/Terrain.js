import * as THREE from 'three';
import { ValueNoise, hash2 } from './noise.js';

export const WATER_LEVEL = 0;

const PALETTE = {
  seabed: new THREE.Color(0xb39a68),
  sand: new THREE.Color(0xe2cf96),
  meadow: new THREE.Color(0x7dbb55),
  forest: new THREE.Color(0x4a8a3d),
  rock: new THREE.Color(0x8b857a),
  snow: new THREE.Color(0xf3f5f8),
};

export const TERRAIN_BANDS = { beach: 1.4, rock: 22, snow: 34 };

/** Pure height/colour field for a given seed. Chunks sample it to build meshes. */
export class Terrain {
  constructor(seed) {
    this.seed = seed;
    this.continents = new ValueNoise(seed);
    this.hills = new ValueNoise(seed ^ 0x5bd1e995);
    this.vegetation = new ValueNoise(seed ^ 0x27d4eb2f);
  }

  heightAt(x, z) {
    const continent = this.continents.fbm(x * 0.0028, z * 0.0028, 3);
    const hills = this.hills.fbm(x * 0.013, z * 0.013, 4);
    const mountains = Math.max(0, continent - 0.56) ** 2 * 420;
    return (continent - 0.44) * 52 + (hills - 0.5) * 14 + mountains;
  }

  /** Forest density in [0, 1). */
  vegetationAt(x, z) {
    return this.vegetation.fbm(x * 0.01, z * 0.01, 2);
  }

  colorAt(x, height, z, target) {
    if (height < WATER_LEVEL) {
      target.copy(PALETTE.seabed);
    } else if (height < TERRAIN_BANDS.beach) {
      target.copy(PALETTE.sand);
    } else if (height < TERRAIN_BANDS.rock) {
      const t = THREE.MathUtils.smoothstep(this.vegetationAt(x, z), 0.35, 0.65);
      target.lerpColors(PALETTE.meadow, PALETTE.forest, t);
    } else if (height < TERRAIN_BANDS.snow) {
      target.copy(PALETTE.rock);
    } else {
      target.copy(PALETTE.snow);
    }
    const jitter = (hash2(Math.round(x), Math.round(z), this.seed) - 0.5) * 0.05;
    return target.offsetHSL(0, 0, jitter);
  }
}
