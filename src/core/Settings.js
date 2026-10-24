import { readJson, writeJson } from './storage.js';
import { detectLocale } from '../i18n/i18n.js';

const STORAGE_KEY = 'wayfarer.settings';

const defaults = () => ({
  language: detectLocale(),
  sensitivity: 1,
  viewDistance: 4,
  invertY: false,
});

/** Persistent user settings. Dispatches `change` with `{ key, value }`. */
export class Settings extends EventTarget {
  #values;

  constructor() {
    super();
    this.#values = { ...defaults(), ...readJson(STORAGE_KEY, {}) };
  }

  get(key) {
    return this.#values[key];
  }

  set(key, value) {
    if (!(key in this.#values) || this.#values[key] === value) return;
    this.#values[key] = value;
    writeJson(STORAGE_KEY, this.#values);
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
  }
}
