import * as THREE from 'three';
import { Input } from './core/Input.js';
import { readJson, writeJson } from './core/storage.js';
import { i18n } from './i18n/i18n.js';
import { Terrain, WATER_LEVEL } from './world/Terrain.js';
import { ChunkManager } from './world/ChunkManager.js';
import { CHUNK_SIZE } from './world/Chunk.js';
import { createWorldResources } from './world/resources.js';
import { Player } from './entities/Player.js';
import { Beacon } from './entities/Beacon.js';
import { CameraRig } from './game/CameraRig.js';
import { Progression, MAX_ENERGY } from './game/Progression.js';

const SKY_COLOR = 0x9fd3f0;
const COLLECT_RADIUS = 2.4;
const BEACON_REACH = 6;
const BEACON_BASE_DISTANCE = 140;
const BEACON_DISTANCE_PER_LEVEL = 40;
const LOW_ENERGY_WARNING = 25;
const MENU_ORBIT_SPEED = 0.06;
const MAX_FRAME_TIME = 0.05;
const BEST_LEVEL_KEY = 'wayfarer.bestLevel';

const State = Object.freeze({
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  OVER: 'over',
});

const randomSeed = () => Math.floor(Math.random() * 1e9);

function findLand(terrain, origin, minDistance, rng = Math.random) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const angle = rng() * Math.PI * 2;
    const distance = minDistance + attempt * 8;
    const x = origin.x + Math.sin(angle) * distance;
    const z = origin.z + Math.cos(angle) * distance;
    const y = terrain.heightAt(x, z);
    if (y > WATER_LEVEL + 1.5) return new THREE.Vector3(x, y, z);
  }
  return new THREE.Vector3(origin.x, Math.max(WATER_LEVEL, terrain.heightAt(origin.x, origin.z)), origin.z);
}

export class Game {
  #state = State.MENU;
  #session = null;
  #clock = new THREE.Clock();

  constructor({ canvas, settings, ui }) {
    this.canvas = canvas;
    this.settings = settings;
    this.ui = ui;
    this.input = new Input(canvas);
    this.resources = createWorldResources();
    this.bestLevel = readJson(BEST_LEVEL_KEY, 0);

    this.#setupRenderer();
    this.#setupScene();
    this.#bindEvents();

    this.#session = this.#createSession(randomSeed());
    this.ui.setBest(this.bestLevel);
    this.ui.showScreen('main');
  }

