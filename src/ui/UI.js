import { i18n, SUPPORTED_LOCALES } from '../i18n/i18n.js';

const TOAST_DURATION_MS = 2600;
const LOW_ENERGY_RATIO = 0.25;

const SETTING_FIELDS = {
  language: { parse: String },
  sensitivity: { parse: Number, format: (value) => `${value.toFixed(1)}×` },
  viewDistance: { parse: Number, format: String },
  invertY: { checkbox: true },
};

/** DOM layer: screens, HUD, toasts and the settings form. Holds no game rules. */
export class UI {
  #screens;
  #hud;
  #actions = new Map();
  #current = null;
  #settingsReturn = 'main';
  #textCache = new Map();
  #bestLevel = 0;

  constructor(settings) {
    this.settings = settings;
    this.#screens = new Map([...document.querySelectorAll('[data-screen]')].map((el) => [el.dataset.screen, el]));
    this.#hud = Object.fromEntries([...document.querySelectorAll('[data-hud]')].map((el) => [el.dataset.hud, el]));
    this.hudRoot = document.getElementById('hud');

    document.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-action]');
      if (trigger) this.#actions.get(trigger.dataset.action)?.();
    });

    this.on('settings', () => {
      this.#settingsReturn = this.#current;
      this.showScreen('settings');
    });
    this.on('back', () => this.showScreen(this.#settingsReturn));

    this.#bindSettings();
    i18n.addEventListener('change', () => {
      this.#textCache.clear();
      this.#renderBest();
      this.#renderLanguageOptions();
    });
  }

  get currentScreen() {
    return this.#current;
  }

  on(action, handler) {
    this.#actions.set(action, handler);
  }

  showScreen(name) {
    this.#current = name;
    for (const [key, element] of this.#screens) element.hidden = key !== name;
    if (name === null) document.activeElement?.blur();
  }

  showHud(visible) {
    this.hudRoot.hidden = !visible;
  }

  setSeed(seed) {
    this.#hud.seed.textContent = seed;
  }

  setBest(level) {
    this.#bestLevel = level;
    this.#renderBest();
  }

  updateHud({ level, shards, target, energyRatio, objective, bearing, distance, needsLock }) {
    this.#setText('level', level);
    this.#setText('shards', `${shards}/${target}`);
    this.#setText('objective', objective);

    this.#hud.energy.style.transform = `scaleX(${energyRatio})`;
    this.#hud.energy.classList.toggle('low', energyRatio < LOW_ENERGY_RATIO);

    this.#hud.compass.hidden = bearing === null;
    if (bearing !== null) {
      this.#hud.arrow.style.rotate = `${bearing}rad`;
      this.#setText('distance', `${Math.round(distance)} m`);
    }
    this.#hud.hint.hidden = !needsLock;
  }

  toast(message) {
    const element = document.createElement('div');
    element.className = 'toast';
    element.textContent = message;
    this.#hud.toasts.append(element);
    setTimeout(() => element.remove(), TOAST_DURATION_MS);
  }

  showGameOver({ level, shards, distance, newBest }) {
    const fields = Object.fromEntries([...document.querySelectorAll('[data-over]')].map((el) => [el.dataset.over, el]));
    fields.level.textContent = level;
    fields.shards.textContent = shards;
    fields.distance.textContent = `${Math.round(distance)} m`;
    fields.newBest.hidden = !newBest;
    this.showScreen('over');
  }

  #setText(key, value) {
    const text = String(value);
    if (this.#textCache.get(key) === text) return;
    this.#textCache.set(key, text);
    this.#hud[key].textContent = text;
  }

  #renderBest() {
    const element = document.querySelector('[data-best]');
    element.hidden = this.#bestLevel < 2;
    element.textContent = i18n.t('menu.best', { level: this.#bestLevel });
  }

  #renderLanguageOptions() {
    const select = document.querySelector('[data-settings] [name="language"]');
    select.replaceChildren(
      ...SUPPORTED_LOCALES.map((code) => new Option(i18n.languageName(code), code, false, code === i18n.locale)),
    );
  }

  #bindSettings() {
    const form = document.querySelector('[data-settings]');
    this.#renderLanguageOptions();

    for (const [name, field] of Object.entries(SETTING_FIELDS)) {
      const input = form.elements[name];
      const output = form.querySelector(`[data-output="${name}"]`);
      const value = this.settings.get(name);

      if (field.checkbox) input.checked = value;
      else input.value = value;
      if (output) output.textContent = field.format(value);

      input.addEventListener(field.checkbox ? 'change' : 'input', () => {
        const next = field.checkbox ? input.checked : field.parse(input.value);
        if (output) output.textContent = field.format(next);
        this.settings.set(name, next);
      });
    }
  }
}
