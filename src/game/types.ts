// ---------------------------------------------------------------------------
// IRON VANGUARD — shared types, tuning constants and upgrade definitions
// ---------------------------------------------------------------------------

export const WORLD = { w: 2200, h: 1300 };

export type PlayerTankId = 'ranger' | 'striker' | 'juggernaut' | 'tempest' | 'apex';

export interface PlayerTankDef {
  id: PlayerTankId;
  name: string;
  role: string;
  description: string;
  cost: number;
  hp: number;
  damage: number;
  rate: number;
  speed: number;
  radius: number;
  body: string;
  accent: string;
  /** Extra shells fired per volley, before any Split Barrel upgrades. */
  bonusShots?: number;
  /** Extra targets a shell punches through, before any Sabot upgrades. */
  bonusPierce?: number;
}

export const PLAYER_TANKS: PlayerTankDef[] = [
  {
    id: 'ranger', name: 'Ranger M1', role: 'BALANCED', cost: 0,
    description: 'Reliable sand-pattern scout. Balanced all-rounder.',
    hp: 140, damage: 23, rate: 0.42, speed: 225, radius: 19,
    body: '#c9b584', accent: '#ecd9a6',
  },
  {
    id: 'striker', name: 'Striker VX', role: 'ASSAULT', cost: 350,
    description: 'Blue rapid-cannon raider for aggressive pushes.',
    hp: 165, damage: 28, rate: 0.31, speed: 250, radius: 20,
    body: '#3f6fb0', accent: '#8fc0f0',
  },
  {
    id: 'juggernaut', name: 'Juggernaut', role: 'HEAVY', cost: 900,
    description: 'Navy-and-gold bruiser with devastating heavy shells.',
    hp: 290, damage: 48, rate: 0.58, speed: 175, radius: 24,
    body: '#2f3a52', accent: '#e8b53a',
  },
  {
    id: 'tempest', name: 'Tempest X', role: 'ELITE', cost: 1800,
    description: 'Gold prototype chassis with extreme all-round power.',
    hp: 250, damage: 55, rate: 0.28, speed: 265, radius: 22,
    body: '#d8a81e', accent: '#ffc24a',
  },
  {
    id: 'apex', name: 'Double Shooter', role: 'LEGENDARY', cost: 3800,
    description: 'Red twin-cannon destroyer with glowing reactor armour.',
    hp: 380, damage: 68, rate: 0.24, speed: 280, radius: 25,
    body: '#b5281f', accent: '#ff7a3a',
    bonusShots: 1,
    bonusPierce: 1,
  },
];

export const PLAYER_TANK_MAP = PLAYER_TANKS.reduce((map, tank) => {
  map[tank.id] = tank;
  return map;
}, {} as Record<PlayerTankId, PlayerTankDef>);

/** Coins banked for clearing a level. */
export function levelReward(level: number) {
  return 140 + level * 95;
}

/** Consolation coins for a lost run, so progress is never wasted. */
export function defeatReward(score: number) {
  return Math.floor(score / 12);
}

export type EnemyKind = 'scout' | 'grunt' | 'heavy' | 'sniper' | 'bomber' | 'boss';

/**
 * Per-level armour livery, matching the reference sheet
 * (L1 tan → L2 green → L3 sand → L4 blue → L5 gold → L6 red →
 *  L7 purple → L8 navy/gold → L9 red-glow → L10 gold-glow).
 */
export interface TierSkin { body: string; accent: string; glow: boolean; }

export const TIER_SKINS: TierSkin[] = [
  { body: '#b3a583', accent: '#d8cba6', glow: false }, // 1 tan
  { body: '#7d9b3f', accent: '#b6d072', glow: false }, // 2 green
  { body: '#c9b584', accent: '#ecd9a6', glow: false }, // 3 sand
  { body: '#3f6fb0', accent: '#8fc0f0', glow: false }, // 4 blue
  { body: '#e0a81e', accent: '#ffd864', glow: false }, // 5 gold
  { body: '#c23a2e', accent: '#ff8a72', glow: false }, // 6 red
  { body: '#7d3f9e', accent: '#c98fe6', glow: false }, // 7 purple
  { body: '#2f3a52', accent: '#e8b53a', glow: false }, // 8 navy + gold trim
  { body: '#c2302c', accent: '#ff7a3a', glow: true },  // 9 red glow
  { body: '#d8a81e', accent: '#ffc24a', glow: true },  // 10 gold glow
];

