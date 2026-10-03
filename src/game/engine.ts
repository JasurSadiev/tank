// ---------------------------------------------------------------------------
// IRON VANGUARD — game simulation
// ---------------------------------------------------------------------------
import {
  WORLD, ENEMY_PROFILES, PLAYER_TANK_MAP, UPGRADE_MAP, upgradeCost,
  clamp, lerp, rand, angleDiff,
} from './types';
import type {
  BaseData, Bullet, EnemyKind, HudState, Obstacle, Particle, PlayerTankId, Tank, UpgradeId,
} from './types';
import { audio } from './audio';
import { drawWorld } from './draw';

export type GameEvent =
  | 'sectorClear' | 'gameOver' | 'playerDeath' | 'respawn' | 'start';

export interface Hooks {
  onHud: (h: HudState) => void;
  onEvent: (e: GameEvent, payload?: number) => void;
  onPauseRequest: () => void;
  onDepotRequest: () => void;
}

export interface PlayerStats {
  dmg: number;
  rate: number;
  speed: number;
  maxHp: number;
  resist: number;
  shots: number;
  pierce: number;
  regen: number;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hooks: Hooks;
  dpr = 1;
  cw = 800;
  ch = 600;

  raf = 0;
  lastT = 0;
  acc = 0;
  running = false;
  destroyed = false;
  phase: 'idle' | 'play' | 'depot' | 'over' | 'paused' = 'idle';

  // ---- world state ----
  tanks: Tank[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  obstacles: Obstacle[] = [];
  playerBase!: BaseData;
  enemyBase!: BaseData;
  player!: Tank;
  nextId = 1;
  selectedTank: PlayerTankId = 'ranger';

  sector = 1;
  score = 0;
  salvage = 0;
  kills = 0;
  combo = 0;
  comboTimer = 0;
  playTime = 0;
  levelTime = 0;
  respawn = 0;
  spawnTimer = 2;
  ending = 0;
  endKind: 'sector' | 'over' | null = null;

  levels: Record<UpgradeId, number> = {
    cannon: 0, loader: 0, multishot: 0, armor: 0,
    turbine: 0, pierce: 0, bulwark: 0, sentry: 0, drones: 0,
  };

  boostCd = 0;
  autoFire = true;
  shakeOn = true;

  // ---- input ----
  keys = new Set<string>();
  moveStick = { x: 0, y: 0 };
  aimStick = { x: 0, y: 0 };
  aimScreen = { x: 0, y: 0 };
  mouseActive = false;
  firingMouse = false;
  firingStick = false;

  // ---- camera / fx ----
  cam = {
    x: 0, y: 0, scale: 1, tx: 0, ty: 0,
    trauma: 0, kick: 0, shakeX: 0, shakeY: 0, rot: 0,
  };
  timeScale = 1;
  targetScale = 1;
  hitStop = 0;
  vignette = 0;
  flash = 0;
  flashColor = '255,80,60';
  hudTimer = 0;
  decalFade = 0;

  announceText = '';
  announceColor = '#fff';
  announceTimer = 0;

  terrain!: HTMLCanvasElement;
  decal!: HTMLCanvasElement;
  decalCtx!: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement, hooks: Hooks) {
    this.canvas = canvas;
    this.hooks = hooks;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.buildTerrain();
    this.bindEvents();
    this.resize();
    this.reset();
    this.aimScreen = { x: this.cw * 0.75, y: this.ch * 0.5 };
    this.cam.x = WORLD.w / 2;
    this.cam.y = WORLD.h / 2;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // =========================================================================
  // setup
  // =========================================================================
  private buildTerrain() {
    const s = 0.5;
    const c = document.createElement('canvas');
    c.width = Math.floor(WORLD.w * s);
    c.height = Math.floor(WORLD.h * s);
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, '#1b2434');
    grad.addColorStop(0.5, '#1f2b3c');
    grad.addColorStop(1, '#182130');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);

