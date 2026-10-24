import * as THREE from 'three';
import { createRng, hash2 } from './noise.js';
import { WATER_LEVEL, TERRAIN_BANDS } from './Terrain.js';

export const CHUNK_SIZE = 64;

const SEGMENTS = 20;
const TREE_ATTEMPTS = 28;
const ROCK_ATTEMPTS = 6;
const SHARD_SLOTS = 2;
const SHARD_CHANCE = 0.6;
const SHARD_HOVER = 1.4;

const matrix = new THREE.Matrix4();
const rotation = new THREE.Quaternion();
const scale = new THREE.Vector3();
const offset = new THREE.Vector3();
const color = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** A square tile of terrain with deterministic props and collectible shards. */
export class Chunk {
  static key(cx, cz) {
    return `${cx},${cz}`;
  }

  constructor(cx, cz, { terrain, resources, seed, collected }) {
    this.cx = cx;
    this.cz = cz;
    this.key = Chunk.key(cx, cz);
    this.originX = cx * CHUNK_SIZE;
    this.originZ = cz * CHUNK_SIZE;
    this.group = new THREE.Group();
    this.shards = [];
    this.instanced = [];

    const rng = createRng(hash2(cx, cz, seed) * 4294967296);
    this.#buildGround(terrain, resources);
    this.#buildTrees(terrain, resources, rng);
    this.#buildRocks(terrain, resources, rng);
    this.#buildShards(terrain, resources, rng, collected);
  }

  animate(time) {
    for (const shard of this.shards) {
      shard.mesh.rotation.y = time * 1.6 + shard.phase;
      shard.mesh.position.y = shard.baseY + Math.sin(time * 2 + shard.phase) * 0.3;
    }
  }

  /** Removes shards within `radius` of `position`, records them, returns the count. */
  collectNear(position, radius, collected) {
    const radiusSq = radius * radius;
    let count = 0;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i];
      if (shard.mesh.position.distanceToSquared(position) > radiusSq) continue;
      this.group.remove(shard.mesh);
      collected.add(shard.id);
      this.shards.splice(i, 1);
      count++;
    }
    return count;
  }

  dispose() {
    this.group.removeFromParent();
    this.ground.geometry.dispose();
    for (const mesh of this.instanced) mesh.dispose();
  }

  #randomPoint(rng) {
    return { x: this.originX + rng() * CHUNK_SIZE, z: this.originZ + rng() * CHUNK_SIZE };
  }

  #buildGround(terrain, resources) {
    const geometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, SEGMENTS, SEGMENTS)
      .rotateX(-Math.PI / 2)
      .translate(this.originX + CHUNK_SIZE / 2, 0, this.originZ + CHUNK_SIZE / 2);

    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const height = terrain.heightAt(x, z);
      positions.setY(i, height);
      terrain.colorAt(x, height, z, color).toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    this.ground = new THREE.Mesh(geometry, resources.terrainMaterial);
    this.group.add(this.ground);
  }

  #buildTrees(terrain, resources, rng) {
    const trees = [];
    for (let i = 0; i < TREE_ATTEMPTS; i++) {
      const { x, z } = this.#randomPoint(rng);
      const size = 0.7 + rng() * 0.8;
      const yaw = rng() * Math.PI * 2;
      const shade = rng();
      const y = terrain.heightAt(x, z);
      const density = terrain.vegetationAt(x, z);
      if (y < WATER_LEVEL + TERRAIN_BANDS.beach || y > TERRAIN_BANDS.rock) continue;
      if (rng() > density * 1.4 - 0.2) continue;
      trees.push({ x, y: y - 0.2, z, size, yaw, shade });
    }
    if (trees.length === 0) return;

    this.#addInstances(resources.trunkGeometry, resources.trunkMaterial, trees);
    this.#addInstances(resources.crownGeometry, resources.crownMaterial, trees, (tree) =>
      color.setHSL(0.27 + tree.shade * 0.08, 0.5, 0.3 + tree.shade * 0.1),
    );
  }

  #buildRocks(terrain, resources, rng) {
    const rocks = [];
    for (let i = 0; i < ROCK_ATTEMPTS; i++) {
      const { x, z } = this.#randomPoint(rng);
      const size = 0.4 + rng() * 1.4;
      const yaw = rng() * Math.PI * 2;
      const shade = rng();
      const y = terrain.heightAt(x, z);
      if (y < WATER_LEVEL - 1 || y > TERRAIN_BANDS.snow) continue;
      rocks.push({ x, y: y + size * 0.2, z, size, yaw, shade });
    }
    if (rocks.length === 0) return;

    this.#addInstances(resources.rockGeometry, resources.rockMaterial, rocks, (rock) =>
      color.setHSL(0.08, 0.06, 0.42 + rock.shade * 0.15),
    );
  }

  #buildShards(terrain, resources, rng, collected) {
    for (let slot = 0; slot < SHARD_SLOTS; slot++) {
      const roll = rng();
      const { x, z } = this.#randomPoint(rng);
      const id = `${this.key}:${slot}`;
      const y = terrain.heightAt(x, z);
      if (roll > SHARD_CHANCE || collected.has(id) || y < WATER_LEVEL + 0.5) continue;

      const mesh = new THREE.Mesh(resources.shardGeometry, resources.shardMaterial);
      mesh.position.set(x, y + SHARD_HOVER, z);
      this.group.add(mesh);
      this.shards.push({ id, mesh, baseY: y + SHARD_HOVER, phase: roll * 10 });
    }
  }

  #addInstances(geometry, material, items, tint) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((item, index) => {
      rotation.setFromAxisAngle(UP, item.yaw);
      scale.setScalar(item.size);
      offset.set(item.x, item.y, item.z);
      mesh.setMatrixAt(index, matrix.compose(offset, rotation, scale));
      if (tint) mesh.setColorAt(index, tint(item));
    });
    mesh.computeBoundingSphere();
    this.instanced.push(mesh);
    this.group.add(mesh);
  }
}
