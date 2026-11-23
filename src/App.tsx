/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { ModalOverlay } from './components/ModalOverlay';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './game/audio';
import { StickmanGameEngine, VirtualInputState } from './game/engine';
import { HudSnapshot, MatchConfig } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'TITLE_MENU',
  p1Hp: 100,
  p1TrailHp: 100,
  p2Hp: 100,
  p2TrailHp: 100,
  p1Rounds: 0,
  p2Rounds: 0,
  p1Combo: 0,
  p2Combo: 0,
  roundNumber: 1,
  roundTimer: 99,
  bestOf: 3,
  mode: 'PVP',
  winnerId: null,
  p1Damage: 0,
  p2Damage: 0,
  p1MaxCombo: 0,
  p2MaxCombo: 0,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<StickmanGameEngine | null>(null);

  const [config, setConfig] = useState<MatchConfig>({
    mode: 'PVP',
    difficulty: 'NORMAL',
    bestOf: 3,
  });
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);

  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new StickmanGameEngine(canvas, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    engine.setConfig(configRef.current);
    engine.startLoop();

    const onResize = () => engine.resizeCanvas();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startMatch(configRef.current);
  }, []);

  const handleConfigChange = useCallback((next: MatchConfig) => {
    setConfig(next);
    engineRef.current?.setConfig(next);
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleTouchInput = useCallback(
    (action: keyof VirtualInputState, pressed: boolean) => {
      engineRef.current?.setTouchControl(action, pressed);
    },
    []
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', ' '].includes(e.key) ||
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)
      ) {
        e.preventDefault();
      }

      if (e.code === 'KeyM' && !e.repeat) {
        handleToggleMute();
        return;
      }

      const phase = engine.getPhase();

      if (e.key === 'Escape' && !e.repeat) {
        if (phase === 'PLAYING' || phase === 'PAUSED') {
          engine.togglePause();
        }
        return;
      }

      if (phase === 'TITLE_MENU' && !e.repeat && (e.key === 'Enter' || e.code === 'Space')) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'BUTTON') {
          engine.startMatch(configRef.current);
        }
        return;
      }

      if (phase === 'GAME_OVER' && !e.repeat && e.key === 'Enter') {
        engine.startMatch(configRef.current);
        return;
      }

      engine.handleKeyDown(e.code, e.key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      engineRef.current?.handleKeyUp(e.code, e.key);
    };

    const onBlur = () => {
      engineRef.current?.clearInputs();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        engineRef.current?.clearInputs();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [handleToggleMute]);

  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#080d1a] select-none">
      {/* Isolated Responsive 16:9-ish Arena Container (960x520) */}
      <div className="relative flex h-full w-full items-center justify-center">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full aspect-[960/520] w-full object-contain block"
        />
      </div>

      {/* Title Screen Overlay */}
      {hud.phase === 'TITLE_MENU' && (
        <TitleOverlay
          config={config}
          onChangeConfig={handleConfigChange}
          onStart={handleStart}
        />
      )}

      {/* Active Gameplay HUD */}
      {hud.phase !== 'TITLE_MENU' && (
        <GameHud
          hud={hud}
          muted={muted}
          onToggleMute={handleToggleMute}
          onTogglePause={handleTogglePause}
          onTouchInput={handleTouchInput}
        />
      )}

      {/* Pause / Game Over Modal */}
      <ModalOverlay
        hud={hud}
        onResume={handleTogglePause}
        onRestart={handleStart}
        onReturnTitle={handleReturnTitle}
      />
    </main>
  );
}
