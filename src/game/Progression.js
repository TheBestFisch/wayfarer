export const MAX_ENERGY = 100;

const SHARD_ENERGY = 18;
const LEVEL_ENERGY = 35;
const SPRINT_DRAIN_FACTOR = 2.2;

/** Level, score and energy rules. Each level asks for more shards and drains faster. */
export class Progression {
  level = 1;
  shards = 0;
  totalShards = 0;
  energy = MAX_ENERGY;
  distance = 0;

  get target() {
    return 3 + this.level * 2;
  }

  get remaining() {
    return Math.max(0, this.target - this.shards);
  }

  get drainPerSecond() {
    return 1 + this.level * 0.3;
  }

  get depleted() {
    return this.energy <= 0;
  }

  addShard() {
    this.shards++;
    this.totalShards++;
    this.#restore(SHARD_ENERGY);
  }

  completeLevel() {
    this.level++;
    this.shards = 0;
    this.#restore(LEVEL_ENERGY);
  }

  tick(dt, sprinting) {
    const drain = this.drainPerSecond * (sprinting ? SPRINT_DRAIN_FACTOR : 1);
    this.energy = Math.max(0, this.energy - drain * dt);
  }

  #restore(amount) {
    this.energy = Math.min(MAX_ENERGY, this.energy + amount);
  }
}
