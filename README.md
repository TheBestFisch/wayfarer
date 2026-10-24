# Wayfarer

An endless low-poly exploration game built with [Three.js](https://threejs.org/).
Wander a procedurally generated world, collect glowing shards to awaken a beacon,
and reach it before your energy runs out. Every level asks for more shards, puts
the beacon farther away and drains your energy faster.

## Features

- Infinite, seeded terrain streamed in chunks (beaches, meadows, forests, mountains, snow)
- Third-person movement with sprinting, jumping and swimming
- Level progression with an energy system and a compass to the next objective
- Main menu, pause menu, settings and a game-over screen with a saved best level
- Internationalization with English, German and Romanian built in
- No build step: plain ES modules, Three.js loaded from a CDN

## Getting started

The game uses ES modules, which browsers block on `file://` URLs, so serve the
folder over HTTP with any static server:

```bash
npm start                    # uses npx serve, then open http://localhost:5173
# or
python3 -m http.server 5173  # no Node.js required
```

Open `http://localhost:5173` in Chrome. An internet connection is needed the
first time to load Three.js and the font from their CDNs.

## Controls

| Input          | Action                     |
| -------------- | -------------------------- |
| `W A S D`      | Move                       |
| `Shift`        | Sprint (drains energy 2×)  |
| `Space`        | Jump                       |
| Mouse          | Look around (click to lock)|
| `Esc` / `P`    | Pause                      |

## Project structure

```
index.html              Markup for the canvas, HUD and menus; import map for Three.js
css/style.css           UI styling
src/
  main.js               Entry point: wires settings, i18n, UI and the game
  Game.js               Game states, main loop, session lifecycle and rules glue
  core/
    Input.js            Keyboard + pointer-lock mouse input
    Settings.js         Persistent, observable user settings
    storage.js          Safe localStorage helpers
  world/
    noise.js            Seeded hash, PRNG and value-noise fBm
    Terrain.js          Height and colour field
    Chunk.js            One terrain tile with trees, rocks and shards
    ChunkManager.js     Streams chunks around the player
    resources.js        Shared geometries and materials
  entities/
    Player.js           Player model and movement physics
    Beacon.js           Level goal
  game/
    CameraRig.js        Third-person orbit camera
    Progression.js      Levels, shards and energy rules
  ui/
    UI.js               Screens, HUD, toasts and settings form
  i18n/
    i18n.js             Translation service
    locales/            en.js, de.js, ro.js
```

## Adding a language

1. Copy `src/i18n/locales/en.js` to e.g. `fr.js` and translate the strings
   (keep the keys and `{placeholders}` unchanged; set `meta.name`).
2. Import it in `src/i18n/i18n.js` and add it to `LOCALES`.

The language appears in Settings automatically. Missing keys fall back to English.

## Tuning

Gameplay numbers live as named constants at the top of each module:
energy and level rules in `Progression.js`, movement in `Player.js`, shard and
prop density in `Chunk.js`, terrain shape in `Terrain.js`.

## License

MIT
