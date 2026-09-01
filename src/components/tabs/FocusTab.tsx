import React from 'react';
import { Play, Pause, RotateCcw, Target, Flame, Sparkles } from 'lucide-react';
import { FocusTimerState } from '../../types/island.ts';

interface FocusTabProps {
  focusTimer: FocusTimerState;
  onToggleFocus: () => void;
  onResetFocus: () => void;
  onSwitchMode: (mode: 'work' | 'break', customSeconds?: number) => void;
}

export const FocusTab: React.FC<FocusTabProps> = ({
  focusTimer,
  onToggleFocus,
  onResetFocus,
  onSwitchMode,
}) => {
  const { mode, timeLeft, totalDuration, isActive, completedSessions } = focusTimer;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  const progress = ((totalDuration - timeLeft) / totalDuration) * 100;
  const circumference = 2 * Math.PI * 34; // r = 34 -> ~213.6
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  return (
    <div className="flex flex-col items-center justify-between size-full px-4 py-2 text-white select-none">
      {/* 1. Mode Segmented Switcher */}
      <div className="flex items-center w-full max-w-[270px] bg-neutral-900/80 p-0.5 rounded-full border border-white/5">
        <button
          onClick={() => onSwitchMode('work', 25 * 60)}
          className={`flex-1 py-1 rounded-full text-[11px] font-medium transition active:scale-95 ${
            mode === 'work' && totalDuration === 25 * 60
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          25m Focus
        </button>

        <button
          onClick={() => onSwitchMode('work', 50 * 60)}
          className={`flex-1 py-1 rounded-full text-[11px] font-medium transition active:scale-95 ${
            mode === 'work' && totalDuration === 50 * 60
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          50m Deep
        </button>

        <button
          onClick={() => onSwitchMode('break', 5 * 60)}
          className={`flex-1 py-1 rounded-full text-[11px] font-medium transition active:scale-95 ${
            mode === 'break'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          5m Break
        </button>
      </div>

      {/* 2. Precision Gauge & Monospace Countdown */}
      <div className="relative size-20 flex items-center justify-center my-1">
        <svg className="size-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="34"
            className="stroke-neutral-800/80 fill-none"
            strokeWidth="3"
          />
          <circle
            cx="40"
            cy="40"
            r="34"
            className="fill-none transition-all duration-300 stroke-white"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-mono font-bold text-white tracking-tight leading-none">
            {timeFormatted}
          </span>
          <span className="text-[8px] tracking-widest uppercase font-mono text-neutral-400 mt-1">
            {mode === 'work' ? (totalDuration >= 50 * 60 ? 'Deep Work' : 'Focus') : 'Break'}
          </span>
        </div>
      </div>

      {/* 3. Balanced Action Row */}
      <div className="flex items-center justify-center gap-3 w-full max-w-[270px]">
        {/* Reset Button */}
        <button
          onClick={onResetFocus}
          className="size-7 rounded-full bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white flex items-center justify-center transition active:scale-90"
          title="Reset Timer"
        >
          <RotateCcw className="size-3" />
        </button>

        {/* Hero Start / Pause Button */}
        <button
          onClick={onToggleFocus}
          className={`h-7 px-5 rounded-full font-bold text-xs transition active:scale-95 flex items-center gap-1.5 ${
            isActive
              ? 'bg-neutral-800 text-white border border-white/10 hover:bg-neutral-700'
              : 'bg-white text-black hover:bg-neutral-200 shadow-sm'
          }`}
        >
          {isActive ? (
            <Pause className="size-3 fill-white" />
          ) : (
            <Play className="size-3 fill-black translate-x-0.5" />
          )}
          <span>{isActive ? 'Pause' : 'Start'}</span>
        </button>

        {/* Sessions Streak Badge */}
        <div
          className="h-7 px-2.5 rounded-full bg-neutral-900 border border-white/5 flex items-center gap-1 text-neutral-300 text-[11px] font-mono"
          title="Completed focus sessions"
        >
          <Flame className="size-3 text-amber-400 fill-amber-400/30" />
          <span className="font-semibold">{completedSessions}</span>
        </div>
      </div>
    </div>
  );
};
