import React from 'react';
import { BotDifficulty, GameMode, MatchConfig } from '../game/types';

interface TitleOverlayProps {
  config: MatchConfig;
  onChangeConfig: (next: MatchConfig) => void;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  config,
  onChangeConfig,
  onStart,
}) => {
  const setMode = (mode: GameMode) => onChangeConfig({ ...config, mode });
  const setDifficulty = (difficulty: BotDifficulty) =>
    onChangeConfig({ ...config, difficulty });
  const setBestOf = (bestOf: 1 | 3) => onChangeConfig({ ...config, bestOf });

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-4 py-6 sm:py-8">
      {/* Upper Calm Sky Area: Bespoke SVG Title Lockup + Start Controls */}
      <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center text-center mt-1 sm:mt-4">
        {/* Bespoke Inline SVG Title Lockup */}
        <svg
          viewBox="0 0 560 116"
          className="w-full max-w-[480px] h-auto select-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
          role="img"
          aria-label="Stickman Jang"
        >
          <defs>
            <linearGradient id="sjTitleGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff3c4" />
              <stop offset="55%" stopColor="#ffd166" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          {/* Left crimson duel slash */}
          <path d="M26 78 L98 34 L106 42 L34 86 Z" fill="#ff476b" />
          {/* Right azure duel slash */}
          <path d="M534 78 L462 34 L454 42 L526 86 Z" fill="#43a8ff" />
          {/* Top hairline */}
          <line x1="128" y1="22" x2="432" y2="22" stroke="#334155" strokeWidth="1.5" />
          {/* Main Display Wordmark */}
          <text
            x="280"
            y="80"
            textAnchor="middle"
            fill="url(#sjTitleGold)"
            fontFamily="'Barlow Condensed', system-ui, sans-serif"
            fontWeight="800"
            fontStyle="italic"
            fontSize="68"
            letterSpacing="3"
          >
            STICKMAN JANG
          </text>
          {/* Bottom accent underline */}
          <rect x="172" y="96" width="96" height="3" fill="#ff476b" />
          <rect x="274" y="96" width="12" height="3" fill="#ffd166" />
          <rect x="292" y="96" width="96" height="3" fill="#43a8ff" />
        </svg>

        {/* Compact Mode & Match Settings */}
        <div className="mt-4 flex flex-col items-center gap-2.5 bg-[#0d1428]/92 border border-slate-700/70 rounded-xl px-5 py-4 w-full max-w-md">
          {/* Mode Selector */}
          <div className="flex w-full items-center gap-1.5 rounded-lg bg-[#080d1a] p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('PVP')}
              className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#ffd166] ${
                config.mode === 'PVP'
                  ? 'bg-[#1d2846] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2 O‘yinchi (PvP)
            </button>
            <button
              type="button"
              onClick={() => setMode('BOT')}
              className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#ffd166] ${
                config.mode === 'BOT'
                  ? 'bg-[#1d2846] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Botga qarshi (1P)
            </button>
          </div>

          {/* Secondary Options Row: Difficulty (if Bot) + Rounds */}
          <div className="flex w-full items-center justify-between gap-2">
            {config.mode === 'BOT' ? (
              <div className="flex flex-1 items-center gap-1 rounded-lg bg-[#080d1a] p-1 border border-slate-800">
                {(
                  [
                    ['EASY', 'Oson'],
                    ['NORMAL', 'O‘rta'],
                    ['HARD', 'Qiyin'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key)}
                    className={`flex-1 whitespace-nowrap rounded px-2 py-1.5 text-xs font-medium transition-colors duration-150 ${
                      config.difficulty === key
                        ? 'bg-[#2a3860] text-[#ffd166]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 text-left text-xs text-slate-400 pl-1">
                Bitta klaviaturada duel
              </div>
            )}

            <div className="flex items-center gap-1 rounded-lg bg-[#080d1a] p-1 border border-slate-800">
              {([1, 3] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setBestOf(r)}
                  className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                    config.bestOf === r
                      ? 'bg-[#2a3860] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {r} Raund
                </button>
              ))}
            </div>
          </div>

          {/* Primary Start CTA */}
          <button
            type="button"
            onClick={onStart}
            className="mt-1 w-full whitespace-nowrap rounded-lg bg-[#ffd166] px-6 py-3 font-display text-xl font-extrabold tracking-wide text-[#0d1224] transition-transform duration-150 hover:brightness-105 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Jangni boshlash
          </button>
        </div>
      </div>

      {/* Bottom Single Flat Control Hint Line */}
      <div className="pointer-events-none text-center text-xs sm:text-sm text-slate-300 bg-[#080d1a]/85 px-4 py-1.5 rounded-md border border-slate-800/80">
        <span>1P: A/D Yurish · W Sakrash · S Himoya · F Zarba · G Kuchli</span>
        {config.mode === 'PVP' && (
          <>
            <span className="mx-2 text-slate-500" aria-hidden="true">
              |
            </span>
            <span>2P: ←/→ Yurish · ↑ Sakrash · ↓ Himoya · K Zarba · L Kuchli</span>
          </>
        )}
        <span className="mx-2 text-slate-500" aria-hidden="true">
          |
        </span>
        <span>Esc Pauza · Enter Boshlash</span>
      </div>
    </div>
  );
};