export function tierSkin(level: number): TierSkin {
  return TIER_SKINS[clampInt(level - 1, 0, TIER_SKINS.length - 1)];
}

function clampInt(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : Math.floor(v);
}

export interface EnemyProfile {
  hp: number;
  speed: number;
  dmg: number;
  rate: number; // seconds between shots
  bulletSpeed: number;
  range: number;
  prefDist: number;
  r: number;
  score: number;
  salvage: number;
  body: string;
  accent: string;
  label: string;
}

export const ENEMY_PROFILES: Record<EnemyKind, EnemyProfile> = {
  scout: {
    hp: 26, speed: 158, dmg: 7, rate: 1.05, bulletSpeed: 470, range: 430,
    prefDist: 250, r: 14, score: 70, salvage: 9,
    body: '#ff8fb0', accent: '#ffd0dd', label: 'SCOUT',
  },
  grunt: {
    hp: 48, speed: 108, dmg: 12, rate: 1.5, bulletSpeed: 430, range: 540,
    prefDist: 340, r: 17, score: 100, salvage: 13,
    body: '#ff5f6d', accent: '#ffc2c8', label: 'GRUNT',
  },
  heavy: {
    hp: 145, speed: 70, dmg: 26, rate: 2.3, bulletSpeed: 390, range: 580,
    prefDist: 400, r: 23, score: 240, salvage: 30,
    body: '#c02f4a', accent: '#ff8fa0', label: 'HEAVY',
  },
  sniper: {
    hp: 42, speed: 92, dmg: 22, rate: 2.5, bulletSpeed: 820, range: 940,
    prefDist: 660, r: 15, score: 200, salvage: 22,
    body: '#b06bff', accent: '#e6ccff', label: 'LANCE',
  },
  bomber: {
    hp: 62, speed: 182, dmg: 60, rate: 99, bulletSpeed: 0, range: 0,
    prefDist: 0, r: 18, score: 170, salvage: 24,
    body: '#c9302c', accent: '#ffb3a7', label: 'BOMBER',
  },
  boss: {
    hp: 1600, speed: 52, dmg: 38, rate: 1.0, bulletSpeed: 440, range: 820,
    prefDist: 460, r: 52, score: 2500, salvage: 220,
    body: '#4a4036', accent: '#ff7a1a', label: 'WARLORD',
  },
};

export interface Tank {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  angle: number;      // body facing (radians)
  turret: number;     // turret facing
  hp: number; maxHp: number;
  r: number;
  player: boolean;
  kind: EnemyKind | 'player';
  dmg: number;
  rate: number;
  bulletSpeed: number;
  range: number;
  speed: number;
  cd: number;
  hitFlash: number;
  dead: boolean;
  // ai
  aiTimer: number;
  strafe: number;
  goal: { x: number; y: number };
  losOk: boolean;
  losTimer: number;
  turretTurn: number;
  // fx
  trackDist: number;
  recoil: number;
  spawnPop: number;
  elite: boolean;
  tier: number;        // 1..10 livery tier (for colour), 0 = player chassis
  twin: boolean;       // renders twin cannons
  salvageValue: number;
  scoreValue: number;
}

export interface Bullet {
  active: boolean;
  x: number; y: number;
  px: number; py: number;
  vx: number; vy: number;
  r: number;
  dmg: number;
  life: number;
  owner: 'p' | 'e';
  pierce: number;
  hits: number;
  lastHit: number;
  kind: 'shell' | 'bolt' | 'bomb' | 'rail';
  hue: string;
  glow: string;
}

export type ParticleKind =
  | 'spark' | 'smoke' | 'debris' | 'ring' | 'flash'
  | 'casing' | 'text' | 'shard' | 'shock';

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  rot: number; vr: number;
  color: string;
  drag: number;
  grav: number;
  text?: string;
  hits: number;
}

export interface Obstacle {
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number;
  kind: 'rock' | 'crate' | 'block';
  seed: number;
}

