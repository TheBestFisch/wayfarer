import * as THREE from 'three';

const LOOK_SCALE = 0.0022;
const MIN_PITCH = 0.08;
const MAX_PITCH = 1.25;
const DISTANCE = 11;
const FOCUS_HEIGHT = 2.2;
const FOLLOW_RATE = 10;
const GROUND_CLEARANCE = 1.2;

/** Orbiting third-person camera that never dips below the terrain. */
export class CameraRig {
  #focus = new THREE.Vector3();
  #desired = new THREE.Vector3();

  constructor(camera, terrain) {
    this.camera = camera;
    this.terrain = terrain;
    this.yaw = 0.6;
    this.pitch = 0.42;
  }

  rotate(dx, dy, sensitivity, invertY) {
    this.yaw -= dx * LOOK_SCALE * sensitivity;
    this.pitch += dy * LOOK_SCALE * sensitivity * (invertY ? -1 : 1);
    this.pitch = THREE.MathUtils.clamp(this.pitch, MIN_PITCH, MAX_PITCH);
  }

  snap(target) {
    this.#focus.copy(target).setY(target.y + FOCUS_HEIGHT);
    this.#place();
  }

  follow(target, dt) {
    this.#desired.copy(target).setY(target.y + FOCUS_HEIGHT);
    this.#focus.lerp(this.#desired, 1 - Math.exp(-FOLLOW_RATE * dt));
    this.#place();
  }

  /** Signed angle (radians) of a world point relative to the view direction; positive is to the right. */
  bearingTo(from, to) {
    const forwardAngle = Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    const targetAngle = Math.atan2(to.x - from.x, to.z - from.z);
    return Math.atan2(Math.sin(forwardAngle - targetAngle), Math.cos(forwardAngle - targetAngle));
  }

  #place() {
    const horizontal = Math.cos(this.pitch) * DISTANCE;
    const position = this.camera.position.set(
      this.#focus.x + Math.sin(this.yaw) * horizontal,
      this.#focus.y + Math.sin(this.pitch) * DISTANCE,
      this.#focus.z + Math.cos(this.yaw) * horizontal,
    );
    const ground = this.terrain.heightAt(position.x, position.z) + GROUND_CLEARANCE;
    if (position.y < ground) position.y = ground;
    this.camera.lookAt(this.#focus);
  }
}