    for (let i = 0; i < 130; i++) {
      const x = Math.random() * c.width, y = Math.random() * c.height;
      const r = rand(28, 120) * s;
      g.fillStyle = Math.random() > 0.55
        ? `rgba(120,150,110,${rand(0.03, 0.07)})`
        : `rgba(190,170,120,${rand(0.03, 0.07)})`;
      g.beginPath();
      g.ellipse(x, y, r, r * rand(0.5, 1), Math.random() * 6.28, 0, 6.28);
      g.fill();
    }
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * c.width, y = Math.random() * c.height;
      g.fillStyle = Math.random() > 0.5
        ? 'rgba(255,255,255,0.028)' : 'rgba(0,0,0,0.06)';
      g.fillRect(x, y, rand(1, 3), rand(1, 3));
    }
    g.strokeStyle = 'rgba(120,190,220,0.05)';
    g.lineWidth = 1;
    const grid = 130 * s;
    for (let x = 0; x < c.width; x += grid) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke();
    }
    for (let y = 0; y < c.height; y += grid) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke();
    }
    g.strokeStyle = 'rgba(255,180,90,0.06)';
    g.lineWidth = 90 * s;
    g.beginPath();
    g.moveTo(0, c.height / 2);
    g.lineTo(c.width, c.height / 2);
    g.stroke();
    for (let i = 0; i < 26; i++) {
      const x = rand(200, WORLD.w - 200) * s, y = rand(150, WORLD.h - 150) * s;
      const r = rand(20, 60) * s;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(0,0,0,0.30)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill();
    }
    g.strokeStyle = 'rgba(140,200,230,0.12)';
    g.lineWidth = 6 * s;
    g.strokeRect(3 * s, 3 * s, c.width - 6 * s, c.height - 6 * s);
    this.terrain = c;

    const d = document.createElement('canvas');
    d.width = c.width;
    d.height = c.height;
    this.decal = d;
    this.decalCtx = d.getContext('2d')!;
  }

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.style.touchAction = 'none';
  }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    audio.stopMusic();
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width || window.innerWidth);
    const h = Math.max(240, rect.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = w;
    this.ch = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.keys.add(code);
    if (code === 'Escape' || code === 'KeyP') this.hooks.onPauseRequest();
    if (code === 'Tab' || code === 'KeyU') this.hooks.onDepotRequest();
    if (code === 'ShiftLeft' || code === 'ShiftRight') this.tryBoost();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private onBlur = () => { this.keys.clear(); this.firingMouse = false; };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    audio.resume();
    const r = this.canvas.getBoundingClientRect();
    this.aimScreen = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.mouseActive = true;
    if (e.button === 0) this.firingMouse = true;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const r = this.canvas.getBoundingClientRect();
    this.aimScreen = { x: e.clientX - r.left, y: e.clientY - r.top };
    this.mouseActive = true;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') this.firingMouse = false;
  };

  // ---- external control API ----------------------------------------------
  setMoveStick(x: number, y: number) { this.moveStick.x = x; this.moveStick.y = y; }
  setAimStick(x: number, y: number, fire: boolean) {
    this.aimStick.x = x; this.aimStick.y = y; this.firingStick = fire;
  }
  triggerBoost() { this.tryBoost(); }
  setPrefs(p: { autoFire: boolean; shake: boolean }) {
    this.autoFire = p.autoFire;
    this.shakeOn = p.shake;
  }

  setSelectedTank(id: PlayerTankId) {
    this.selectedTank = id;
  }

  // =========================================================================
  // (re)start
  // =========================================================================
  reset() {
    this.tanks.length = 0;
    for (const b of this.bullets) b.active = false;
    for (const p of this.particles) p.active = false;
    this.obstacles = [];
    this.buildObstacles();
    this.levels = {
      cannon: 0, loader: 0, multishot: 0, armor: 0,
      turbine: 0, pierce: 0, bulwark: 0, sentry: 0, drones: 0,
    };
    this.sector = 1;
    this.score = 0;
    this.salvage = 90;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.playTime = 0;
    this.respawn = 0;
    this.spawnTimer = 1.6;
    this.ending = 0;
    this.endKind = null;
    this.boostCd = 0;
    this.timeScale = 1;
    this.targetScale = 1;
    this.cam.trauma = 0.4;
    this.vignette = 0;
    this.flash = 0;
    this.announceTimer = 0;
    this.decalCtx.clearRect(0, 0, this.decal.width, this.decal.height);

    const cy = WORLD.h / 2;
    this.playerBase = {
      x: 175, y: cy, w: 195, h: 205, hp: 1250, maxHp: 1250, cd: 0,
      turret: 0, hitFlash: 0, alive: true, owner: 'p', alarm: 0,
    };
    this.enemyBase = this.makeEnemyBase(1);
    this.player = this.makePlayer();
    this.tanks.push(this.player);
    this.cam.x = this.player.x + 180;
    this.cam.y = this.player.y;
    this.publishHud(true);
  }

  private makeEnemyBase(sector: number): BaseData {
    const hp = sector === 1 ? 240 : 500 + 410 * (sector - 1);
    return {
      x: WORLD.w - 175, y: WORLD.h / 2, w: 195, h: 205, hp, maxHp: hp,
      cd: 0, turret: Math.PI, hitFlash: 0, alive: true, owner: 'e', alarm: 0,
    };
  }

  private makePlayer(): Tank {
    const cy = WORLD.h / 2;
    const chassis = PLAYER_TANK_MAP[this.selectedTank];
    return {
      id: this.nextId++, x: 400, y: cy, vx: 0, vy: 0,
      angle: 0, turret: 0, hp: chassis.hp, maxHp: chassis.hp, r: chassis.radius,
      player: true, kind: 'player',
      dmg: chassis.damage, rate: chassis.rate, bulletSpeed: 660, range: 720,
      speed: chassis.speed,
      cd: 0, hitFlash: 0, dead: false, aiTimer: 0, strafe: 1, goal: { x: 0, y: 0 },
      losOk: false, losTimer: 0, turretTurn: 5.5, trackDist: 0, recoil: 0,
      spawnPop: 0.4, elite: false, tier: 0,
      twin: (chassis.bonusShots ?? 0) > 0,
      salvageValue: 0, scoreValue: 0,
    };
  }

  private buildObstacles() {
    const layout: [number, number, number, number, Obstacle['kind'], number][] = [
      [640, 650 - 250, 60, 150, 'block', 0],
      [640, 650 + 250, 60, 150, 'block', 0],
      [WORLD.w - 640, 650 - 250, 60, 150, 'block', 0],
      [WORLD.w - 640, 650 + 250, 60, 150, 'block', 0],
      [900, 650, 140, 62, 'rock', 0],
      [WORLD.w - 900, 650, 140, 62, 'rock', 0],
      [1070, 650 - 330, 92, 92, 'rock', 0],
      [1070, 650 + 330, 92, 92, 'rock', 0],
      [WORLD.w - 1070, 650 - 330, 92, 92, 'rock', 0],
      [WORLD.w - 1070, 650 + 330, 92, 92, 'rock', 0],
      [WORLD.w / 2, 650 - 155, 72, 72, 'crate', 70],
      [WORLD.w / 2, 650 + 155, 72, 72, 'crate', 70],
      [WORLD.w / 2 - 115, 650, 72, 72, 'crate', 70],
      [WORLD.w / 2 + 115, 650, 72, 72, 'crate', 70],
      [770, 650 - 465, 150, 52, 'block', 0],
      [WORLD.w - 770, 650 - 465, 150, 52, 'block', 0],
      [770, 650 + 465, 150, 52, 'block', 0],
      [WORLD.w - 770, 650 + 465, 150, 52, 'block', 0],
      [1350, 650 - 475, 92, 92, 'crate', 70],
      [WORLD.w - 1350, 650 - 475, 92, 92, 'crate', 70],
      [1350, 650 + 475, 92, 92, 'crate', 70],
      [WORLD.w - 1350, 650 + 475, 92, 92, 'crate', 70],
      [500, 650 - 70, 62, 62, 'crate', 55],
      [WORLD.w - 500, 650 + 70, 62, 62, 'crate', 55],
    ];
    for (const [x, y, w, h, k, hp] of layout) {
      this.obstacles.push({
        x: x - w / 2, y: y - h / 2, w, h, hp, maxHp: hp, kind: k,
        seed: Math.random() * 1000,
      });
    }
  }

  start() {
    this.reset();
    this.phase = 'play';
    this.running = true;
    this.lastT = performance.now();
    this.acc = 0;
    audio.resume();
    audio.setIntensity(0.25);
    audio.startMusic();
    this.hooks.onEvent('start');
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
    this.announce('LEVEL 1 — TRAINING RAID', '#ffd166');
    this.bossAlive = false;
    this.bossSpawned = false;
    this.levelTime = 0;
    // opening vanguard drops straight into mid-field so the fight starts fast
    this.spawnEnemy(true);
    this.spawnTimer = 4.2;
  }

  setPaused(p: boolean) {
    if (this.phase === 'over' || this.phase === 'idle') return;
    this.running = !p;
    if (!p) this.lastT = performance.now();
  }

  nextSector() {
    this.sector += 1;
    this.enemyBase = this.makeEnemyBase(this.sector);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.5);
    this.player.dead = false;
    this.player.x = 400;
    this.player.y = WORLD.h / 2;
    this.player.vx = 0;
    this.player.vy = 0;
    this.respawn = 0;
    this.spawnTimer = 1.8;
    this.ending = 0;
    this.endKind = null;
    this.timeScale = 1;
    this.targetScale = 1;
    this.phase = 'play';
    this.running = true;
    this.lastT = performance.now();
    this.bossAlive = false;
    this.bossSpawned = false;
    this.levelTime = 0;
    audio.setIntensity(clamp(0.2 + this.sector * 0.1, 0, 1));
    this.announce(
      this.isBossLevel ? `LEVEL ${this.sector} — BOSS LEVEL!` : `LEVEL ${this.sector} — PUSH!`,
      this.isBossLevel ? '#ff7a1a' : '#ffd166',
    );
    this.spawnEnemy(true);
    this.publishHud(true);
  }

  // =========================================================================
  // main loop
  // =========================================================================
  private frame = (t: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (dt > 0.25) dt = 0.25;

    if (this.running) {
      this.acc += dt;
      const fixed = 1 / 60;
      let steps = 0;
      while (this.acc >= fixed && steps < 4) {
        this.acc -= fixed;
        steps++;
        if (this.hitStop > 0) { this.hitStop -= fixed; continue; }
        this.timeScale = lerp(this.timeScale, this.targetScale, 1 - Math.exp(-9 * fixed));
        this.step(fixed * this.timeScale);
      }
      if (steps >= 4) this.acc = 0;
      this.hudTimer -= dt;
      if (this.hudTimer <= 0) { this.hudTimer = 0.07; this.publishHud(); }
    }
    this.updateCamera(dt);
    drawWorld(this);
  };

  // =========================================================================
  // simulation
  // =========================================================================
  private step(dt: number) {
    this.playTime += dt;
    this.levelTime += dt;
    this.vignette = Math.max(0, this.vignette - dt * 1.5);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.cam.kick = Math.max(0, this.cam.kick - dt * 3.4);
    this.boostCd = Math.max(0, this.boostCd - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.updatePlayer(dt);
    for (let i = 0; i < this.tanks.length; i++) {
      const t = this.tanks[i];
      if (!t.player) this.updateEnemy(t, dt);
      this.integrateTank(t, dt);
    }
    this.separateTanks();
    this.updateBases(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.director(dt);
    this.fadeDecals(dt);

    if (this.ending > 0) {
      this.ending -= dt;
      if (this.ending <= 0) {
        this.targetScale = 1;
        this.timeScale = 1;
        if (this.endKind === 'sector') {
          this.phase = 'depot';
          this.running = false;
          this.publishHud(true);
          this.hooks.onEvent('sectorClear', this.sector);
        } else if (this.endKind === 'over') {
          this.phase = 'over';
          this.running = false;
          this.publishHud(true);
          this.hooks.onEvent('gameOver');
        }
        this.endKind = null;
      }
    }
  }

  get playerLevelStats(): PlayerStats {
    const l = this.levels;
    const chassis = PLAYER_TANK_MAP[this.selectedTank];
    return {
      dmg: this.player.dmg * (1 + 0.28 * l.cannon),
      rate: this.player.rate / (1 + 0.22 * l.loader),
      speed: this.player.speed * (1 + 0.11 * l.turbine),
      maxHp: chassis.hp + 32 * l.armor,
      resist: Math.min(0.5, 0.06 * l.armor),
      shots: 1 + l.multishot + (chassis.bonusShots ?? 0),
      pierce: l.pierce + (chassis.bonusPierce ?? 0),
      regen: 1.6 * l.drones,
    };
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const st = this.playerLevelStats;
    if (p.maxHp !== st.maxHp) {
      const diff = st.maxHp - p.maxHp;
      p.maxHp = st.maxHp;
      p.hp = clamp(p.hp + Math.max(0, diff), 1, st.maxHp);
    }
    if (st.regen > 0 && p.hp < p.maxHp && !p.dead) {
      p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);
    }

    if (p.dead) {
      p.spawnPop = 0;
      this.respawn -= dt;
      if (this.respawn <= 0) {
        p.dead = false;
        p.hp = p.maxHp;
        p.x = 330;
        p.y = WORLD.h / 2;
        p.vx = 0; p.vy = 0;
        p.spawnPop = 0.6;
        p.hitFlash = 0.4;
        this.burst(p.x, p.y, 22, '#ffd166', 260);
        this.ring(p.x, p.y, 90, 'rgba(255,209,102,0.9)');
        this.hooks.onEvent('respawn');
        audio.play('spawn');
      }
      return;
    }
    p.spawnPop = Math.max(0, p.spawnPop - dt);
    p.hp = Math.min(p.hp, p.maxHp);

    // --- movement input
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (this.moveStick.x !== 0 || this.moveStick.y !== 0) {
      mx = this.moveStick.x; my = this.moveStick.y;
    }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }

    const sp = st.speed;
    const smooth = 1 - Math.exp(-13 * dt);
    p.vx = lerp(p.vx, mx * sp, smooth);
    p.vy = lerp(p.vy, my * sp, smooth);

    // --- aim
    const ap = this.aimPoint();
    const aimX = ap.x, aimY = ap.y;
    const desired = Math.atan2(aimY - p.y, aimX - p.x);
    const dA = angleDiff(p.turret, desired);
    p.turret += dA * (1 - Math.exp(-18 * dt));

    // --- firing
    p.cd -= dt;
    p.recoil = Math.max(0, p.recoil - dt * 6);
    let wantFire = this.firingMouse || this.firingStick || this.keys.has('Space');
    if (!wantFire && this.autoFire) {
      const tgt = this.nearestEnemyInCone(p.x, p.y, p.turret, 0.5, p.range, false);
      if (tgt && this.hasLineOfSight(p.x, p.y, tgt.x, tgt.y)) wantFire = true;
    }
    if (wantFire && p.cd <= 0) this.playerShoot(st);
  }

  private playerShoot(st: PlayerStats) {
    const p = this.player;
    const shots = st.shots;
    const spread = 0.1;
    for (let i = 0; i < shots; i++) {
      const off = shots === 1 ? 0 : (i - (shots - 1) / 2) * spread * 2;
      const a = p.turret + off;
      const mx = p.x + Math.cos(a) * (p.r + 22);
      const my = p.y + Math.sin(a) * (p.r + 22);
      const dmgMul = i === 0 ? 1 : 0.78;
      this.spawnBullet(mx, my, a, st.dmg * dmgMul, 700, 'p', st.pierce, 'shell');
      this.p('flash', mx, my, Math.cos(a) * 60, Math.sin(a) * 60, 0.12, 17, '#ffe6a8');
      for (let s = 0; s < 4; s++) {
        const sa = a + rand(-0.4, 0.4);
        this.p('spark', mx, my, Math.cos(sa) * rand(120, 380), Math.sin(sa) * rand(120, 380), rand(0.15, 0.32), rand(2, 4), '#ffd166');
      }
      for (let s = 0; s < 3; s++) {
        this.p('smoke', mx, my, Math.cos(a) * rand(20, 90), Math.sin(a) * rand(20, 90) - 10, rand(0.4, 0.8), rand(8, 15), 'rgba(190,190,190,0.5)');
      }
      this.p('casing', p.x + Math.cos(a + 1.6) * 14, p.y + Math.sin(a + 1.6) * 14,
        Math.cos(a + 1.9) * rand(60, 140), Math.sin(a + 1.9) * rand(60, 140), 0.9, 4, '#e0b060');
    }
    p.cd = st.rate;
    p.recoil = 1;
    p.vx -= Math.cos(p.turret) * 55;
    p.vy -= Math.sin(p.turret) * 55;
    this.addTrauma(0.15);
    this.cam.kick = Math.min(0.12, this.cam.kick + 0.05);
    audio.play(shots > 1 ? 'shootBig' : 'shoot', 0.8);
  }

  private tryBoost() {
    if (this.phase !== 'play' || !this.running) return;
    const p = this.player;
    if (p.dead || this.boostCd > 0) return;
    let ax = this.moveStick.x, ay = this.moveStick.y;
    if (ax === 0 && ay === 0) {
      const k = this.keys;
      if (k.has('KeyA') || k.has('ArrowLeft')) ax -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ax += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) ay -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) ay += 1;
    }
    if (ax === 0 && ay === 0) { ax = Math.cos(p.turret); ay = Math.sin(p.turret); }
    const l = Math.hypot(ax, ay) || 1;
    ax /= l; ay /= l;
    p.vx += ax * 560;
    p.vy += ay * 560;
    this.boostCd = 2.4;
    this.addTrauma(0.24);
    this.cam.kick = 0.06;
    audio.play('boost');
    for (let i = 0; i < 18; i++) {
      const a = Math.atan2(-ay, -ax) + rand(-0.5, 0.5);
      this.p('spark', p.x, p.y, Math.cos(a) * rand(80, 300), Math.sin(a) * rand(80, 300), rand(0.2, 0.45), rand(2, 5), '#8be9ff');
      this.p('smoke', p.x, p.y, Math.cos(a) * rand(20, 70), Math.sin(a) * rand(20, 70), rand(0.3, 0.6), rand(10, 18), 'rgba(150,200,230,0.45)');
    }
    this.ring(p.x, p.y, 60, 'rgba(139,233,255,0.7)');
  }

  // ---- enemies ------------------------------------------------------------
  private enemyScale() {
    const s = this.sector;
    if (s === 1) return { hp: 0.62, dmg: 0.38, spd: 0.78 };
    return {
      hp: Math.pow(1.16, s - 2),
      dmg: Math.pow(1.1, s - 2),
      spd: Math.min(1.5, 1 + 0.025 * (s - 1)),
    };
  }

  private spawnEnemy(forward = false) {
    const pool: [EnemyKind, number][] = [];
    const s = this.sector;
    const w = (k: EnemyKind, weight: number) => { if (weight > 0) pool.push([k, weight]); };
    w('scout', s === 1 ? 100 : Math.max(8, 44 - s * 5));
    w('grunt', s === 1 ? 0 : 40 + Math.min(20, s * 2));
    w('bomber', s >= 2 ? 8 + s * 2 : 0);
    w('sniper', s >= 3 ? 8 + s * 2 : 0);
    w('heavy', s >= 3 ? 6 + s * 3 : 0);
    let total = 0;
    for (const it of pool) total += it[1];
    let r = Math.random() * total;
    let kind: EnemyKind = 'scout';
    for (const it of pool) { r -= it[1]; if (r <= 0) { kind = it[0]; break; } }

    const prof = ENEMY_PROFILES[kind];
    const sc = this.enemyScale();
    const elite = s >= 4 && Math.random() < Math.min(0.3, 0.04 + s * 0.03);

    // forward deployment drops squads into mid-field so the fight starts fast
    let x = 0, y = 0;
    const drop = () => {
      if (forward) {
        x = rand(1150, 1560);
        y = rand(190, WORLD.h - 190);
      } else {
        x = this.enemyBase.x - rand(80, 210);
        y = this.enemyBase.y + rand(-1, 1) * rand(120, 320);
      }
    };
    drop();
    let tries = 0;
    while (this.blockedAt(x, y, prof.r + 10) && tries++ < 16) drop();
    if (forward && Math.abs(y - WORLD.h / 2) < 60) y += (y > WORLD.h / 2 ? 1 : -1) * 90;

    const t: Tank = {
      id: this.nextId++, x, y, vx: 0, vy: 0,
      angle: Math.PI, turret: Math.PI,
      hp: prof.hp * sc.hp * (elite ? 2.1 : 1),
      maxHp: prof.hp * sc.hp * (elite ? 2.1 : 1),
      r: prof.r * (elite ? 1.12 : 1),
      player: false, kind,
      dmg: prof.dmg * sc.dmg * (elite ? 1.35 : 1),
      rate: prof.rate * (elite ? 0.85 : 1),
      bulletSpeed: prof.bulletSpeed, range: prof.range,
      speed: prof.speed * sc.spd * (elite ? 1.1 : 1),
      cd: rand(0.3, 1.2), hitFlash: 0, dead: false,
      aiTimer: rand(0, 1.4), strafe: Math.random() > 0.5 ? 1 : -1,
      goal: { x: this.playerBase.x, y: this.playerBase.y },
      losOk: false, losTimer: rand(0, 0.3),
      turretTurn: kind === 'sniper' ? 2.4 : 3.6,
      trackDist: 0, recoil: 0, spawnPop: 0.35, elite,
      tier: Math.min(10, s), twin: false,
      salvageValue: Math.round(prof.salvage * (elite ? 2.4 : 1) * (1 + (s - 1) * 0.12)),
      scoreValue: Math.round(prof.score * (elite ? 2.4 : 1)),
    };
    this.tanks.push(t);
    this.ring(x, y, 46, 'rgba(255,90,120,0.55)');
    this.p('flash', x, y, 0, 0, 0.2, 20, prof.accent);
  }

  /** The "Very Big Tank" — a twin-cannon boss that guards the enemy HQ. */
  bossAlive = false;
  bossSpawned = false;
  get isBossLevel() { return this.sector % 5 === 0; }
  private spawnBoss() {
    const prof = ENEMY_PROFILES.boss;
    const s = this.sector;
    const hpMul = 1 + (s - 5) * 0.35;
    const x = this.enemyBase.x - 240;
    const y = this.enemyBase.y;
    const t: Tank = {
      id: this.nextId++, x, y, vx: 0, vy: 0,
      angle: Math.PI, turret: Math.PI,
      hp: prof.hp * hpMul, maxHp: prof.hp * hpMul, r: prof.r,
      player: false, kind: 'boss',
      dmg: prof.dmg * (1 + (s - 5) * 0.12),
      rate: prof.rate, bulletSpeed: prof.bulletSpeed, range: prof.range,
      speed: prof.speed, cd: 1.2, hitFlash: 0, dead: false,
      aiTimer: rand(0, 1.4), strafe: Math.random() > 0.5 ? 1 : -1,
      goal: { x: this.playerBase.x, y: this.playerBase.y },
      losOk: false, losTimer: rand(0, 0.3), turretTurn: 1.8,
      trackDist: 0, recoil: 0, spawnPop: 0.6, elite: false,
      tier: Math.min(10, s), twin: true,
      salvageValue: Math.round(prof.salvage * (1 + (s - 5) * 0.18)),
      scoreValue: Math.round(prof.score * (1 + (s - 5) * 0.2)),
    };
    this.tanks.push(t);
    this.bossAlive = true;
    this.ring(x, y, 180, 'rgba(255,120,40,0.8)');
    this.explosion(x, y, 1.4, '#ff7a1a');
    this.addTrauma(0.6);
    this.announce('⚠ WARLORD BOSS INBOUND', '#ff7a1a');
    audio.play('bigExplode', 0.6);
  }

  private updateEnemy(t: Tank, dt: number) {
    const prof = ENEMY_PROFILES[t.kind as EnemyKind];
    const p = this.player;
    const pb = this.playerBase;

    const dp = p.dead ? 1e9 : Math.hypot(p.x - t.x, p.y - t.y);
    const engageRange = t.range > 0 ? t.range + 90 : 420;
    let tx: number, ty: number, targetIsBase = false;
    if (!p.dead && dp < engageRange && t.kind !== 'bomber') {
      tx = p.x; ty = p.y;
    } else {
      tx = pb.x; ty = pb.y; targetIsBase = true;
    }
    const dist = Math.hypot(tx - t.x, ty - t.y);
    const ang = Math.atan2(ty - t.y, tx - t.x);

    let mvA = ang;
    let want = 1;
    if (t.kind !== 'bomber') {
      if (dist < prof.prefDist * 0.82) want = -0.55;
      else if (dist < prof.prefDist * 1.25) { mvA = ang + (Math.PI / 2) * t.strafe; want = 0.75; }
    }
    t.aiTimer -= dt;
    if (t.aiTimer <= 0) {
      t.aiTimer = rand(0.8, 1.8);
      if (Math.random() < 0.4) t.strafe *= -1;
    }
    if (this.pathBlocked(t.x, t.y, mvA, t.r + 96)) {
      const opts = [0.7, -0.7, 1.4, -1.4, 2.2, -2.2];
      let found = false;
      for (const o of opts) {
        if (!this.pathBlocked(t.x, t.y, mvA + o, t.r + 90)) { mvA += o; found = true; break; }
      }
      if (!found) mvA += Math.PI * 0.5 * t.strafe;
    }
    const sep = this.separation(t);
    const sp = t.speed * want;
    const smooth = 1 - Math.exp(-8 * dt);
    t.vx = lerp(t.vx, Math.cos(mvA) * sp + sep.x, smooth);
    t.vy = lerp(t.vy, Math.sin(mvA) * sp + sep.y, smooth);

    t.losTimer -= dt;
    if (t.losTimer <= 0) {
      t.losTimer = 0.2 + Math.random() * 0.15;
      t.losOk = this.hasLineOfSight(t.x, t.y, tx, ty);
    }
    let aimAng = ang;
    if (!targetIsBase && t.losOk) {
      const lead = this.predictLead(t, p);
      aimAng = Math.atan2(lead.y - t.y, lead.x - t.x);
    }
    const dA = angleDiff(t.turret, aimAng);
    const maxTurn = t.turretTurn * dt;
    t.turret += clamp(dA, -maxTurn, maxTurn);

    t.cd -= dt;
    t.recoil = Math.max(0, t.recoil - dt * 6);
    const inRange = t.kind !== 'bomber' && dist < t.range;
    if (inRange && t.cd <= 0 && t.losOk && Math.abs(dA) < 0.18) {
      t.cd = t.rate * rand(0.85, 1.2);
      t.recoil = 1;
      // Twin-cannon enemies (the Warlord boss) fire a paired volley.
      const offsets = t.twin ? [-t.r * 0.32, t.r * 0.32] : [0];
      const perp = t.turret + Math.PI / 2;
      for (const off of offsets) {
        const mx = t.x + Math.cos(t.turret) * (t.r + 18) + Math.cos(perp) * off;
        const my = t.y + Math.sin(t.turret) * (t.r + 18) + Math.sin(perp) * off;
        this.spawnBullet(mx, my, t.turret, t.dmg, t.bulletSpeed, 'e', 0, t.kind === 'sniper' ? 'rail' : 'bolt');
        this.p('flash', mx, my, Math.cos(t.turret) * 40, Math.sin(t.turret) * 40, 0.1, 13, prof.accent);
        for (let s = 0; s < 3; s++) {
          const sa = t.turret + rand(-0.35, 0.35);
          this.p('spark', mx, my, Math.cos(sa) * rand(80, 220), Math.sin(sa) * rand(80, 220), rand(0.12, 0.25), rand(2, 3), prof.accent);
        }
      }
      if (t.twin) { this.addTrauma(0.2); this.cam.kick = Math.min(0.1, this.cam.kick + 0.05); }
      const dToCam = Math.hypot(t.x - this.cam.x, t.y - this.cam.y);
      if (dToCam < 900) audio.play(t.twin ? 'shootBig' : 'enemyShoot', clamp(1 - dToCam / 1000, 0.12, 0.7));
    }

    if (t.kind === 'bomber') {
      const hitBase = Math.abs(t.x - pb.x) < pb.w / 2 + t.r
        && Math.abs(t.y - pb.y) < pb.h / 2 + t.r;
      const hitPlayer = !p.dead && Math.hypot(p.x - t.x, p.y - t.y) < t.r + p.r + 6;
      if (hitBase || hitPlayer) this.detonate(t, hitPlayer);
    }
  }

  private separation(t: Tank) {
    let sx = 0, sy = 0;
    for (let i = 0; i < this.tanks.length; i++) {
      const o = this.tanks[i];
      if (o === t || o.dead) continue;
      const dx = t.x - o.x, dy = t.y - o.y;
      const d2 = dx * dx + dy * dy;
      const min = (t.r + o.r + 12) * (t.r + o.r + 12);
      if (d2 < min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = (1 - d / Math.sqrt(min)) * 190;
        sx += (dx / d) * f; sy += (dy / d) * f;
      }
    }
    for (const b of [this.playerBase, this.enemyBase]) {
      const dx = t.x - b.x, dy = t.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 160 && d > 0.01) {
        const f = (1 - d / 160) * 160;
        sx += (dx / d) * f; sy += (dy / d) * f;
      }
    }
    return { x: sx, y: sy };
  }

  private integrateTank(t: Tank, dt: number) {
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.hitFlash = Math.max(0, t.hitFlash - dt * 4);

    const spd = Math.hypot(t.vx, t.vy);
    if (spd > 14) {
      const desired = Math.atan2(t.vy, t.vx);
      const dA = angleDiff(t.angle, desired);
      const rate = t.player ? 9 : 5;
      t.angle += clamp(dA, -rate * dt, rate * dt);
    }
    const m = t.r;
    if (t.x < m) { t.x = m; t.vx = Math.abs(t.vx) * 0.3; }
    if (t.x > WORLD.w - m) { t.x = WORLD.w - m; t.vx = -Math.abs(t.vx) * 0.3; }
    if (t.y < m) { t.y = m; t.vy = Math.abs(t.vy) * 0.3; }
    if (t.y > WORLD.h - m) { t.y = WORLD.h - m; t.vy = -Math.abs(t.vy) * 0.3; }

    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      if (o.kind === 'crate' && o.hp <= 0) continue;
      const cx = clamp(t.x, o.x, o.x + o.w);
      const cy = clamp(t.y, o.y, o.y + o.h);
      const dx = t.x - cx, dy = t.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < t.r * t.r) {
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d, ny = dy / d;
        const push = t.r - d;
        t.x += nx * push;
        t.y += ny * push;
        const dot = t.vx * nx + t.vy * ny;
        if (dot < 0) { t.vx -= nx * dot * 1.1; t.vy -= ny * dot * 1.1; }
      }
    }

    t.trackDist += spd * dt;
    if (t.trackDist > 26) {
      t.trackDist = 0;
      const g = this.decalCtx;
      const s = 0.5;
      g.save();
      g.translate(t.x * s, t.y * s);
      g.rotate(t.angle);
      g.fillStyle = t.player ? 'rgba(255,190,110,0.10)' : 'rgba(255,110,130,0.08)';
      g.fillRect(-6 * s, -t.r * s, 12 * s, 5 * s);
      g.fillRect(-6 * s, (t.r - 5) * s, 12 * s, 5 * s);
      g.restore();
    }
  }

  private separateTanks() {
    for (let i = 0; i < this.tanks.length; i++) {
      const a = this.tanks[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.tanks.length; j++) {
        const b = this.tanks[j];
        if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.001) {
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          const push = (min - d) / 2;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  private detonate(t: Tank, hitPlayer: boolean) {
    if (t.dead) return;              // guards against chain recursion
    t.dead = true;
    const p = this.player;
    const R = 135;
    const px = t.x, py = t.y, power = t.dmg;
    // visual / feel first
    this.explosion(px, py, 1.25, '#ffb03a');
    this.ring(px, py, 40, 'rgba(255,160,60,0.9)');
    this.addTrauma(0.55);
    this.hitStop = 0.05;
    audio.play('explode', 1);
    // then damage (splash cannot re-trigger this tank)
    if (!p.dead) {
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < R) this.damagePlayer(power * (1 - d / R) * (hitPlayer ? 1 : 0.75));
    }
    const db = Math.hypot(this.playerBase.x - px, this.playerBase.y - py);
    if (db < R + 70) this.damageBase(this.playerBase, power * 1.2, 'e');
    for (const o of this.tanks) {
      if (o === t || o.player || o.dead) continue;
      const d = Math.hypot(o.x - px, o.y - py);
      if (d < R * 0.7) this.damageEnemy(o, power * 0.4, false);
    }
  }

  // ---- bases --------------------------------------------------------------
  private updateBases(dt: number) {
    const pb = this.playerBase, eb = this.enemyBase;
    pb.hitFlash = Math.max(0, pb.hitFlash - dt * 4);
    eb.hitFlash = Math.max(0, eb.hitFlash - dt * 4);
    pb.alarm = Math.max(0, pb.alarm - dt);
    if (!pb.alive || !eb.alive) return;

    const sl = this.levels.sentry;
    pb.cd -= dt;
    if (pb.cd <= 0) {
      const tgt = this.nearestEnemy(pb.x, pb.y, 650);
      if (tgt) {
        const ang = Math.atan2(tgt.y - pb.y, tgt.x - pb.x);
        const dA = angleDiff(pb.turret, ang);
        pb.turret += clamp(dA, -3.2 * dt, 3.2 * dt);
        if (Math.abs(dA) < 0.22) {
          pb.cd = 1.15 / (1 + 0.18 * sl);
          const dmg = 15 * (1 + 0.45 * sl) * (1 + 0.06 * this.sector);
          const mx = pb.x + Math.cos(pb.turret) * 74;
          const my = pb.y + Math.sin(pb.turret) * 74;
          this.spawnBullet(mx, my, pb.turret, dmg, 640, 'p', 0, 'shell');
          this.p('flash', mx, my, Math.cos(pb.turret) * 50, Math.sin(pb.turret) * 50, 0.12, 15, '#ffd166');
          audio.play('shoot', 0.35);
        }
      }
    }

    const sc = this.enemyScale();
    eb.cd -= dt;
    if (eb.cd <= 0 && !this.player.dead) {
      const p = this.player;
      const d = Math.hypot(p.x - eb.x, p.y - eb.y);
      if (d < 780) {
        const ang = Math.atan2(p.y - eb.y, p.x - eb.x);
        const dA = angleDiff(eb.turret, ang);
        eb.turret += clamp(dA, -2.6 * dt, 2.6 * dt);
        if (Math.abs(dA) < 0.24) {
          eb.cd = 1.3 / (1 + 0.05 * this.sector);
          const mx = eb.x + Math.cos(eb.turret) * 74;
          const my = eb.y + Math.sin(eb.turret) * 74;
          this.spawnBullet(mx, my, eb.turret, 17 * sc.dmg, 570, 'e', 0, 'bolt');
          this.p('flash', mx, my, Math.cos(eb.turret) * 50, Math.sin(eb.turret) * 50, 0.12, 15, '#ff8fa0');
          audio.play('enemyShoot', 0.45);
        }
      }
    }
  }

  private damageBase(b: BaseData, dmg: number, by: 'p' | 'e') {
    if (!b.alive) return;
    // The enemy HQ is shielded while its Warlord boss still stands.
    if (b.owner === 'e' && by === 'p' && this.bossAlive) {
      b.hitFlash = 1;
      if (Math.random() < 0.35) this.floatText(b.x, b.y - 95, 'SHIELDED', '#8fd0ff');
      return;
    }
    b.hp -= dmg;
    b.hitFlash = 1;
    if (by === 'p') {
      this.floatText(b.x + rand(-30, 30), b.y - 95, `${Math.round(dmg)}`, '#ffd166');
    } else {
      if (b.alarm <= 0) { b.alarm = 1.6; audio.play('alarm', 0.5); }
      this.addTrauma(0.14);
      this.vignette = Math.min(1, this.vignette + 0.35);
    }
    this.burst(b.x + rand(-40, 40), b.y + rand(-50, 50), 4, '#ffd166', 130);
    if (b.hp <= 0) { b.hp = 0; b.alive = false; this.baseDestroyed(b); }
  }

  private baseDestroyed(b: BaseData) {
    const cx = b.x, cy = b.y;
    this.targetScale = 0.4;
    this.timeScale = 0.28;
    this.addTrauma(1.2);
    this.hitStop = 0.09;
    this.flash = 1;
    this.flashColor = b.owner === 'p' ? '255,60,50' : '255,220,140';
    for (let i = 0; i < 5; i++) {
      window.setTimeout(() => {
        if (this.destroyed) return;
        this.explosion(cx + rand(-70, 70), cy + rand(-70, 70), 1.3, '#ffb03a');
        this.addTrauma(0.5);
      }, i * 130);
    }
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * 6.28, s = rand(120, 620);
      this.p('debris', cx, cy, Math.cos(a) * s, Math.sin(a) * s, rand(0.8, 1.8), rand(4, 11), i % 3 ? '#8a7a5a' : '#ff9f45');
    }
    this.ring(cx, cy, 320, 'rgba(255,200,120,0.85)');
    this.ring(cx, cy, 180, 'rgba(255,255,255,0.7)');
    audio.play('bigExplode');
    this.scorch(cx, cy, 120);

    if (b.owner === 'e') {
      this.score += 500 * this.sector + Math.round(this.playTime) * 5;
      this.salvage += 60 + 45 * this.sector;
      for (const t of this.tanks) {
        if (!t.player && !t.dead) {
          this.explosion(t.x, t.y, 0.8, '#ff8fa0');
          this.score += 40;
        }
      }
      this.tanks = this.tanks.filter((t) => t.player);
      this.announce('ENEMY HQ DESTROYED', '#ffd166');
      this.ending = 1.5;
      this.endKind = 'sector';
      audio.play('sector');
    } else {
      this.announce('HQ LOST', '#ff5f6d');
      this.ending = 2.0;
      this.endKind = 'over';
      audio.play('gameover');
      audio.stopMusic();
    }
  }

  // ---- bullets ------------------------------------------------------------
  private spawnBullet(
    x: number, y: number, a: number, dmg: number, speed: number,
    owner: 'p' | 'e', pierce: number, kind: Bullet['kind'],
  ) {
    let b: Bullet | undefined;
    for (let i = 0; i < this.bullets.length; i++) {
      if (!this.bullets[i].active) { b = this.bullets[i]; break; }
    }
    if (!b) {
      if (this.bullets.length > 420) return;
      b = {
        active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, r: 5, dmg: 0,
        life: 0, owner: 'p', pierce: 0, hits: 0, lastHit: 0, kind: 'shell',
        hue: '#fff', glow: '#fff',
      };
      this.bullets.push(b);
    }
    b.active = true;
    b.x = x; b.y = y; b.px = x; b.py = y;
    b.vx = Math.cos(a) * speed; b.vy = Math.sin(a) * speed;
    b.dmg = dmg; b.owner = owner; b.pierce = pierce; b.hits = 0; b.lastHit = -1;
    b.life = kind === 'rail' ? 2.2 : 1.7;
    b.kind = kind;
    b.r = kind === 'rail' ? 4 : kind === 'shell' ? 5.5 : 4.5;
    if (owner === 'p') { b.hue = '#ffe0a3'; b.glow = 'rgba(255,180,80,0.55)'; }
    else if (kind === 'rail') { b.hue = '#e0c0ff'; b.glow = 'rgba(190,120,255,0.5)'; }
    else { b.hue = '#ffb3c0'; b.glow = 'rgba(255,80,110,0.5)'; }
  }

  private updateBullets(dt: number) {
    const p = this.player;
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;
      b.px = b.x; b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > WORLD.w + 40 || b.y < -40 || b.y > WORLD.h + 40) {
        b.active = false;
        continue;
      }
      if (Math.random() < 0.45) {
        this.p('spark', b.x, b.y, -b.vx * 0.04, -b.vy * 0.04, 0.14, b.r * 0.7, b.hue);
      }

      let consumed = false;
      for (let j = 0; j < this.obstacles.length; j++) {
        const o = this.obstacles[j];
        if (o.kind === 'crate' && o.hp <= 0) continue;
        const cx = clamp(b.x, o.x, o.x + o.w);
        const cy = clamp(b.y, o.y, o.y + o.h);
        const dx = b.x - cx, dy = b.y - cy;
        if (dx * dx + dy * dy < b.r * b.r) {
          if (o.kind === 'crate') {
            o.hp -= b.dmg;
            this.burst(b.x, b.y, 6, '#d8a45f', 190);
            if (o.hp <= 0) {
              this.explosion(o.x + o.w / 2, o.y + o.h / 2, 0.55, '#c98f4a');
              this.salvage += 6;
              this.score += 15;
              this.floatText(o.x + o.w / 2, o.y, '+6', '#ffd166');
            }
          } else {
            this.burst(b.x, b.y, 6, '#b9c6d6', 210);
            this.p('flash', b.x, b.y, 0, 0, 0.1, 10, '#ffffff');
          }
          audio.play('hit', 0.22);
          b.active = false;
          consumed = true;
          break;
        }
      }
      if (consumed) continue;

      if (b.owner === 'p') {
        for (let j = 0; j < this.tanks.length; j++) {
          const t = this.tanks[j];
          if (t.player || t.dead || t.id === b.lastHit) continue;
          const dx = t.x - b.x, dy = t.y - b.y;
          const rr = t.r + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            this.damageEnemy(t, b.dmg, true);
            this.burst(b.x, b.y, 8, '#ffd166', 260);
            audio.play('hit', 0.32);
            b.lastHit = t.id;
            if (b.hits >= b.pierce) { b.active = false; break; }
            b.hits++;
          }
        }
        if (!b.active) continue;
        const eb = this.enemyBase;
        if (eb.alive && this.pointInBase(b.x, b.y, eb, b.r)) {
          this.damageBase(eb, b.dmg, 'p');
          this.burst(b.x, b.y, 8, '#ffd166', 240);
          audio.play('hit', 0.32);
          b.active = false;
          continue;
        }
      } else {
        if (!p.dead) {
          const dx = p.x - b.x, dy = p.y - b.y;
          const rr = p.r + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            this.damagePlayer(b.dmg);
            this.burst(b.x, b.y, 8, '#ff8fa0', 260);
            b.active = false;
            continue;
          }
        }
        const pb = this.playerBase;
        if (pb.alive && this.pointInBase(b.x, b.y, pb, b.r)) {
          this.damageBase(pb, b.dmg, 'e');
          this.burst(b.x, b.y, 8, '#ff8fa0', 220);
          b.active = false;
          continue;
        }
        for (let j = 0; j < this.tanks.length; j++) {
          const t = this.tanks[j];
          if (t.player || t.dead) continue;
          const dx = t.x - b.x, dy = t.y - b.y;
          const rr = t.r + b.r;
          if (dx * dx + dy * dy < rr * rr) {
            this.damageEnemy(t, b.dmg * 0.25, false);
            this.burst(b.x, b.y, 4, '#ff8fa0', 180);
            b.active = false;
            break;
          }
        }
      }
    }
  }

  private pointInBase(x: number, y: number, b: BaseData, r: number) {
    return x > b.x - b.w / 2 - r && x < b.x + b.w / 2 + r
      && y > b.y - b.h / 2 - r && y < b.y + b.h / 2 + r;
  }

  // ---- damage / death -----------------------------------------------------
  private damagePlayer(dmg: number) {
    const p = this.player;
    if (p.dead) return;
    const st = this.playerLevelStats;
    const real = dmg * (1 - st.resist);
    p.hp -= real;
    p.hitFlash = 1;
    this.floatText(p.x, p.y - 30, `-${Math.round(real)}`, '#ff6b81');
    this.addTrauma(0.2);
    this.vignette = Math.min(1, this.vignette + 0.4);
    this.flash = Math.max(this.flash, 0.3);
    this.flashColor = '255,70,60';
    audio.play('hurt', 0.45);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.respawn = 3;
      this.combo = 0;
      this.comboTimer = 0;
      this.explosion(p.x, p.y, 1.1, '#ffb347');
      this.addTrauma(0.9);
      this.hitStop = 0.06;
      this.damageBase(this.playerBase, 35, 'e');
      this.hooks.onEvent('playerDeath');
    }
  }

  private damageEnemy(t: Tank, dmg: number, showNumber: boolean) {
    if (t.dead) return;
    t.hp -= dmg;
    t.hitFlash = 1;
    if (showNumber) {
      this.floatText(t.x + rand(-8, 8), t.y - t.r - 10, `${Math.round(dmg)}`, '#ffe9a8');
    }
    if (t.hp <= 0) {
      if (t.kind === 'bomber') { this.detonate(t, false); return; }
      this.killTank(t, true);
    }
  }

  private killTank(t: Tank, reward: boolean) {
    if (t.dead) return;
    t.dead = true;
    const prof = ENEMY_PROFILES[t.kind as EnemyKind];
    if (t.kind === 'boss') {
      // Spectacular multi-stage detonation + drops the HQ shield.
      this.bossAlive = false;
      this.targetScale = 0.45;
      this.timeScale = 0.3;
      this.hitStop = 0.1;
      this.flash = 1;
      this.flashColor = '255,140,40';
      for (let i = 0; i < 6; i++) {
        window.setTimeout(() => {
          if (this.destroyed) return;
          this.explosion(t.x + rand(-60, 60), t.y + rand(-60, 60), 1.4, '#ff7a1a');
          this.addTrauma(0.6);
        }, i * 120);
      }
      this.ring(t.x, t.y, 260, 'rgba(255,140,40,0.9)');
      this.scorch(t.x, t.y, 140);
      audio.play('bigExplode', 1);
      this.announce('WARLORD DOWN — HQ EXPOSED!', '#ffd166');
    } else {
      this.explosion(t.x, t.y, t.player ? 1.2 : clamp(t.r / 18, 0.6, 1.5), t.player ? '#ffb347' : prof.body);
      this.scorch(t.x, t.y, t.r * 1.6);
      audio.play('explode', clamp(t.r / 24, 0.35, 1));
    }
    if (!t.player && reward) {
      const mult = this.comboMult();
      this.combo++;
      this.comboTimer = 3.4;
      const pts = Math.round(t.scoreValue * mult);
      this.score += pts;
      this.salvage += t.salvageValue;
      this.kills++;
      this.floatText(t.x, t.y - 36, `+${pts}`, '#ffd166');
      if (this.combo > 1 && this.combo % 4 === 0) {
        this.announce(`COMBO x${this.comboMult()}`, '#8be9ff');
      }
      this.addTrauma(clamp(0.18 + t.r / 120, 0, 0.5));
      this.hitStop = t.r > 20 ? 0.045 : 0.02;
    }
  }

  comboMult() { return 1 + Math.min(7, Math.floor(this.combo / 4)); }

  // ---- particles ----------------------------------------------------------
  private p(
    kind: Particle['kind'], x: number, y: number, vx: number, vy: number,
    life: number, size: number, color: string, text?: string,
  ) {
    let q: Particle | undefined;
    for (let i = 0; i < this.particles.length; i++) {
      if (!this.particles[i].active) { q = this.particles[i]; break; }
    }
    if (!q) {
      if (this.particles.length > 850) return;
      q = {
        active: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1,
        size: 1, rot: 0, vr: 0, color: '#fff', drag: 0.9, grav: 0, hits: 0,
      };
      this.particles.push(q);
    }
    q.active = true;
    q.kind = kind; q.x = x; q.y = y; q.vx = vx; q.vy = vy;
    q.life = life; q.maxLife = life; q.size = size; q.color = color; q.text = text;
    q.rot = Math.random() * 6.28;
    q.vr = rand(-8, 8);
    q.drag = kind === 'smoke' ? 1.6 : kind === 'debris' ? 1.1 : 3.4;
    q.grav = kind === 'debris' || kind === 'casing' ? 240 : 0;
  }

  private updateParticles(dt: number) {
    for (let i = 0; i < this.particles.length; i++) {
      const q = this.particles[i];
      if (!q.active) continue;
      q.life -= dt;
      if (q.life <= 0) { q.active = false; continue; }
      if (q.kind === 'ring') { q.size += dt * 460; continue; }
      const d = Math.exp(-q.drag * dt);
      q.vx *= d; q.vy *= d;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      if (q.kind === 'smoke') q.size += dt * 24;
      if (q.kind === 'text') q.y -= dt * 44;
    }
  }

  private burst(x: number, y: number, n: number, color: string, speed: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = rand(speed * 0.3, speed);
      this.p('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.12, 0.3), rand(1.5, 3.5), color);
    }
  }

  private ring(x: number, y: number, size: number, color: string) {
    this.p('ring', x, y, 0, 0, 0.42, size, color);
  }

  explosion(x: number, y: number, scale: number, color: string) {
    const n = Math.round(18 * scale);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = rand(60, 340) * scale;
      this.p('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.5), rand(2, 5) * scale, color);
    }
    for (let i = 0; i < Math.round(10 * scale); i++) {
      const a = Math.random() * 6.28, s = rand(20, 110) * scale;
      this.p('smoke', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.6, 1.3), rand(12, 26) * scale, 'rgba(120,120,130,0.55)');
    }
    for (let i = 0; i < Math.round(8 * scale); i++) {
      const a = Math.random() * 6.28, s = rand(90, 320) * scale;
      this.p('debris', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.5, 1.2), rand(3, 7) * scale, i % 2 ? '#8a7a5a' : '#ffb347');
    }
    this.p('flash', x, y, 0, 0, 0.16, 46 * scale, '#fff3d0');
    this.ring(x, y, 26 * scale, 'rgba(255,210,140,0.85)');
    this.addTrauma(clamp(0.22 * scale, 0, 0.7));
    this.scorch(x, y, 34 * scale);
  }

  private scorch(x: number, y: number, r: number) {
    const g = this.decalCtx;
    const s = 0.5;
    const rg = g.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
    rg.addColorStop(0, 'rgba(10,8,6,0.5)');
    rg.addColorStop(1, 'rgba(10,8,6,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x * s, y * s, r * s, 0, 6.28);
    g.fill();
  }

  private fadeDecals(dt: number) {
    this.decalFade += dt;
    if (this.decalFade > 0.6) {
      this.decalFade = 0;
      const g = this.decalCtx;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(0, 0, this.decal.width, this.decal.height);
      g.globalCompositeOperation = 'source-over';
    }
  }

  private floatText(x: number, y: number, text: string, color: string) {
    let count = 0;
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active && this.particles[i].kind === 'text') count++;
    }
    if (count > 14) return;
    this.p('text', x, y, 0, 0, 0.75, 17, color, text);
  }

  announce(text: string, color: string) {
    this.announceText = text;
    this.announceColor = color;
    this.announceTimer = 2.0;
  }

  // ---- spawn director ----------------------------------------------------
  private director(dt: number) {
    if (this.ending > 0) return;
    const s = this.sector;
    const maxEnemies = s === 1 ? 2 : Math.min(14, 3 + Math.floor(s * 1.15));
    let alive = 0;
    for (const t of this.tanks) if (!t.player && !t.dead) alive++;

    // Boss levels: the Warlord arrives once the HQ is softened, and shields it.
    if (this.isBossLevel && !this.bossSpawned
      && (this.enemyBase.hp <= this.enemyBase.maxHp * 0.55 || this.levelTime > 14)) {
      this.spawnBoss();
      this.bossSpawned = true;
      audio.setIntensity(1);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && alive < maxEnemies && !this.bossAlive) {
      this.spawnEnemy();
      this.spawnTimer = (s === 1 ? 4.2 : clamp(2.9 - s * 0.14, 0.8, 3)) * rand(0.8, 1.2);
    }
    if (this.tanks.some((t) => t.dead && !t.player)) {
      this.tanks = this.tanks.filter((t) => !t.dead || t.player);
    }
    audio.setIntensity(clamp(0.15 + alive * 0.06 + s * 0.03, 0, 1));
  }

  // ---- queries ------------------------------------------------------------
  private nearestEnemy(x: number, y: number, range: number): Tank | null {
    let best: Tank | null = null;
    let bd = range * range;
    for (const t of this.tanks) {
      if (t.player || t.dead) continue;
      const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  private nearestEnemyInCone(
    x: number, y: number, ang: number, half: number, range: number, fallback = true,
  ) {
    let best: Tank | null = null;
    let bd = range * range;
    for (const t of this.tanks) {
      if (t.player || t.dead) continue;
      const dx = t.x - x, dy = t.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > bd) continue;
      const a = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(ang, a)) > half) continue;
      bd = d2; best = t;
    }
    if (!best && fallback) return this.nearestEnemy(x, y, Math.min(range, 520));
    return best;
  }

  /** Where the player's turret is trying to point (also drives the reticle). */
  aimPoint(): { x: number; y: number } {
    const p = this.player;
    const stickLen = Math.hypot(this.aimStick.x, this.aimStick.y);
    if (stickLen > 0.25) {
      let ang = Math.atan2(this.aimStick.y, this.aimStick.x);
      const assist = this.nearestEnemyInCone(p.x, p.y, ang, 0.45, 900);
      if (assist) {
        const lead = this.predictLead(p, assist);
        ang = Math.atan2(lead.y - p.y, lead.x - p.x);
      }
      return { x: p.x + Math.cos(ang) * 420, y: p.y + Math.sin(ang) * 420 };
    }
    if (!this.mouseActive) {
      const tgt = this.nearestEnemy(p.x, p.y, 900);
      if (tgt) return this.predictLead(p, tgt);
      return { x: p.x + Math.cos(p.turret) * 420, y: p.y + Math.sin(p.turret) * 420 };
    }
    return this.screenToWorld(this.aimScreen.x, this.aimScreen.y);
  }

  private predictLead(shooter: Tank, target: Tank) {
    const d = Math.hypot(target.x - shooter.x, target.y - shooter.y);
    const speed = shooter.player ? 700 : Math.max(1, shooter.bulletSpeed);
    const t = d / speed;
    return { x: target.x + target.vx * t * 0.9, y: target.y + target.vy * t * 0.9 };
  }

  private hasLineOfSight(x0: number, y0: number, x1: number, y1: number) {
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      for (const o of this.obstacles) {
        if (o.kind === 'crate') continue;
        if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return false;
      }
    }
    return true;
  }

  private pathBlocked(x: number, y: number, ang: number, dist: number) {
    for (let i = 1; i <= 3; i++) {
      const d = (dist * i) / 3;
      const px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d;
      if (px < 40 || px > WORLD.w - 40 || py < 40 || py > WORLD.h - 40) return true;
      if (this.blockedAt(px, py, 15)) return true;
    }
    return false;
  }

  private blockedAt(x: number, y: number, r: number) {
    for (const o of this.obstacles) {
      if (o.kind === 'crate' && o.hp <= 0) continue;
      const cx = clamp(x, o.x, o.x + o.w), cy = clamp(y, o.y, o.y + o.h);
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return this.pointInBase(x, y, this.playerBase, r) || this.pointInBase(x, y, this.enemyBase, r);
  }

  // ---- upgrades -----------------------------------------------------------
  canBuy(id: UpgradeId) {
    const def = UPGRADE_MAP[id];
    const lvl = this.levels[id];
    return lvl < def.max && this.salvage >= upgradeCost(def, lvl);
  }

  buy(id: UpgradeId): boolean {
    if (this.phase !== 'depot' && this.phase !== 'play') return false;
    const def = UPGRADE_MAP[id];
    const lvl = this.levels[id];
    const cost = upgradeCost(def, lvl);
    if (lvl >= def.max || this.salvage < cost) {
      audio.play('deny');
      return false;
    }
    this.salvage -= cost;
    this.levels[id] = lvl + 1;
    audio.play('buy');
    if (id === 'bulwark') {
      this.playerBase.maxHp += 140;
      this.playerBase.hp = Math.min(this.playerBase.maxHp, this.playerBase.hp + this.playerBase.maxHp * 0.35);
    }
    if (id === 'armor') {
      this.player.maxHp = PLAYER_TANK_MAP[this.selectedTank].hp + 32 * this.levels.armor;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 32);
    }
    this.ring(this.player.x, this.player.y, 70, 'rgba(255,220,140,0.8)');
    this.burst(this.player.x, this.player.y, 20, def.color, 220);
    this.announce(`${def.name} LV${lvl + 1}`, def.color);
    this.publishHud(true);
    return true;
  }

  // ---- helpers used by the renderer --------------------------------------
  screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.cw / 2) / this.cam.scale + this.cam.x,
      y: (sy - this.ch / 2) / this.cam.scale + this.cam.y,
    };
  }

  addTrauma(v: number) {
    if (!this.shakeOn) return;
    this.cam.trauma = Math.min(1, this.cam.trauma + v);
  }

  private updateCamera(dt: number) {
    const c = this.cam;
    if (this.announceTimer > 0) this.announceTimer -= dt;
    let fx: number, fy: number;
    if (this.phase === 'idle') {
      // slow cinematic drift across the battlefield behind the menus
      const t = performance.now() / 1000;
      fx = WORLD.w / 2 + Math.sin(t * 0.11) * 300;
      fy = WORLD.h / 2 + Math.cos(t * 0.083) * 170;
      c.trauma = Math.max(0, c.trauma - dt * 1.5);
      c.shakeX = 0; c.shakeY = 0; c.rot = 0;
    } else if (!this.player.dead) {
      const ap = this.aimPoint();
      fx = this.player.x + clamp(ap.x - this.player.x, -420, 420) * 0.2;
      fy = this.player.y + clamp(ap.y - this.player.y, -420, 420) * 0.2;
    } else {
      fx = lerp(this.playerBase.x + 140, this.player.x, 0.4);
      fy = lerp(this.playerBase.y, this.player.y, 0.4);
    }
    c.tx = fx; c.ty = fy;
    const s = 1 - Math.exp(-6.5 * dt);
    c.x = lerp(c.x, c.tx, s);
    c.y = lerp(c.y, c.ty, s);

    const minW = 860, minH = 520;
    let scale = Math.min(this.cw / minW, this.ch / minH);
    scale *= 1 + c.kick * 0.5;
    c.scale = scale;

    const visW = this.cw / scale, visH = this.ch / scale;
    if (visW < WORLD.w) c.x = clamp(c.x, visW / 2, WORLD.w - visW / 2);
    else c.x = WORLD.w / 2;
    if (visH < WORLD.h) c.y = clamp(c.y, visH / 2, WORLD.h - visH / 2);
    else c.y = WORLD.h / 2;

    c.trauma = Math.max(0, c.trauma - dt * 1.5);
    const t = c.trauma * c.trauma;
    const mag = t * 32;
    c.shakeX = (Math.random() * 2 - 1) * mag;
    c.shakeY = (Math.random() * 2 - 1) * mag;
    c.rot = (Math.random() * 2 - 1) * t * 0.02;
  }

  publishHud(force = false) {
    if (!force && this.phase === 'idle') return;
    let alive = 0;
    for (const t of this.tanks) if (!t.player && !t.dead) alive++;
    const st = this.playerLevelStats;
    this.hooks.onHud({
      hp: this.player.hp, maxHp: this.player.maxHp,
      baseHp: this.playerBase.hp, baseMaxHp: this.playerBase.maxHp,
      eBaseHp: this.enemyBase.hp, eBaseMaxHp: this.enemyBase.maxHp,
      score: Math.round(this.score), salvage: Math.floor(this.salvage),
      sector: this.sector, tank: this.selectedTank,
      combo: this.comboMult(), comboPct: clamp(this.comboTimer / 3.4, 0, 1),
      kills: this.kills, time: this.playTime,
      boostPct: clamp(1 - this.boostCd / 2.4, 0, 1),
      respawn: Math.max(0, this.respawn),
      enemies: alive,
      levels: { ...this.levels },
      baseUnderAttack: this.playerBase.alarm > 0,
      playerDps: st.dmg / st.rate,
    });
  }
}
