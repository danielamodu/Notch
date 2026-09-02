import React from 'react';
import { Play, Pause, RotateCcw, Flame, Zap, Compass, Coffee, Clock } from 'lucide-react';
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
  const circumference = 2 * Math.PI * 32; // r=32 -> ~201
  const strokeDashoffset = circumference - (circumference * progress) / 100;

  const presets = [
    { label: '25m Focus', mode: 'work' as const, secs: 25 * 60, icon: <Zap className="size-3 text-amber-400" /> },
    { label: '50m Deep', mode: 'work' as const, secs: 50 * 60, icon: <Compass className="size-3 text-blue-400" /> },
    { label: '5m Break', mode: 'break' as const, secs: 5 * 60, icon: <Coffee className="size-3 text-emerald-400" /> },
    { label: '15m Reset', mode: 'break' as const, secs: 15 * 60, icon: <Clock className="size-3 text-purple-400" /> },
  ];

  return (
    <div className="flex items-center justify-between h-full px-4 pt-1.5 pb-2.5 text-white select-none overflow-hidden gap-3">
      {/* 1. Left: Circular Timer Gauge (76px x 76px) */}
      <div className="relative size-[76px] shrink-0 flex items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 76 76">
          <circle
            cx="38"
            cy="38"
            r="32"
            className="stroke-neutral-800 fill-none"
            strokeWidth="4"
          />
          <circle
            cx="38"
            cy="38"
            r="32"
            className="fill-none transition-all duration-300 stroke-white"
            strokeWidth="4"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-base font-mono font-bold text-white tracking-tight leading-none">
            {timeFormatted}
          </span>
          <span className="text-[8px] uppercase tracking-wider font-mono text-neutral-400 mt-1">
            {mode === 'work' ? (totalDuration >= 50 * 60 ? 'Deep' : 'Focus') : 'Break'}
          </span>
        </div>
      </div>

      {/* 2. Center: Aligned Action Block (Matching 2-row grid exactly) */}
      <div className="flex flex-col justify-between h-[76px] w-[95px] shrink-0">
        {/* Row 1: Start / Pause Button (34px height) */}
        <button
          onClick={handleToggle}
          className={`h-[34px] w-full rounded-xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm ${
            isActive
              ? 'bg-neutral-800 text-white border border-white/10 hover:bg-neutral-700'
              : 'bg-white text-black hover:bg-neutral-200'
          }`}
        >
          {isActive ? (
            <Pause className="size-3 fill-white" />
          ) : (
            <Play className="size-3 fill-black translate-x-0.5" />
          )}
          <span>{isActive ? 'Pause' : 'Start'}</span>
        </button>

        {/* Row 2: Reset & Streak Row (34px height) */}
        <div className="flex items-center gap-1.5 h-[34px] w-full">
          <button
            onClick={handleReset}
            className="size-[34px] shrink-0 rounded-xl bg-neutral-900 border border-white/5 hover:border-white/20 text-neutral-400 hover:text-white flex items-center justify-center transition active:scale-90"
            title="Reset Timer"
          >
            <RotateCcw className="size-3" />
          </button>

          <div
            className="h-[34px] flex-1 rounded-xl bg-neutral-900 border border-white/5 flex items-center justify-center gap-1 text-neutral-300 text-[11px] font-mono"
            title="Completed focus sessions"
          >
            <Flame className="size-3 text-amber-400 fill-amber-400/30 shrink-0" />
            <span className="font-semibold">{completedSessions}</span>
          </div>
        </div>
      </div>

      {/* 3. Right: 2x2 Preset Cards (Matching 2-row grid exactly) */}
      <div className="grid grid-cols-2 gap-1.5 h-[76px] flex-1 min-w-0">
        {presets.map((p) => {
          const isSelected = mode === p.mode && totalDuration === p.secs;
          return (
            <button
              key={p.label}
              onClick={() => onSwitchMode(p.mode, p.secs)}
              className={`h-[34px] flex items-center gap-1.5 px-2.5 rounded-xl border text-left transition active:scale-95 ${
                isSelected
                  ? 'bg-neutral-800 text-white border-white/20 shadow-sm'
                  : 'bg-neutral-900/90 hover:bg-neutral-850 border-white/5 text-neutral-300 hover:text-white'
              }`}
            >
              {p.icon}
              <span className="text-[10px] font-medium leading-tight truncate">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
