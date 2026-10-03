import { useEffect, useState } from 'react';
import { PLAYER_TANKS, PLAYER_TANK_MAP, UPGRADES, levelReward, upgradeCost } from '../game/types';
import type { HudState, PlayerTankId, ScoreRow, UpgradeId } from '../game/types';
import type { GarageData, Prefs } from '../game/storage';
import { Btn, HighScores, KeyCap, Panel } from './ui';

// ---------------------------------------------------------------------------
export function StartScreen({
  onStart, onGarage, scores, isTouch, prefs, toggle, garage,
}: {
  onStart: () => void;
  onGarage: () => void;
  scores: ScoreRow[];
  isTouch: boolean;
  prefs: Prefs;
  toggle: (k: keyof Prefs) => void;
  garage: GarageData;
}) {
  const best = scores.length ? scores[0].score : 0;
  return (
    <Shell>
      <div className="flex w-full max-w-3xl flex-col items-center gap-5 px-4">
        <div className="text-center">
          <div className="font-display text-[10px] tracking-[0.6em] text-amber-200/50">ARMOUR COMMAND · LEVEL WARFARE</div>
          <h1 className="relative font-display text-5xl font-black leading-none tracking-tight text-transparent sm:text-7xl"
            style={{ WebkitTextStroke: '1px rgba(255,209,102,0.35)' }}>
            <span className="bg-gradient-to-b from-amber-200 via-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(255,170,60,0.35)]">
              IRON VANGUARD
            </span>
          </h1>
          <p className="mt-2 max-w-lg font-display text-[11px] tracking-[0.18em] text-amber-100/50">
            DESTROY THE CRIMSON HQ BEFORE THEY FLATTEN YOURS.
            SALVAGE WRECKS · UPGRADE YOUR TANK · SURVIVE THE ESCALATION.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2">
          <Panel className="p-4">
            <h3 className="mb-3 font-display text-[10px] tracking-[0.3em] text-amber-200/60">
              {isTouch ? 'TOUCH CONTROLS' : 'KEYBOARD + MOUSE'}
            </h3>
            {isTouch ? (
              <ul className="space-y-2 font-display text-[11px] tracking-wider text-amber-100/70">
                <li><b className="text-cyan-300">LEFT SIDE</b> drag — drive the tank</li>
                <li><b className="text-amber-300">RIGHT SIDE</b> drag — aim turret (push far to fire)</li>
                <li><b className="text-cyan-200">BOOST</b> button — dash out of trouble</li>
                <li>Auto-fire is on by default — just aim</li>
              </ul>
            ) : (
              <ul className="space-y-2 font-display text-[11px] tracking-wider text-amber-100/70">
                <li><KeyCap>↑</KeyCap><KeyCap>←</KeyCap><KeyCap>↓</KeyCap><KeyCap>→</KeyCap> drive the tank</li>
                <li><span className="text-amber-100/40">or</span> <KeyCap>W</KeyCap><KeyCap>A</KeyCap><KeyCap>S</KeyCap><KeyCap>D</KeyCap></li>
                <li><b className="text-amber-300">MOUSE</b> aim · <KeyCap>LMB</KeyCap>/<KeyCap>SPACE</KeyCap> fire</li>
                <li><KeyCap>SHIFT</KeyCap> boost dash</li>
                <li><KeyCap>TAB</KeyCap> depot · <KeyCap>ESC</KeyCap> pause</li>
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Toggle on={prefs.autoFire} onClick={() => toggle('autoFire')}>AUTO-FIRE</Toggle>
              <Toggle on={prefs.sfx} onClick={() => toggle('sfx')}>SFX</Toggle>
              <Toggle on={prefs.music} onClick={() => toggle('music')}>MUSIC</Toggle>
              <Toggle on={prefs.shake} onClick={() => toggle('shake')}>SHAKE</Toggle>
            </div>
          </Panel>

          <Panel className="p-4">
            <HighScores list={scores} />
            <div className="mt-3 border-t border-amber-300/10 pt-3 text-center font-display text-[10px] tracking-[0.25em] text-amber-100/40">
              PERSONAL BEST <span className="text-amber-300">{best.toLocaleString()}</span>
            </div>
          </Panel>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Btn variant="primary" onClick={onStart} className="px-12 py-4 text-lg">
            ▶ START LEVEL 1
          </Btn>
          <Btn onClick={onGarage} className="px-7 py-4 text-sm">
            GARAGE · {garage.coins} COINS
          </Btn>
        </div>
        <div
          className="flex items-center gap-2 border px-3 py-1.5"
          style={{
            borderColor: `${PLAYER_TANK_MAP[garage.selected].accent}44`,
            background: `${PLAYER_TANK_MAP[garage.selected].accent}10`,
          }}
        >
          <span className="font-display text-[9px] tracking-[0.25em] text-amber-100/40">
            DEPLOYING
          </span>
          <span className="h-2 w-2 rotate-45" style={{ background: PLAYER_TANK_MAP[garage.selected].accent }} />
          <span
            className="font-display text-xs font-bold tracking-widest"
            style={{ color: PLAYER_TANK_MAP[garage.selected].accent }}
          >
            {PLAYER_TANK_MAP[garage.selected].name}
          </span>
          <span className="font-display text-[9px] tracking-[0.2em] text-amber-100/30">
            {PLAYER_TANK_MAP[garage.selected].role}
          </span>
        </div>
        <div className="font-display text-[10px] tracking-[0.3em] text-amber-100/30">
          {isTouch ? 'TAP DEPLOY TO START' : 'PRESS ENTER TO START'}
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
export function GarageScreen({
  garage, onSelect, onBack,
}: {
  garage: GarageData;
  onSelect: (id: PlayerTankId) => void;
  onBack: () => void;
}) {
  return (
    <Shell>
      <div className="flex max-h-[94vh] w-[min(95vw,62rem)] flex-col gap-4 px-3 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-display text-[10px] tracking-[0.45em] text-amber-200/50">PERMANENT TANK SHOP</div>
            <h2 className="font-display text-3xl font-black tracking-widest text-amber-100 sm:text-4xl">THE GARAGE</h2>
            <p className="font-display text-[10px] tracking-[0.18em] text-amber-100/40">
              WIN LEVELS TO EARN COINS. OWNED TANKS STAY UNLOCKED.
            </p>
          </div>
          <div className="border border-amber-300/30 bg-amber-400/10 px-4 py-2 text-right">
            <div className="font-display text-[9px] tracking-[0.2em] text-amber-100/50">BALANCE</div>
            <div className="font-display text-2xl font-black tabular-nums text-amber-200">{garage.coins} COINS</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          {PLAYER_TANKS.map((tank) => {
            const owned = garage.owned.includes(tank.id);
            const selected = garage.selected === tank.id;
            const afford = garage.coins >= tank.cost;
            return (
              <button
                key={tank.id}
                onClick={() => onSelect(tank.id)}
                className={`group relative grid grid-cols-[5.5rem_1fr] gap-4 border p-4 text-left transition-all active:scale-[0.985] ${
                  selected
                    ? 'border-amber-300/80 bg-amber-400/12 shadow-[0_0_30px_-12px_rgba(255,190,80,0.8)]'
                    : owned || afford
                      ? 'border-amber-300/20 bg-[#111b2b]/90 hover:border-amber-300/55'
                      : 'border-white/10 bg-[#0d1420]/90 opacity-60'
                }`}
                style={{ clipPath: 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)' }}
              >
                <div className="relative flex h-20 items-center justify-center">
                  <div className="absolute h-12 w-20 rounded-full opacity-30 blur-xl" style={{ background: tank.accent }} />
                  <div className="relative h-11 w-[4.6rem] rounded-md border-4 border-[#1d232d]" style={{ background: tank.body }}>
                    <div className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/40" style={{ background: tank.accent }} />
                    {(tank.bonusShots ?? 0) > 0 ? (
                      <>
                        <div className="absolute left-1/2 top-[22%] h-[3px] w-[3.4rem] -translate-x-[26%] bg-[#222934]" />
                        <div className="absolute left-1/2 top-[62%] h-[3px] w-[3.4rem] -translate-x-[26%] bg-[#222934]" />
                        <div className="absolute right-[-2px] top-[14%] h-[7px] w-[6px]" style={{ background: tank.accent }} />
                        <div className="absolute right-[-2px] top-[54%] h-[7px] w-[6px]" style={{ background: tank.accent }} />
                        <div className="absolute left-[-4px] top-1/3 h-[6px] w-[7px] -translate-y-1/2 rotate-45" style={{ background: tank.accent }} />
                      </>
                    ) : (
                      <div className="absolute left-1/2 top-1/2 h-2 w-12 -translate-y-1/2 bg-[#2c3441]" />
                    )}
                    <div className="absolute -top-2 left-1 h-2 w-14 bg-[#1d232d]" />
                    <div className="absolute -bottom-2 left-1 h-2 w-14 bg-[#1d232d]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-display text-base font-black tracking-widest text-amber-50">{tank.name}</div>
                      <div className="font-display text-[9px] tracking-[0.3em]" style={{ color: tank.accent }}>{tank.role}</div>
                    </div>
                    <span className={`font-display text-xs font-bold ${selected ? 'text-emerald-300' : owned ? 'text-cyan-200' : afford ? 'text-amber-200' : 'text-rose-300'}`}>
                      {selected ? 'SELECTED' : owned ? 'SELECT' : `${tank.cost} COINS`}
                    </span>
                  </div>
                  <p className="mt-1 font-display text-[10px] tracking-wider text-amber-100/45">{tank.description}</p>
                  <div className="mt-3 grid grid-cols-4 gap-1 font-display text-[9px] text-amber-100/45">
                    <TankStat label="HP" value={tank.hp} />
                    <TankStat label="DMG" value={tank.damage} />
                    <TankStat label="RATE" value={(1 / tank.rate).toFixed(1)} />
                    <TankStat label="SPEED" value={tank.speed} />
                  </div>
                  {(tank.bonusShots || tank.bonusPierce) ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {!!tank.bonusShots && (
                        <Perk color={tank.accent}>⋔ TWIN CANNONS · {1 + tank.bonusShots} SHELLS</Perk>
                      )}
                      {!!tank.bonusPierce && (
                        <Perk color={tank.accent}>→ PIERCES {tank.bonusPierce} EXTRA</Perk>
                      )}
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Btn variant="primary" onClick={onBack} className="px-10 py-3">BACK TO COMMAND</Btn>
        </div>
      </div>
    </Shell>
  );
}

function Perk({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="border px-1.5 py-0.5 font-display text-[8px] tracking-[0.18em]"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {children}
    </span>
  );
}

function TankStat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="border-l border-amber-300/15 pl-1">
      <b className="block text-amber-100/25">{label}</b>
      <b className="text-amber-100/80">{value}</b>
    </span>
  );
}

// ---------------------------------------------------------------------------
export function PauseScreen({
  onResume, onRestart, onQuit, isTouch, prefs, toggle,
}: {
  onResume: () => void; onRestart: () => void; onQuit: () => void;
  isTouch: boolean; prefs: Prefs; toggle: (k: keyof Prefs) => void;
}) {
  return (
    <Shell dim>
      <Panel className="w-[min(92vw,26rem)] p-6" glow>
        <h2 className="text-center font-display text-3xl font-black tracking-widest text-amber-100">PAUSED</h2>
        <div className="mt-1 mb-5 text-center font-display text-[10px] tracking-[0.3em] text-amber-100/40">
          SYSTEMS ON STANDBY
        </div>
        <div className="flex flex-col gap-2">
          <Btn variant="primary" onClick={onResume} className="py-3">▶ RESUME</Btn>
          <Btn onClick={onRestart} className="py-2.5">⟳ RESTART RUN</Btn>
          <Btn variant="danger" onClick={onQuit} className="py-2.5">✕ ABANDON</Btn>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Toggle on={prefs.autoFire} onClick={() => toggle('autoFire')}>AUTO-FIRE</Toggle>
          <Toggle on={prefs.sfx} onClick={() => toggle('sfx')}>SFX</Toggle>
          <Toggle on={prefs.music} onClick={() => toggle('music')}>MUSIC</Toggle>
          <Toggle on={prefs.shake} onClick={() => toggle('shake')}>SHAKE</Toggle>
        </div>
        {!isTouch && (
          <p className="mt-4 text-center font-display text-[10px] tracking-[0.25em] text-amber-100/30">
            <KeyCap>ESC</KeyCap> RESUME · <KeyCap>TAB</KeyCap> DEPOT
          </p>
        )}
      </Panel>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
export function DepotScreen({
  hud, onBuy, onDeploy, isSectorClear,
}: {
  hud: HudState;
  onBuy: (id: UpgradeId) => void;
  onDeploy: () => void;
  isSectorClear: boolean;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const n = parseInt(e.key, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= UPGRADES.length) {
        const u = UPGRADES[n - 1];
        onBuy(u.id);
        setFlash(u.id);
      }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDeploy(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onBuy, onDeploy]);

  return (
    <Shell dim>
      <div className="flex max-h-[94vh] w-[min(96vw,64rem)] flex-col gap-3 px-2 py-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="font-display text-2xl font-black tracking-widest text-amber-100 sm:text-3xl">
              {isSectorClear ? `LEVEL ${hud.sector} COMPLETE` : 'FIELD DEPOT'}
            </h2>
            <p className="font-display text-[10px] tracking-[0.25em] text-amber-100/40">
              {isSectorClear
                ? `+${levelReward(hud.sector)} GARAGE COINS BANKED · NEXT LEVEL IS STRONGER`
                : 'SPEND SALVAGE · TANK REMAINS VULNERABLE'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-right">
              <div className="font-display text-[9px] tracking-[0.2em] text-amber-100/50">SALVAGE</div>
              <div className="font-display text-xl font-black tabular-nums text-amber-200">{hud.salvage}</div>
            </div>
            <Btn variant="primary" onClick={onDeploy} className="px-6 py-3">
              {isSectorClear ? `START LEVEL ${hud.sector + 1} ▶` : '◀ RETURN TO BATTLE'}
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
          {UPGRADES.map((u, i) => {
            const lvl = hud.levels[u.id] ?? 0;
            const maxed = lvl >= u.max;
            const cost = upgradeCost(u, lvl);
            const afford = !maxed && hud.salvage >= cost;
            return (
              <button
                key={u.id}
                onClick={() => { onBuy(u.id); setFlash(u.id); }}
                disabled={maxed}
                className={`group relative flex flex-col gap-1.5 border p-3 text-left transition-all duration-150 active:scale-[0.98]
                  ${maxed
                    ? 'border-emerald-400/25 bg-emerald-500/5'
                    : afford
                      ? 'border-amber-300/30 bg-[#131c2b]/90 hover:border-amber-300/70 hover:bg-[#1a2740]'
                      : 'border-white/10 bg-[#0f1622]/80 opacity-60'}
                  ${flash === u.id ? 'ring-2 ring-amber-300/70' : ''}`}
                style={{ clipPath: 'polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center border text-base"
                      style={{ color: u.color, borderColor: `${u.color}55`, background: `${u.color}18` }}>
                      {u.icon}
                    </span>
                    <div>
                      <div className="font-display text-xs font-bold tracking-widest text-amber-50">{u.name}</div>
                      <div className="font-display text-[9px] tracking-wider text-amber-100/40">{u.desc}</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-amber-100/25">{i + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: u.max }).map((_, k) => (
                    <span key={k} className="h-1.5 flex-1"
                      style={{ background: k < lvl ? u.color : 'rgba(255,255,255,0.09)' }} />
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-[10px] tracking-wider" style={{ color: u.color }}>
                    {lvl > 0 ? u.effect(lvl) : 'NOT INSTALLED'}
                  </span>
                  <span className={`font-display text-xs font-bold tabular-nums ${maxed ? 'text-emerald-300' : afford ? 'text-amber-200' : 'text-rose-300/70'}`}>
                    {maxed ? 'MAX' : `⚙ ${cost}`}
                  </span>
                </div>
                {!maxed && lvl > 0 && (
                  <span className="font-display text-[9px] tracking-wider text-amber-100/30">
                    NEXT: {u.effect(lvl + 1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
export function GameOverScreen({
  hud, scores, rank, initials, setInitials, onRestart, onMenu, onGarage,
  victory, coinsEarned, coins,
}: {
  hud: HudState;
  scores: ScoreRow[];
  rank: number;
  initials: string;
  setInitials: (v: string) => void;
  onRestart: () => void;
  onMenu: () => void;
  onGarage: () => void;
  victory: boolean;
  coinsEarned: number;
  coins: number;
}) {
  const [saved, setSaved] = useState(rank >= 0);
  useEffect(() => { setSaved(rank >= 0); }, [rank]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') onRestart();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onRestart]);

  const mins = Math.floor(hud.time / 60);
  const secs = Math.floor(hud.time % 60);

  return (
    <Shell dim>
      <div className="flex w-[min(94vw,44rem)] flex-col items-center gap-4 px-3">
        <div className="text-center">
          <div className="font-display text-[10px] tracking-[0.5em] text-rose-300/60">
            {victory ? 'CAMPAIGN COLLAPSED' : 'HEADQUARTERS DESTROYED'}
          </div>
          <h2 className="font-display text-4xl font-black tracking-tight text-rose-400 sm:text-5xl drop-shadow-[0_0_20px_rgba(255,60,80,0.4)]">
            RUN OVER
          </h2>
        </div>

        <Panel className="w-full p-4" glow>
          <div className="grid grid-cols-4 gap-2 text-center">
            <Summary label="SCORE" value={hud.score.toLocaleString()} accent="#ffd166" big />
            <Summary label="LEVEL" value={hud.sector} accent="#8be9ff" />
            <Summary label="KILLS" value={hud.kills} accent="#ff8fa0" />
            <Summary label="TIME" value={`${mins}:${String(secs).padStart(2, '0')}`} accent="#a0f0c0" />
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 border-t border-amber-300/10 pt-3">
            <span className="font-display text-[10px] tracking-[0.25em] text-amber-100/45">
              COINS EARNED
            </span>
            <span className="font-display text-base font-black tabular-nums text-amber-300">
              +{coinsEarned}
            </span>
            <span className="text-amber-100/25">·</span>
            <span className="font-display text-[10px] tracking-[0.25em] text-amber-100/45">
              BALANCE
            </span>
            <span className="font-display text-base font-black tabular-nums text-amber-200">
              {coins}
            </span>
          </div>

          {!saved ? (
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="font-display text-[10px] tracking-[0.25em] text-amber-100/50">CALLSIGN</span>
              <input
                value={initials}
                maxLength={8}
                onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''))}
                className="w-32 border border-amber-300/30 bg-black/50 px-2 py-1 text-center font-display text-lg tracking-[0.3em] text-amber-100 outline-none focus:border-amber-300/70"
              />
              <Btn variant="primary" onClick={() => setSaved(true)} className="px-4 py-2 text-xs">
                SAVE SCORE
              </Btn>
            </div>
          ) : (
            <div className="mt-4 text-center font-display text-[10px] tracking-[0.3em] text-emerald-300/80">
              {rank >= 0 ? `RECORDED — RANK #${rank + 1}` : 'SCORE LOGGED'}
            </div>
          )}
        </Panel>

        <Panel className="w-full p-4">
          <HighScores list={scores} highlight={rank >= 0 ? rank : undefined} />
        </Panel>

        <div className="flex flex-wrap justify-center gap-3">
          <Btn variant="primary" onClick={onRestart} className="px-8 py-3">⟳ REDEPLOY</Btn>
          <Btn onClick={onGarage} className="px-6 py-3">⚙ GARAGE · {coins}</Btn>
          <Btn onClick={onMenu} className="px-6 py-3">MAIN MENU</Btn>
        </div>
        <div className="font-display text-[10px] tracking-[0.3em] text-amber-100/25">PRESS ENTER TO RESTART</div>
      </div>
    </Shell>
  );
}

function Summary({ label, value, accent, big }: { label: string; value: string | number; accent: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-[9px] tracking-[0.25em] text-amber-100/40">{label}</span>
      <span className={`font-display font-black tabular-nums ${big ? 'text-2xl sm:text-3xl' : 'text-xl'}`} style={{ color: accent }}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border px-2.5 py-1 font-display text-[9px] tracking-[0.2em] transition-colors active:scale-95 ${
        on ? 'border-amber-300/50 bg-amber-400/15 text-amber-100' : 'border-white/10 bg-white/5 text-white/30'
      }`}
    >
      {children}
    </button>
  );
}

function Shell({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div className={`absolute inset-0 z-30 flex items-center justify-center overflow-hidden ${
      dim
        ? 'bg-[#060a12]/80 backdrop-blur-[3px]'
        : 'bg-[radial-gradient(ellipse_at_center,rgba(24,38,62,0.86)_0%,rgba(6,10,18,0.96)_72%)] backdrop-blur-[2px]'
    }`}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 4px)' }} />
      <div className="relative max-h-full w-full overflow-y-auto py-4">
        <div className="flex justify-center">{children}</div>
      </div>
    </div>
  );
}
