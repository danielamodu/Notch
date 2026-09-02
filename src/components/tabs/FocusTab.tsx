import React from 'react';
import { Play, Pause, RotateCcw, Flame } from 'lucide-react';
import { FocusTimerState } from '../../types/island.ts';

interface FocusTabProps {
  focusTimer?: FocusTimerState;
  focus?: FocusTimerState;
  onToggleFocus?: () => void;
  onToggle?: () => void;
  onResetFocus?: () => void;
  onReset?: () => void;
  onSwitchMode: (mode: 'work' | 'break', customSeconds?: number) => void;
}

export const FocusTab: React.FC<FocusTabProps> = ({
  focusTimer,
  focus,
  onToggleFocus,
  onToggle,
  onResetFocus,
  onReset,
  onSwitchMode,
}) => {
  const timerData = focusTimer || focus || {
    mode: 'work',
    timeLeft: 25 * 60,
    totalDuration: 25 * 60,
    isActive: false,
    isPaused: false,
    completedSessions: 0,
  };

  const handleToggle = onToggleFocus || onToggle || (() => {});
  const handleReset = onResetFocus || onReset || (() => {});

  const { mode, timeLeft, totalDuration, isActive, completedSessions } = timerData;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;

  const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;
  const circumference = 2 * Math.PI * 26;
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  return (
    <div className="flex flex-col items-center justify-between h-full px-3.5 pt-1.5 pb-2.5 text-white select-none overflow-hidden">
      {/* 1. Mode Switcher */}
      <div className="flex items-center w-full max-w-[270px] bg-neutral-900 p-0.5 rounded-full border border-white/5">
        <button
          onClick={() => onSwitchMode('work', 25 * 60)}
          className={`flex-1 py-0.5 rounded-full text-[10px] font-medium transition active:scale-95 ${
            mode === 'work' && totalDuration === 25 * 60
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          25m Focus
        </button>

        <button
          onClick={() => onSwitchMode('work', 50 * 60)}
          className={`flex-1 py-0.5 rounded-full text-[10px] font-medium transition active:scale-95 ${
            mode === 'work' && totalDuration === 50 * 60
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          50m Deep
        </button>

        <button
          onClick={() => onSwitchMode('break', 5 * 60)}
          className={`flex-1 py-0.5 rounded-full text-[10px] font-medium transition active:scale-95 ${
            mode === 'break'
              ? 'bg-white text-black font-semibold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          5m Break
        </button>
      </div>

      {/* 2. Timer Countdown & Gauge */}
      <div className="relative size-16 flex items-center justify-center my-0.5">
        <svg className="size-full -rotate-90" viewBox="0 0 60 60">
          <circle
            cx="30"
            cy="30"
            r="26"
            className="stroke-neutral-800 fill-none"
            strokeWidth="3"
          />
          <circle
            cx="30"
            cy="30"
            r="26"
            className="fill-none transition-all duration-300 stroke-white"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-mono font-bold text-white tracking-tight leading-none">
            {timeFormatted}
          </span>
          <span className="text-[8px] tracking-widest uppercase font-mono text-neutral-400 mt-0.5">
            {mode === 'work' ? 'Focus' : 'Break'}
          </span>
        </div>
      </div>

      {/* 3. Actions Row */}
      <div className="flex items-center justify-center gap-3 w-full max-w-[270px]">
        <button
          onClick={handleReset}
          className="size-6 rounded-full bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white flex items-center justify-center transition active:scale-90"
          title="Reset"
        >
          <RotateCcw className="size-2.5" />
        </button>

        <button
          onClick={handleToggle}
          className={`h-6 px-4 rounded-full font-bold text-xs transition active:scale-95 flex items-center gap-1.5 ${
            isActive
              ? 'bg-neutral-800 text-white border border-white/10 hover:bg-neutral-700'
              : 'bg-white text-black hover:bg-neutral-200 shadow-sm'
          }`}
        >
          {isActive ? (
            <Pause className="size-2.5 fill-white" />
          ) : (
            <Play className="size-2.5 fill-black translate-x-0.5" />
          )}
          <span>{isActive ? 'Pause' : 'Start'}</span>
        </button>

        <div className="h-6 px-2 rounded-full bg-neutral-900 border border-white/5 flex items-center gap-1 text-neutral-300 text-[10px] font-mono">
          <Flame className="size-2.5 text-amber-400 fill-amber-400/30" />
          <span className="font-semibold">{completedSessions}</span>
        </div>
      </div>
    </div>
  );
};
