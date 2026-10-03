import { useEffect, useRef, useState } from 'react';

interface StickProps {
  side: 'left' | 'right';
  label: string;
  color: string;
  fireThreshold: number;
  onOutput: (x: number, y: number, fire: boolean) => void;
}

const RADIUS = 60;

function Stick({ side, label, color, fireThreshold, onOutput }: StickProps) {
  const [st, setSt] = useState({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
  const idRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });

  const emit = (dx: number, dy: number) => {
    const nx = dx / RADIUS, ny = dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    const dead = 0.16;
    if (mag < dead) { onOutput(0, 0, false); return; }
    const k = (mag - dead) / (1 - dead) / mag;
    onOutput(nx * k, ny * k, mag > fireThreshold);
  };

  const start = (e: React.PointerEvent) => {
    if (idRef.current !== null) return;
    idRef.current = e.pointerId;
    originRef.current = { x: e.clientX, y: e.clientY };
    setSt({ active: true, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    onOutput(0, 0, false);
  };
  const move = (e: React.PointerEvent) => {
    if (idRef.current !== e.pointerId) return;
    let dx = e.clientX - originRef.current.x;
    let dy = e.clientY - originRef.current.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
    setSt((s) => ({ ...s, x: dx, y: dy }));
    emit(dx, dy);
  };
  const end = (e: React.PointerEvent) => {
    if (idRef.current !== e.pointerId) return;
    idRef.current = null;
    setSt({ active: false, ox: 0, oy: 0, x: 0, y: 0 });
    onOutput(0, 0, false);
  };

  return (
    <div
      className={`pointer-events-auto absolute bottom-0 ${side === 'left' ? 'left-0' : 'right-0'} h-[46%] w-1/2 touch-none`}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className={`absolute bottom-7 ${side === 'left' ? 'left-7' : 'right-7'} h-[104px] w-[104px] rounded-full border border-dashed transition-opacity duration-300 ${st.active ? 'opacity-0' : 'opacity-25'}`}
        style={{ borderColor: color }}
      />
      <span
        className={`absolute bottom-[5.9rem] font-display text-[9px] tracking-[0.25em] transition-opacity ${st.active ? 'opacity-0' : 'opacity-40'}`}
        style={{ color, ...(side === 'left' ? { left: '2rem' } : { right: '2rem' }) }}
      >
        {label}
      </span>
      {st.active && (
        <>
          <div
            className="absolute h-[120px] w-[120px] rounded-full border-2"
            style={{
              left: st.ox - 60, top: st.oy - 60, borderColor: color,
              background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute h-14 w-14 rounded-full border-2"
            style={{
              left: st.ox - 28 + st.x, top: st.oy - 28 + st.y,
              borderColor: color, background: `${color}44`,
              boxShadow: `0 0 26px ${color}66`,
            }}
          />
        </>
      )}
    </div>
  );
}

export function TouchControls({
  onMove, onAim, onBoost, boostPct, autoFire,
}: {
  onMove: (x: number, y: number) => void;
  onAim: (x: number, y: number, fire: boolean) => void;
  onBoost: () => void;
  boostPct: number;
  autoFire: boolean;
}) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const upd = () => setWide(window.innerWidth > 780);
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none">
      <Stick side="left" label="MOVE" color="#8be9ff" fireThreshold={9} onOutput={onMove} />
      <Stick
        side="right"
        label={autoFire ? 'AIM' : 'AIM+FIRE'}
        color="#ffd166"
        fireThreshold={0.34}
        onOutput={onAim}
      />

      <button
        className={`pointer-events-auto absolute bottom-6 ${wide ? 'right-[15rem]' : 'right-[8.2rem]'} flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-cyan-200/40 bg-cyan-400/10 font-display text-[9px] tracking-widest text-cyan-100 active:scale-95`}
        style={{
          opacity: boostPct >= 1 ? 1 : 0.45,
          boxShadow: boostPct >= 1 ? '0 0 22px rgba(139,233,255,0.35)' : 'none',
        }}
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onBoost(); }}
      >
        <span className="text-lg leading-none">≫</span>
        <span>BOOST</span>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(139,233,255,0.9)" strokeWidth="3"
            strokeDasharray={`${Math.max(0, Math.min(1, boostPct)) * 182} 182`} />
        </svg>
      </button>
    </div>
  );
}