  start() {
    this.renderer.setAnimationLoop(this.#tick);
  }

  newGame() {
    this.#replaceSession();
    this.#state = State.PLAYING;
    this.ui.showScreen(null);
    this.ui.showHud(true);
    this.input.requestLock();
  }

  pause() {
    if (this.#state !== State.PLAYING) return;
    this.#state = State.PAUSED;
    this.input.releaseLock();
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.#state !== State.PAUSED) return;
    this.#state = State.PLAYING;
    this.ui.showScreen(null);
    this.input.requestLock();
  }

  quitToMenu() {
    this.#replaceSession();
    this.#state = State.MENU;
    this.input.releaseLock();
    this.ui.showHud(false);
    this.ui.showScreen('main');
  }

  #setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
  }

  #setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, 50, 200);

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
    sun.position.set(0.6, 1, 0.35);
    this.scene.add(new THREE.HemisphereLight(0xd6ecff, 0x5b6b45, 1.1), sun);

    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3b8fd0, transparent: true, opacity: 0.8, roughness: 0.25 }),
    );
    this.water.position.y = WATER_LEVEL;
    this.scene.add(this.water);

    this.#applyViewDistance(this.settings.get('viewDistance'));
  }

  #bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    });

    this.input.addEventListener('lockchange', () => {
      if (!this.input.locked) this.pause();
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' || event.code === 'KeyP') this.pause();
    });
    this.canvas.addEventListener('click', () => {
      if (this.#state === State.PLAYING) this.input.requestLock();
    });

    this.settings.addEventListener('change', ({ detail }) => {
      if (detail.key === 'viewDistance') this.#applyViewDistance(detail.value);
    });
    i18n.addEventListener('change', () => {
      if (this.#state === State.PAUSED) this.#updateHud();
    });

    this.ui.on('play', () => this.newGame());
    this.ui.on('resume', () => this.resume());
    this.ui.on('quit', () => this.quitToMenu());
  }

  #applyViewDistance(radius) {
    const far = radius * CHUNK_SIZE * 0.95;
    this.scene.fog.near = far * 0.35;
    this.scene.fog.far = far;
    this.camera.far = far + CHUNK_SIZE;
    this.camera.updateProjectionMatrix();
    if (this.#session) this.#session.chunks.radius = radius;
  }

  #createSession(seed) {
    const terrain = new Terrain(seed);
    const chunks = new ChunkManager(this.scene, {
      terrain,
      resources: this.resources,
      seed,
      radius: this.settings.get('viewDistance'),
    });
    const player = new Player(terrain, findLand(terrain, new THREE.Vector3(), 0));
    const rig = new CameraRig(this.camera, terrain);

    this.scene.add(player.mesh);
    rig.snap(player.position);
    chunks.update(player.position, 0, Infinity);
    this.ui.setSeed(seed);

    return { seed, terrain, chunks, player, rig, progression: new Progression(), beacon: null, warned: false };
  }

  #replaceSession() {
    const { chunks, player, beacon } = this.#session;
    chunks.dispose();
    player.dispose();
    beacon?.dispose();
    this.#session = this.#createSession(randomSeed());
  }

  #tick = () => {
    const dt = Math.min(this.#clock.getDelta(), MAX_FRAME_TIME);
    const time = this.#clock.elapsedTime;
    const session = this.#session;

    if (this.#state === State.PLAYING) this.#updatePlaying(dt);
    else if (this.#state === State.MENU) session.rig.yaw += dt * MENU_ORBIT_SPEED;

    session.rig.follow(session.player.position, dt);
    session.chunks.update(session.player.position, time);
    session.beacon?.update(time);
    this.water.position.set(session.player.position.x, WATER_LEVEL, session.player.position.z);

    this.renderer.render(this.scene, this.camera);
  };

  #updatePlaying(dt) {
    const session = this.#session;
    const { player, rig, chunks, progression } = session;

    const look = this.input.consumeLook();
    rig.rotate(look.x, look.y, this.settings.get('sensitivity'), this.settings.get('invertY'));

    const axis = this.input.moveAxis();
    const moving = axis.x !== 0 || axis.z !== 0;
    const sprinting = moving && this.input.isDown('sprint');
    progression.distance += player.update(dt, {
      axis,
      yaw: rig.yaw,
      jump: this.input.consumeJump(),
      sprinting,
    });

    const collected = chunks.collectNear(player.position, COLLECT_RADIUS);
    for (let i = 0; i < collected; i++) this.#onShardCollected();

    if (session.beacon && this.#horizontalDistance(player.position, session.beacon.position) < BEACON_REACH) {
      this.#completeLevel();
    }

    progression.tick(dt, sprinting);
    this.#checkEnergyWarning();
    if (progression.depleted) {
      this.#endJourney();
      return;
    }

    this.#updateHud();
  }

  #onShardCollected() {
    const session = this.#session;
    session.progression.addShard();
    if (session.beacon || session.progression.remaining > 0) return;

    const distance = BEACON_BASE_DISTANCE + session.progression.level * BEACON_DISTANCE_PER_LEVEL;
    session.beacon = new Beacon(findLand(session.terrain, session.player.position, distance));
    this.scene.add(session.beacon.group);
    this.ui.toast(i18n.t('toast.beacon'));
  }

  #completeLevel() {
    const session = this.#session;
    session.beacon.dispose();
    session.beacon = null;
    session.progression.completeLevel();
    this.ui.toast(i18n.t('toast.levelUp', { level: session.progression.level }));
  }

  #checkEnergyWarning() {
    const session = this.#session;
    const { energy } = session.progression;
    if (!session.warned && energy < LOW_ENERGY_WARNING) {
      session.warned = true;
      this.ui.toast(i18n.t('toast.lowEnergy'));
    } else if (session.warned && energy > LOW_ENERGY_WARNING * 1.5) {
      session.warned = false;
    }
  }

  #endJourney() {
    const { level, totalShards, distance } = this.#session.progression;
    const newBest = level > this.bestLevel;
    if (newBest) {
      this.bestLevel = level;
      writeJson(BEST_LEVEL_KEY, level);
      this.ui.setBest(level);
    }

    this.#state = State.OVER;
    this.input.releaseLock();
    this.ui.showHud(false);
    this.ui.showGameOver({ level, shards: totalShards, distance, newBest });
  }

  #updateHud() {
    const { player, rig, chunks, progression, beacon } = this.#session;
    const target = beacon ? beacon.position : chunks.nearestShard(player.position);

    this.ui.updateHud({
      level: progression.level,
      shards: progression.shards,
      target: progression.target,
      energyRatio: progression.energy / MAX_ENERGY,
      objective: beacon
        ? i18n.t('objective.beacon')
        : i18n.t('objective.collect', { count: progression.remaining }),
      bearing: target ? rig.bearingTo(player.position, target) : null,
      distance: target ? this.#horizontalDistance(player.position, target) : 0,
      needsLock: !this.input.locked,
    });
  }

  #horizontalDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
}
