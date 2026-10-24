import { Settings } from './core/Settings.js';
import { i18n } from './i18n/i18n.js';
import { UI } from './ui/UI.js';
import { Game } from './Game.js';

const settings = new Settings();
i18n.setLocale(settings.get('language'));
settings.addEventListener('change', ({ detail }) => {
  if (detail.key === 'language') i18n.setLocale(detail.value);
});

const ui = new UI(settings);
const game = new Game({ canvas: document.getElementById('scene'), settings, ui });
game.start();
