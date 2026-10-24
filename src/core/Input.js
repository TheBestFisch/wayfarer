const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
};

/**
 * Keyboard and pointer-lock mouse input.
 * Dispatches `lockchange` when pointer lock is gained or lost.
 */
export class Input extends EventTarget {
  #element;
  #pressed = new Set();
  #look = { x: 0, y: 0 };
  #jumpQueued = false;

  constructor(element) {
    super();
    this.#element = element;

    window.addEventListener('keydown', (event) => {
      this.#pressed.add(event.code);
      if (event.code === 'Space' && !event.repeat) this.#jumpQueued = true;
    });
    window.addEventListener('keyup', (event) => this.#pressed.delete(event.code));
    window.addEventListener('blur', () => this.#pressed.clear());

    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.#look.x += event.movementX;
      this.#look.y += event.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.#look.x = 0;
      this.#look.y = 0;
      this.dispatchEvent(new Event('lockchange'));
    });
  }

  get locked() {
    return document.pointerLockElement === this.#element;
  }

  requestLock() {
    if (this.locked) return;
    // Chrome rejects re-locking shortly after an unlock; the player can click to retry.
    Promise.resolve(this.#element.requestPointerLock()).catch(() => {});
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  isDown(action) {
    return KEYS[action].some((code) => this.#pressed.has(code));
  }

  /** Movement intent in camera space: x = strafe, z = forward. */
  moveAxis() {
    return {
      x: Number(this.isDown('right')) - Number(this.isDown('left')),
      z: Number(this.isDown('forward')) - Number(this.isDown('back')),
    };
  }

  consumeLook() {
    const delta = { ...this.#look };
    this.#look.x = 0;
    this.#look.y = 0;
    return delta;
  }

  consumeJump() {
    const queued = this.#jumpQueued;
    this.#jumpQueued = false;
    return queued;
  }
}
