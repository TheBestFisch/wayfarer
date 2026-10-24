import * as THREE from 'three';
import { WATER_LEVEL } from '../world/Terrain.js';

const WALK_SPEED = 8;
const SPRINT_SPEED = 14;
const SWIM_FACTOR = 0.55;
const SWIM_DEPTH = 1.1;
const ACCELERATION = 10;
const TURN_RATE = 12;
const GRAVITY = 30;
const JUMP_SPEED = 11;
const GROUND_SNAP = 0.8;
const BODY_HEIGHT = 1.05;

function createModel() {
  const material = (color) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
  const model = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.9, 3, 8), material(0xe76f51));
  body.position.y = BODY_HEIGHT;

  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), material(0xf4d6b0));
  head.position.y = 1.15;

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.35), material(0x8d6e4c));
  pack.position.set(0, 0.15, -0.55);

  body.add(head, pack);
  model.add(body);
  return { model, body };
}

/** Third-person explorer: walks, sprints, swims and jumps on the terrain field. */
export class Player {
  #heading = 0;
  #stride = 0;

  constructor(terrain, spawn) {
    this.terrain = terrain;
    this.position = spawn.clone();
    this.velocity = new THREE.Vector3();
    this.grounded = true;

    const { model, body } = createModel();
    this.mesh = model;
    this.body = body;
    this.mesh.position.copy(this.position);
  }

  /** Advances the simulation and returns the horizontal distance covered. */
  update(dt, { axis, yaw, jump, sprinting }) {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    let dirX = -sin * axis.z + cos * axis.x;
    let dirZ = -cos * axis.z - sin * axis.x;
    const length = Math.hypot(dirX, dirZ);
    if (length > 0) {
      dirX /= length;
      dirZ /= length;
    }

    const swimming = this.terrain.heightAt(this.position.x, this.position.z) < WATER_LEVEL - SWIM_DEPTH;
    const speed = (sprinting ? SPRINT_SPEED : WALK_SPEED) * (swimming ? SWIM_FACTOR : 1);
    const blend = 1 - Math.exp(-ACCELERATION * dt);
    this.velocity.x += (dirX * speed - this.velocity.x) * blend;
    this.velocity.z += (dirZ * speed - this.velocity.z) * blend;

    const stepX = this.velocity.x * dt;
    const stepZ = this.velocity.z * dt;
    this.position.x += stepX;
    this.position.z += stepZ;

    this.#applyVertical(dt, jump && !swimming);
    this.#animate(dt, length > 0 ? Math.atan2(dirX, dirZ) : null, Math.hypot(stepX, stepZ));
    return Math.hypot(stepX, stepZ);
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.traverse((node) => {
      if (!node.isMesh) return;
      node.geometry.dispose();
      node.material.dispose();
    });
  }

  #applyVertical(dt, wantsJump) {
    const floor = Math.max(this.terrain.heightAt(this.position.x, this.position.z), WATER_LEVEL - SWIM_DEPTH);
    if (wantsJump && this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }

    this.velocity.y -= GRAVITY * dt;
    this.position.y += this.velocity.y * dt;

    const nearFloor = this.grounded && this.velocity.y <= 0 && this.position.y - floor < GROUND_SNAP;
    if (this.position.y <= floor || nearFloor) {
      this.position.y = floor;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
  }

  #animate(dt, targetHeading, stepLength) {
    if (targetHeading !== null) {
      const delta = Math.atan2(Math.sin(targetHeading - this.#heading), Math.cos(targetHeading - this.#heading));
      this.#heading += delta * (1 - Math.exp(-TURN_RATE * dt));
    }
    this.#stride += stepLength * 1.4;
    const bob = this.grounded && stepLength > 0 ? Math.abs(Math.sin(this.#stride)) * 0.15 : 0;

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.#heading;
    this.body.position.y = BODY_HEIGHT + bob;
  }
}
