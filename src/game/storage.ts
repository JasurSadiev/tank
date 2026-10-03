import type { PlayerTankId, ScoreRow } from './types';

const KEY = 'iron-vanguard-scores-v1';
const PREFS = 'iron-vanguard-prefs-v1';
const GARAGE = 'iron-vanguard-garage-v1';

export interface GarageData {
  coins: number;
  owned: PlayerTankId[];
  selected: PlayerTankId;
}

const DEFAULT_GARAGE: GarageData = { coins: 0, owned: ['ranger'], selected: 'ranger' };

export function loadGarage(): GarageData {
  try {
    const saved = JSON.parse(localStorage.getItem(GARAGE) || 'null') as Partial<GarageData> | null;
    if (!saved) return { ...DEFAULT_GARAGE, owned: [...DEFAULT_GARAGE.owned] };
    const owned: PlayerTankId[] = Array.isArray(saved.owned) ? saved.owned : ['ranger'];
    if (!owned.includes('ranger')) owned.unshift('ranger');
    const selected = saved.selected && owned.includes(saved.selected) ? saved.selected : 'ranger';
    return { coins: Math.max(0, Math.floor(saved.coins || 0)), owned, selected };
  } catch {
    return { ...DEFAULT_GARAGE, owned: [...DEFAULT_GARAGE.owned] };
  }
}

export function saveGarage(data: GarageData) {
  try {
    localStorage.setItem(GARAGE, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function loadScores(): ScoreRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r.score === 'number')
      .slice(0, 10)
      .sort((a: ScoreRow, b: ScoreRow) => b.score - a.score);
  } catch {
    return [];
  }
}

export function saveScore(row: ScoreRow): { list: ScoreRow[]; rank: number } {
  const list = loadScores();
  list.push(row);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  const rank = trimmed.findIndex((r) => r === row);
  return { list: trimmed, rank };
}

export function writeScores(list: ScoreRow[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10)));
  } catch {
    /* ignore */
  }
}

export function bestScore(): number {
  const l = loadScores();
  return l.length ? l[0].score : 0;
}

const NAME_KEY = 'iron-vanguard-name-v1';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'COMMANDER';
  } catch {
    return 'COMMANDER';
  }
}

export function saveName(n: string) {
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* ignore */
  }
}

export interface Prefs {
  sfx: boolean;
  music: boolean;
  autoFire: boolean;
  shake: boolean;
}

export const DEFAULT_PREFS: Prefs = { sfx: true, music: true, autoFire: true, shake: true };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
