import type { ReactNode } from 'react';
import type { ScoreRow } from '../game/types';

export function Panel({
  children, className = '', glow = false,
}: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div
      className={`relative border border-amber-300/15 bg-[#0d1420]/85 backdrop-blur-sm
        ${glow ? 'shadow-[0_0_28px_-8px_rgba(255,190,90,0.35)]' : 'shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]'}
        ${className}`}
      style={{ clipPath: 'polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px)' }}
    >
      {children}
    </div>
  );
}

export function Btn({
  children, onClick, variant = 'ghost', className = '', disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
}) {
  const base = 'select-none font-display tracking-widest uppercase transition-all duration-150 active:scale-[0.97]';
  const styles = {
    primary: 'bg-gradient-to-b from-amber-400 to-orange-600 text-[#1a1206] border-amber-200/60 shadow-[0_6px_24px_-6px_rgba(255,170,60,0.75)] hover:brightness-110',
    ghost: 'bg-white/5 text-amber-100/80 border-amber-200/20 hover:bg-white/10 hover:text-amber-50',
    danger: 'bg-gradient-to-b from-rose-500 to-rose-700 text-white border-rose-300/40 hover:brightness-110',
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${disabled ? 'opacity-40 saturate-50 pointer-events-none' : ''} ${className}`}
      style={{ clipPath: 'polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)' }}
    >
      {children}
    </button>
  );
}

export function Stat({ label, value, accent = '#ffd166' }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="text-[9px] tracking-[0.2em] text-amber-100/40 font-display">{label}</span>
      <span className="font-display text-lg font-bold tabular-nums" style={{ color: accent }}>{value}</span>
    </div>
  );
}

export function Bar({
  pct, color, className = '', height = 'h-2.5',
}: { pct: number; color: string; className?: string; height?: string }) {
  return (
    <div className={`relative w-full ${height} overflow-hidden bg-black/60 ring-1 ring-white/10 ${className}`}
      style={{ clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' }}>
      <div
        className="h-full transition-[width] duration-200 ease-out"
        style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: color }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: 'repeating-linear-gradient(90deg,rgba(0,0,0,.55) 0 2px,transparent 2px 8px)' }} />
    </div>
  );
}

export function HighScores({ list, highlight }: { list: ScoreRow[]; highlight?: number }) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-300/30" />
        <span className="font-display text-[10px] tracking-[0.35em] text-amber-200/60">TOP COMMANDERS</span>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-300/30" />
      </div>
      {list.length === 0 ? (
        <p className="py-4 text-center font-display text-xs tracking-widest text-amber-100/30">
          NO RECORDS — BE THE FIRST
        </p>
      ) : (
        <ol className="space-y-1">
          {list.map((r, i) => (
            <li
              key={`${r.score}-${i}-${r.date}`}
              className={`grid grid-cols-[1.6rem_1fr_auto_auto] items-center gap-2 px-2 py-1 font-display text-xs tabular-nums
                ${i === highlight ? 'bg-amber-400/20 text-amber-100 ring-1 ring-amber-300/40' : 'text-amber-100/60'}`}
            >
              <span className={i === 0 ? 'text-amber-300' : 'text-amber-100/30'}>{String(i + 1).padStart(2, '0')}</span>
              <span className="truncate tracking-wider">{r.name || 'ANON'}</span>
              <span className="text-amber-100/40">L{r.sector}</span>
              <span className="font-bold">{r.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.7rem] items-center justify-center rounded border border-amber-200/25 bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-amber-100/80">
      {children}
    </kbd>
  );
}