export interface BaseData {
  x: number; y: number;
  w: number; h: number;
  hp: number; maxHp: number;
  cd: number;
  turret: number;
  hitFlash: number;
  alive: boolean;
  owner: 'p' | 'e';
  alarm: number;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
  max: number;
  cost: number;
  costMul: number;
  color: string;
  effect: (lvl: number) => string;
}

export type UpgradeId =
  | 'cannon' | 'loader' | 'multishot' | 'armor'
  | 'turbine' | 'pierce' | 'bulwark' | 'sentry' | 'drones';

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'cannon', name: 'Siege Cannon', icon: '◈', max: 8, cost: 45, costMul: 1.5,
    color: '#ffb347',
    desc: 'Shells hit harder and punch through armour.',
    effect: (l) => `+${l * 28}% damage`,
  },
  {
    id: 'loader', name: 'Auto Loader', icon: '⟳', max: 8, cost: 50, costMul: 1.5,
    color: '#ffd166',
    desc: 'Faster reload, tighter barrage.',
    effect: (l) => `+${Math.round((1 - 1 / (1 + 0.22 * l)) * 100)}% fire rate`,
  },
  {
    id: 'multishot', name: 'Split Barrel', icon: '⋔', max: 3, cost: 160, costMul: 1.85,
    color: '#ff8a3d',
    desc: 'Fire an extra shell in a spread per level.',
    effect: (l) => `${1 + l} shells / volley`,
  },
  {
    id: 'pierce', name: 'Sabot Core', icon: '→', max: 3, cost: 120, costMul: 1.9,
    color: '#9be7ff',
    desc: 'Shells keep flying through targets.',
    effect: (l) => `pierces ${l} extra`,
  },
  {
    id: 'armor', name: 'Reactive Plating', icon: '⬢', max: 8, cost: 55, costMul: 1.5,
    color: '#8de0a1',
    desc: 'More hull integrity, less damage taken.',
    effect: (l) => `+${l * 32} HP · ${Math.round(Math.min(0.5, l * 0.06) * 100)}% resist`,
  },
  {
    id: 'turbine', name: 'Turbo Turbine', icon: '≫', max: 6, cost: 50, costMul: 1.55,
    color: '#7ee0ff',
    desc: 'Faster treads, snappier handling.',
    effect: (l) => `+${l * 11}% speed`,
  },
  {
    id: 'bulwark', name: 'Base Bulwark', icon: '⛨', max: 8, cost: 70, costMul: 1.55,
    color: '#ff6f91',
    desc: 'Reinforce HQ and patch the damage.',
    effect: (l) => `+${l * 140} HQ HP · repairs 35%`,
  },
  {
    id: 'sentry', name: 'Sentry Turret', icon: '✦', max: 6, cost: 80, costMul: 1.6,
    color: '#c6a6ff',
    desc: 'Your HQ shoots back. Hard.',
    effect: (l) => `dmg +${l * 45}% · rate +${l * 18}%`,
  },
  {
    id: 'drones', name: 'Repair Drones', icon: '✚', max: 5, cost: 95, costMul: 1.65,
    color: '#a0f0c0',
    desc: 'Nanite swarm welds your hull mid-fight.',
    effect: (l) => `+${(l * 1.6).toFixed(1)} HP/s regen`,
  },
];

export const UPGRADE_MAP: Record<UpgradeId, UpgradeDef> = UPGRADES.reduce(
  (acc, u) => { acc[u.id] = u; return acc; },
  {} as Record<UpgradeId, UpgradeDef>,
);

export function upgradeCost(def: UpgradeDef, level: number) {
  return Math.round(def.cost * Math.pow(def.costMul, level));
}

export interface HudState {
  hp: number; maxHp: number;
  baseHp: number; baseMaxHp: number;
  eBaseHp: number; eBaseMaxHp: number;
  score: number; salvage: number; sector: number;
  tank: PlayerTankId;
  combo: number; comboPct: number;
  kills: number; time: number;
  boostPct: number;
  respawn: number;
  enemies: number;
  levels: Record<UpgradeId, number>;
  baseUnderAttack: boolean;
  playerDps: number;
}

export interface ScoreRow {
  score: number;
  sector: number;
  kills: number;
  date: string;
  name: string;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];
export function angleDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
