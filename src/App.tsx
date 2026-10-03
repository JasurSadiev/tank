import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/engine';
import type { GameEvent } from './game/engine';
import { audio } from './game/audio';
import {
  loadGarage, loadPrefs, loadScores, saveGarage, savePrefs, saveScore, writeScores,
  loadName, saveName,
} from './game/storage';
import type { GarageData, Prefs } from './game/storage';
import { Hud } from './components/Hud';
import { TouchControls } from './components/TouchControls';
import {
  StartScreen, PauseScreen, DepotScreen, GameOverScreen, GarageScreen,
} from './components/Screens';
import { PLAYER_TANK_MAP, levelReward, defeatReward } from './game/types';
import type { HudState, PlayerTankId, ScoreRow, UpgradeId } from './game/types';

type Screen = 'menu' | 'garage' | 'play' | 'paused' | 'depot' | 'over';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  const [depotMode, setDepotMode] = useState<'shop' | 'sector'>('shop');
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [rank, setRank] = useState(-1);
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [garage, setGarage] = useState<GarageData>(() => loadGarage());
  const [initials, setInitials] = useState<string>(() => loadName());
  const [isTouch, setIsTouch] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const savedRow = useRef<ScoreRow | null>(null);
  const initialsRef = useRef(initials);
  const garageRef = useRef(garage);
  initialsRef.current = initials;
  garageRef.current = garage;

  const setScr = useCallback((s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  }, []);

  // ---- create engine ------------------------------------------------------
  useEffect(() => {
    setIsTouch(
      typeof window !== 'undefined'
        && (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window),
    );
    setScores(loadScores());
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, {
      onHud: setHud,
      onEvent: (e: GameEvent) => {
        if (e === 'start') { setScr('play'); return; }
        if (e === 'sectorClear') {
          const next = {
            ...garageRef.current,
            coins: garageRef.current.coins + levelReward(g.sector),
          };
          garageRef.current = next;
          setGarage(next);
          saveGarage(next);
          setDepotMode('sector');
          setScr('depot');
          return;
        }
        if (e === 'gameOver') {
          const next = {
            ...garageRef.current,
            coins: garageRef.current.coins + defeatReward(Math.round(g.score)),
          };
          garageRef.current = next;
          setGarage(next);
          saveGarage(next);
          const row: ScoreRow = {
            score: Math.round(g.score),
            sector: g.sector,
            kills: g.kills,
            date: new Date().toISOString().slice(0, 10),
            name: initialsRef.current || 'ANON',
          };
          savedRow.current = row;
          const { list, rank: r } = saveScore(row);
          setScores(list);
          setRank(r);
          setScr('over');
        }
      },
      onPauseRequest: () => {
        const s = screenRef.current;
        if (s === 'play') { g.setPaused(true); setScr('paused'); }
        else if (s === 'paused') { g.setPaused(false); setScr('play'); }
      },
      onDepotRequest: () => {
        const s = screenRef.current;
        if (s === 'play') { g.setPaused(true); setDepotMode('shop'); setScr('depot'); }
        else if (s === 'depot') {
          if (g.phase === 'depot') { g.nextSector(); setScr('play'); }
          else { g.setPaused(false); setScr('play'); }
        }
      },
    });
    gameRef.current = g;
    g.setSelectedTank(garageRef.current.selected);
    g.setPrefs({ autoFire: prefs.autoFire, shake: prefs.shake });
    // idle background sim so the menu isn't empty
    g.phase = 'idle';
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(canvasRef.current);
    return () => { ro.disconnect(); g.dispose(); gameRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- prefs --------------------------------------------------------------
  useEffect(() => {
    savePrefs(prefs);
    audio.setSfx(prefs.sfx);
    audio.setMusic(prefs.music);
    gameRef.current?.setPrefs({ autoFire: prefs.autoFire, shake: prefs.shake });
  }, [prefs]);

  useEffect(() => { saveName(initials); }, [initials]);

  // ---- orientation watcher ------------------------------------------------
  useEffect(() => {
    const upd = () => setPortrait(window.innerHeight > window.innerWidth * 1.1);
    upd();
    window.addEventListener('resize', upd);
    window.addEventListener('orientationchange', upd);
    return () => {
      window.removeEventListener('resize', upd);
      window.removeEventListener('orientationchange', upd);
    };
  }, []);

  // ---- actions ------------------------------------------------------------
  const start = useCallback(() => {
    audio.resume();
    audio.setSfx(prefs.sfx);
    audio.setMusic(prefs.music);
    setRank(-1);
    savedRow.current = null;
    gameRef.current?.setSelectedTank(garageRef.current.selected);
    gameRef.current?.start();
    setScr('play');
  }, [prefs.sfx, prefs.music, setScr]);

  const resume = useCallback(() => {
    gameRef.current?.setPaused(false);
    setScr('play');
  }, [setScr]);

  const quitToMenu = useCallback(() => {
    const g = gameRef.current;
    if (g) { g.running = false; g.phase = 'idle'; g.setPaused(true); audio.stopMusic(); }
    setScores(loadScores());
    setScr('menu');
  }, [setScr]);

  const closeDepot = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    if (g.phase === 'depot') { g.nextSector(); setScr('play'); }
    else { g.setPaused(false); setScr('play'); }
  }, [setScr]);

  const buy = useCallback((id: UpgradeId) => {
    gameRef.current?.buy(id);
  }, []);

  const toggle = useCallback((k: keyof Prefs) => {
    setPrefs((p) => ({ ...p, [k]: !p[k] }));
  }, []);

  const selectTank = useCallback((id: PlayerTankId) => {
    const current = garageRef.current;
    const tank = PLAYER_TANK_MAP[id];
    let next: GarageData;
    if (current.owned.includes(id)) {
      next = { ...current, selected: id };
    } else {
      if (current.coins < tank.cost) { audio.play('deny'); return; }
      next = {
        coins: current.coins - tank.cost,
        owned: [...current.owned, id],
        selected: id,
      };
      audio.play('buy');
    }
    garageRef.current = next;
    setGarage(next);
    saveGarage(next);
    gameRef.current?.setSelectedTank(id);
  }, []);

  // ---- global keys --------------------------------------------------------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (screenRef.current === 'menu' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        start();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [start]);

  // rename handling on the game-over screen
  useEffect(() => {
    if (screen !== 'over' || !savedRow.current) return;
    const row = savedRow.current;
    const list = loadScores().map((r) => (r === row ? { ...r, name: initials || 'ANON' } : r));
    writeScores(list);
    setScores(list);
  }, [initials, screen]);

  const g = gameRef.current;
  const playing = screen === 'play' || screen === 'paused' || screen === 'depot' || screen === 'over';

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#080c14] font-sans text-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {/* CRT-style overlay (pure CSS — no canvas cost) */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] opacity-[0.28]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 3px)',
        }}
      />

      {playing && hud && (
        <Hud hud={hud} isTouch={isTouch} prefs={prefs} toggle={toggle}
          onDepot={() => {
            if (screen === 'play') { g?.setPaused(true); setDepotMode('shop'); setScr('depot'); }
          }}
          onPause={() => {
            if (screen === 'play') { g?.setPaused(true); setScr('paused'); }
          }}
        />
      )}

      {isTouch && screen === 'play' && hud && (
        <TouchControls
          onMove={(x, y) => gameRef.current?.setMoveStick(x, y)}
          onAim={(x, y, fire) => gameRef.current?.setAimStick(x, y, fire)}
          onBoost={() => gameRef.current?.triggerBoost()}
          boostPct={hud.boostPct}
          autoFire={prefs.autoFire}
        />
      )}

      {screen === 'menu' && (
        <StartScreen onStart={start} onGarage={() => setScr('garage')} scores={scores}
          isTouch={isTouch} prefs={prefs} toggle={toggle} garage={garage} />
      )}
      {screen === 'garage' && (
        <GarageScreen garage={garage} onSelect={selectTank} onBack={() => setScr('menu')} />
      )}
      {screen === 'paused' && (
        <PauseScreen onResume={resume} onRestart={start} onQuit={quitToMenu}
          isTouch={isTouch} prefs={prefs} toggle={toggle} />
      )}
      {screen === 'depot' && hud && (
        <DepotScreen hud={hud} onBuy={buy} onDeploy={closeDepot} isSectorClear={depotMode === 'sector'} />
      )}
      {screen === 'over' && hud && (
        <GameOverScreen hud={hud} scores={scores} rank={rank} initials={initials}
          setInitials={setInitials} onRestart={start} onMenu={quitToMenu} victory={false}
          coinsEarned={defeatReward(hud.score)} coins={garage.coins}
          onGarage={() => setScr('garage')} />
      )}

      {isTouch && portrait && screen === 'play' && (
        <div className="pointer-events-none absolute bottom-1/3 left-1/2 z-40 -translate-x-1/2 border border-amber-300/30 bg-black/70 px-3 py-1.5 font-display text-[10px] tracking-[0.25em] text-amber-100/80">
          ↻ ROTATE DEVICE FOR WIDER VIEW
        </div>
      )}
    </div>
  );
}
