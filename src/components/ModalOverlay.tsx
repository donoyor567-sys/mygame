import React from 'react';
import { HudSnapshot } from '../game/types';

interface ModalOverlayProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  if (hud.phase !== 'PAUSED' && hud.phase !== 'GAME_OVER') {
    return null;
  }

  const p2Name = hud.mode === 'BOT' ? 'BOT' : '2-O‘YINCHI';
  const winnerLabel =
    hud.winnerId === 0
      ? '1-O‘YINCHI G‘ALABA QOZONDI!'
      : `${p2Name} G‘ALABA QOZONDI!`;
  const winnerAccent = hud.winnerId === 0 ? 'text-[#ff6b86]' : 'text-[#66b8ff]';

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#060a14]/78 px-4">
      <div className="w-full max-w-md rounded-xl bg-[#0d1428] border border-slate-700/85 p-6 text-center shadow-2xl">
        {hud.phase === 'PAUSED' ? (
          <>
            <h2 className="font-display text-4xl font-extrabold tracking-wide text-white">
              PAUZA
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Jang vaqtincha to‘xtatildi.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full whitespace-nowrap rounded-lg bg-[#ffd166] px-5 py-2.5 font-display text-lg font-extrabold tracking-wide text-[#0d1224] transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
              >
                Davom etish
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full whitespace-nowrap rounded-lg bg-[#1c2642] border border-slate-600/80 px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#253256]"
              >
                Qayta boshlash
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="w-full whitespace-nowrap rounded-lg bg-transparent border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors duration-150 hover:text-white hover:border-slate-500"
              >
                Bosh menyu
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold tracking-wider text-[#ffd166]">
              JANG TUGADI
            </div>
            <h2
              className={`mt-1 font-display text-3xl sm:text-4xl font-extrabold tracking-wide ${winnerAccent}`}
            >
              {winnerLabel}
            </h2>

            {/* Clean Tabular Match Summary */}
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-lg bg-[#080d1a] border border-slate-800 p-3.5 text-xs">
              <div className="text-left">
                <div className="text-slate-400">1-O‘yinchi</div>
                <div className="mt-1 font-mono-num text-base font-bold text-[#ff6b86]">
                  {hud.p1Rounds} R
                </div>
                <div className="mt-0.5 font-mono-num text-slate-300">
                  {hud.p1Damage} zarar
                </div>
                <div className="font-mono-num text-slate-400">
                  {hud.p1MaxCombo}x kombo
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-x border-slate-800 px-2">
                <span className="text-slate-500 font-semibold">HISOB</span>
                <span className="mt-1 font-mono-num text-2xl font-bold text-white">
                  {hud.p1Rounds} : {hud.p2Rounds}
                </span>
              </div>

              <div className="text-right">
                <div className="text-slate-400">{p2Name}</div>
                <div className="mt-1 font-mono-num text-base font-bold text-[#66b8ff]">
                  {hud.p2Rounds} R
                </div>
                <div className="mt-0.5 font-mono-num text-slate-300">
                  {hud.p2Damage} zarar
                </div>
                <div className="font-mono-num text-slate-400">
                  {hud.p2MaxCombo}x kombo
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onRestart}
                className="w-full whitespace-nowrap rounded-lg bg-[#ffd166] px-5 py-2.5 font-display text-lg font-extrabold tracking-wide text-[#0d1224] transition-transform duration-150 hover:brightness-105 active:scale-[0.98]"
              >
                Qayta o‘ynash
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="w-full whitespace-nowrap rounded-lg bg-transparent border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors duration-150 hover:text-white hover:border-slate-500"
              >
                Bosh menyu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
