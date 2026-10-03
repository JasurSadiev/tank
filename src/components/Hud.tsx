import { PLAYER_TANK_MAP } from '../game/types';
import type { HudState } from '../game/types';
import type { Prefs } from '../game/storage';
import { Bar } from './ui';

export function Hud({
  hud, isTouch, onDepot, onPause, prefs, toggle,
}: {
  hud: HudState;
  isTouch: boolean;
  onDepot: () => void;
  onPause: () => void;
  prefs: Prefs;
  toggle: (k: keyof Prefs) => void;
}) {
  const hpPct = hud.maxHp > 0 ? hud.hp / hud.maxHp : 0;
  const minePct = hud.baseMaxHp ? hud.baseHp / hud.baseMaxHp : 0;
  const foePct = hud.eBaseMaxHp ? hud.eBaseHp / hud.eBaseMaxHp : 0;
  const mins = Math.floor(hud.time / 60);
  const secs = Math.floor(hud.time % 60);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-1.5 p-2 sm:p-3">
      {/* ---- top: bases + score ---- */}
      <div className="flex items-start gap-1.5 sm:gap-3">
        <BaseBar
          pct={minePct}
          label="YOUR HQ"
          value={Math.ceil(hud.baseHp)}
          color="#7ee08a"
          flip
          alarm={hud.baseUnderAttack}
        />
        <div
          className="flex min-w-[7.5rem] flex-col items-center border border-amber-300/20 bg-[#0d1420]/85 px-3 py-1.5 backdrop-blur-sm sm:min-w-[11rem]"
          style={{ clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' }}
        >
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[9px] tracking-[0.3em] text-amber-100/40">SCORE</span>
            {hud.combo > 1 && (
              <span className="animate-pulse font-display text-[11px] font-bold text-cyan-300">x{hud.combo}</span>
            )}
          </div>
          <div className="font-display text-xl font-black tabular-nums leading-none text-amber-100 sm:text-2xl">
            {hud.score.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-2 font-display text-[9px] tracking-widest text-amber-100/50">
            <span className="text-amber-300">LEVEL {hud.sector}</span>
            <span>·</span>
            <span>{hud.kills} KILLS</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline tabular-nums">{mins}:{String(secs).padStart(2, '0')}</span>
          </div>
          {hud.combo > 1 && (
            <div className="mt-1 h-[3px] w-full bg-black/50">
              <div className="h-full bg-cyan-400" style={{ width: `${hud.comboPct * 100}%` }} />
            </div>
          )}
        </div>
        <BaseBar
          pct={foePct}
          label="ENEMY HQ"
          value={Math.ceil(hud.eBaseHp)}
          color="#ff5f6d"
        />
      </div>

      {/* ---- hull + salvage ---- */}
      <div className="flex items-center gap-2">
        <div
          className="hidden items-center gap-1.5 border px-2 py-0.5 sm:flex"
          style={{
            borderColor: `${PLAYER_TANK_MAP[hud.tank].accent}44`,
            background: `${PLAYER_TANK_MAP[hud.tank].accent}12`,
          }}
        >
          <span
            className="h-2 w-2 rotate-45"
            style={{ background: PLAYER_TANK_MAP[hud.tank].accent }}
          />
          <span
            className="font-display text-[10px] font-bold tracking-widest"
            style={{ color: PLAYER_TANK_MAP[hud.tank].accent }}
          >
            {PLAYER_TANK_MAP[hud.tank].name}
          </span>
        </div>
        <div className="flex w-32 items-center gap-1.5 sm:w-48">
          <span className="font-display text-[9px] tracking-widest text-amber-100/50">HULL</span>
          <div className="flex-1">
            <Bar pct={hpPct} height="h-2"
              color={hpPct > 0.5 ? '#7ee08a' : hpPct > 0.25 ? '#ffd166' : '#ff5f6d'} />
          </div>
        </div>
        <div className="flex items-center gap-1 border border-amber-300/25 bg-amber-400/10 px-2 py-0.5">
          <span className="text-[11px]">⚙</span>
          <span className="font-display text-xs font-bold tabular-nums text-amber-200">{hud.salvage}</span>
          <span className="hidden font-display text-[8px] tracking-widest text-amber-100/40 sm:inline">SALVAGE</span>
        </div>
        {!isTouch && (
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[9px] tracking-widest text-cyan-100/50">BOOST</span>
            <div className="w-16">
              <Bar pct={hud.boostPct} height="h-2" color="#8be9ff" />
            </div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 pointer-events-auto">
          <IconBtn onClick={onDepot} title="Field Depot (Tab)">▲</IconBtn>
          <IconBtn onClick={onPause} title="Pause (Esc)">❚❚</IconBtn>
          <IconBtn active={prefs.autoFire} onClick={() => toggle('autoFire')} title="Auto-fire">✦</IconBtn>
          <IconBtn active={prefs.sfx} onClick={() => toggle('sfx')} title="Sound">♪</IconBtn>
          <IconBtn active={prefs.music} onClick={() => toggle('music')} title="Music">♫</IconBtn>
        </div>
      </div>

      {/* ---- enemy counter ---- */}
      <div className="flex justify-center">
        <div className="flex items-center gap-2 border border-rose-400/20 bg-rose-500/10 px-2.5 py-0.5 font-display text-[10px] tracking-widest text-rose-200/80">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />
          {hud.enemies} HOSTILES · DPS {Math.round(hud.playerDps)}
        </div>
      </div>
    </div>
  );
}

function BaseBar({
  pct, label, value, color, flip, alarm,
}: {
  pct: number; label: string; value: number; color: string; flip?: boolean; alarm?: boolean;
}) {
  return (
    <div className={`flex-1 ${flip ? '' : ''}`}>
      <div className={`mb-1 flex items-center gap-2 ${flip ? 'flex-row-reverse' : ''}`}>
        <span className="font-display text-[9px] tracking-[0.2em] text-amber-100/45">{label}</span>
        <span className="font-display text-[11px] font-bold tabular-nums" style={{ color }}>{value}</span>
        {alarm && <span className="animate-pulse font-display text-[9px] text-rose-300">⚠ UNDER ATTACK</span>}
      </div>
      <Bar pct={pct} color={color} height="h-3" />
    </div>
  );
}

function IconBtn({
  children, onClick, active = true, title,
}: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center border text-[11px] transition-colors active:scale-95 ${
        active
          ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
          : 'border-white/10 bg-white/5 text-white/25'
      }`}
      style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}
    >
      {children}
    </button>
  );
}
