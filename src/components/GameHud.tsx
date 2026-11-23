import React from 'react';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';
import { VirtualInputState } from '../game/engine';

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onTouchInput: (action: keyof VirtualInputState, pressed: boolean) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  muted,
  onToggleMute,
  onTogglePause,
  onTouchInput,
}) => {
  const neededWins = hud.bestOf === 1 ? 1 : 2;

  const bindTouch = (action: keyof VirtualInputState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput(action, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onTouchInput(action, false);
    },
    onPointerCancel: () => onTouchInput(action, false),
    onPointerLeave: () => onTouchInput(action, false),
  });

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Health & Timer Cluster */}
      <div className="flex w-full items-start justify-between gap-3 sm:gap-5">
        {/* Player 1 Health Cluster */}
        <div className="flex-1 max-w-[420px]">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg sm:text-xl font-bold tracking-wide text-[#ff6b86]">
                1-O‘YINCHI
              </span>
              {hud.bestOf === 3 && (
                <div className="flex items-center gap-1" aria-label="1-o‘yinchi raundlari">
                  {Array.from({ length: neededWins }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-2.5 w-2.5 rotate-45 border ${
                        idx < hud.p1Rounds
                          ? 'bg-[#ffd166] border-[#ffd166]'
                          : 'bg-[#151e36] border-slate-600'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
            <span className="font-mono-num text-sm sm:text-base font-bold text-slate-100">
              {hud.p1Hp} HP
            </span>
          </div>

          {/* Segmented / Smooth Health Bar */}
          <div className="relative h-4 sm:h-5 w-full overflow-hidden rounded bg-[#141c33] border border-slate-700/80">
            <div
              className="absolute inset-y-0 left-0 bg-[#ffd166]/65 transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, hud.p1TrailHp))}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#ff365e] to-[#ff7b72] transition-[width] duration-75"
              style={{ width: `${Math.max(0, Math.min(100, hud.p1Hp))}%` }}
            />
          </div>

          {hud.p1Combo >= 2 && (
            <div className="mt-1.5 font-display text-base font-extrabold tracking-wider text-[#ffd166]">
              {hud.p1Combo}x KOMBO
            </div>
          )}
        </div>

        {/* Center Round & Timer + Mute/Pause Buttons */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              title={muted ? 'Ovozni yoqish (M)' : 'Ovozni o‘chirish (M)'}
              aria-label={muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish'}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#141c33] border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <div className="flex flex-col items-center justify-center rounded-lg bg-[#141c33] border border-slate-700/80 px-3.5 py-1 min-w-[66px]">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 leading-none">
                {hud.bestOf === 1 ? 'DUEL' : `R-${hud.roundNumber}`}
              </span>
              <span className="font-mono-num text-xl sm:text-2xl font-bold leading-tight text-[#ffd166]">
                {String(hud.roundTimer).padStart(2, '0')}
              </span>
            </div>

            <button
              type="button"
              onClick={onTogglePause}
              title="Pauza (Esc)"
              aria-label="Pauza"
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#141c33] border border-slate-700/80 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
            >
              <Pause className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Player 2 / Bot Health Cluster */}
        <div className="flex-1 max-w-[420px]">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-mono-num text-sm sm:text-base font-bold text-slate-100">
              {hud.p2Hp} HP
            </span>
            <div className="flex items-center gap-2">
              {hud.bestOf === 3 && (
                <div className="flex items-center gap-1" aria-label="2-o‘yinchi raundlari">
                  {Array.from({ length: neededWins }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-2.5 w-2.5 rotate-45 border ${
                        idx < hud.p2Rounds
                          ? 'bg-[#ffd166] border-[#ffd166]'
                          : 'bg-[#151e36] border-slate-600'
                      }`}
                    />
                  ))}
                </div>
              )}
              <span className="font-display text-lg sm:text-xl font-bold tracking-wide text-[#66b8ff]">
                {hud.mode === 'BOT' ? 'BOT' : '2-O‘YINCHI'}
              </span>
            </div>
          </div>

          <div className="relative h-4 sm:h-5 w-full overflow-hidden rounded bg-[#141c33] border border-slate-700/80">
            <div
              className="absolute inset-y-0 right-0 bg-[#ffd166]/65 transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, hud.p2TrailHp))}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-[#27b7ff] to-[#5478ff] transition-[width] duration-75"
              style={{ width: `${Math.max(0, Math.min(100, hud.p2Hp))}%` }}
            />
          </div>

          {hud.p2Combo >= 2 && (
            <div className="mt-1.5 text-right font-display text-base font-extrabold tracking-wider text-[#ffd166]">
              {hud.p2Combo}x KOMBO
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Compact Desktop Control Reminder or Mobile Touch Controls */}
      <div className="flex w-full items-end justify-between">
        {/* Touch Controls (Mobile / Small Screens Only) */}
        <div className="pointer-events-auto flex w-full items-center justify-between gap-2 md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...bindTouch('left')}
              className="h-12 w-12 rounded-lg bg-[#141c33]/90 border border-slate-700 text-lg font-bold text-white active:bg-slate-700 select-none"
            >
              ←
            </button>
            <button
              type="button"
              {...bindTouch('guard')}
              className="h-12 w-12 rounded-lg bg-[#141c33]/90 border border-slate-700 text-xs font-bold text-sky-300 active:bg-slate-700 select-none"
            >
              HIM
            </button>
            <button
              type="button"
              {...bindTouch('right')}
              className="h-12 w-12 rounded-lg bg-[#141c33]/90 border border-slate-700 text-lg font-bold text-white active:bg-slate-700 select-none"
            >
              →
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...bindTouch('jump')}
              className="h-12 px-3 rounded-lg bg-[#141c33]/90 border border-slate-700 text-xs font-bold text-white active:bg-slate-700 select-none"
            >
              SAKR
            </button>
            <button
              type="button"
              {...bindTouch('light')}
              className="h-12 px-3 rounded-lg bg-[#ff476b]/90 border border-[#ff8b6c] text-xs font-bold text-white active:brightness-110 select-none"
            >
              ZARBA
            </button>
            <button
              type="button"
              {...bindTouch('heavy')}
              className="h-12 px-3 rounded-lg bg-[#ffd166] text-xs font-extrabold text-[#0d1224] active:brightness-110 select-none"
            >
              KUCHLI
            </button>
          </div>
        </div>

        {/* Desktop Single Flat Control Line */}
        <div className="hidden md:flex w-full justify-center">
          <div className="text-xs text-slate-400 bg-[#080d1a]/80 px-3.5 py-1 rounded border border-slate-800/80">
            <span>1P: A/D · W · S Himoya · F/G Zarba</span>
            {hud.mode === 'PVP' && (
              <>
                <span className="mx-2 text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span>2P: ←/→ · ↑ · ↓ Himoya · K/L Zarba</span>
              </>
            )}
            <span className="mx-2 text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>M Ovoz · Esc Pauza</span>
          </div>
        </div>
      </div>
    </div>
  );
};
