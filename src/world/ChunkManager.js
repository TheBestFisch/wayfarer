import { Chunk, CHUNK_SIZE } from './Chunk.js';

const BUILDS_PER_FRAME = 2;

/** Streams chunks in and out around a focus point to create an endless world. */
export class ChunkManager {
  #chunks = new Map();
  #collected = new Set();

  constructor(scene, { terrain, resources, seed, radius }) {
    this.scene = scene;
    this.context = { terrain, resources, seed, collected: this.#collected };
    this.radius = radius;
  }

  update(focus, time, budget = BUILDS_PER_FRAME) {
    const centerX = Math.floor(focus.x / CHUNK_SIZE);
    const centerZ = Math.floor(focus.z / CHUNK_SIZE);
    const keepRadius = this.radius + 1;

    for (const [key, chunk] of this.#chunks) {
      if (Math.max(Math.abs(chunk.cx - centerX), Math.abs(chunk.cz - centerZ)) > keepRadius) {
        chunk.dispose();
        this.#chunks.delete(key);
      }
    }

    const missing = [];
    const reach = (this.radius + 0.5) ** 2;
    for (let dx = -this.radius; dx <= this.radius; dx++) {
      for (let dz = -this.radius; dz <= this.radius; dz++) {
        const distance = dx * dx + dz * dz;
        if (distance > reach || this.#chunks.has(Chunk.key(centerX + dx, centerZ + dz))) continue;
        missing.push({ cx: centerX + dx, cz: centerZ + dz, distance });
      }
    }
    missing
      .sort((a, b) => a.distance - b.distance)
      .slice(0, budget)
      .forEach(({ cx, cz }) => this.#build(cx, cz));

    for (const chunk of this.#chunks.values()) chunk.animate(time);
  }

  collectNear(position, radius) {
    let total = 0;
    for (const chunk of this.#chunks.values()) {
      total += chunk.collectNear(position, radius, this.#collected);
    }
    return total;
  }

  /** Position of the closest shard among loaded chunks, or null. */
  nearestShard(position) {
    let nearest = null;
    let best = Infinity;
    for (const chunk of this.#chunks.values()) {
      for (const { mesh } of chunk.shards) {
        const distance = mesh.position.distanceToSquared(position);
        if (distance < best) {
          best = distance;
          nearest = mesh.position;
        }
      }
    }
    return nearest;
  }

  dispose() {
    for (const chunk of this.#chunks.values()) chunk.dispose();
    this.#chunks.clear();
  }

  #build(cx, cz) {
    const chunk = new Chunk(cx, cz, this.context);
    this.#chunks.set(chunk.key, chunk);
    this.scene.add(chunk.group);
  }
}
