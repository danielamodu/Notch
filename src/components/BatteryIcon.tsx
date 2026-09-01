import React from 'react';
import { Zap, Plug } from 'lucide-react';

interface BatteryIconProps {
  percent: number | null;
  isCharging?: boolean;
  className?: string;
  showPercentText?: boolean;
}

export const BatteryIcon: React.FC<BatteryIconProps> = ({
  percent,
  isCharging = false,
  className = 'h-3 w-5',
  showPercentText = false,
}) => {
  // If no battery detected (e.g. Desktop PC plugged directly to AC)
  if (percent === null) {
    return (
      <div className="flex items-center gap-1 text-neutral-400" title="Connected to AC Power">
        <Plug className="size-3.5 text-neutral-300" />
        {showPercentText && <span className="text-[11px] font-mono">AC</span>}
      </div>
    );
  }

  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
  const isLow = clampedPercent <= 20;
  const isCritical = clampedPercent <= 10;

  // Inner fill bar width (scale against 12px available inner width)
  const maxInnerWidth = 11.5;
  const fillWidth = Math.max(1.5, (clampedPercent / 100) * maxInnerWidth);

  // Dynamic Fill Color
  let fillColor = 'currentColor';
  if (isCharging) {
    fillColor = '#4ade80'; // Emerald/Green charging
  } else if (isCritical) {
    fillColor = '#f43f5e'; // Rose/Red
  } else if (isLow) {
    fillColor = '#fbbf24'; // Amber
  } else {
    fillColor = '#ffffff';
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0" title={`${clampedPercent}%${isCharging ? ' (Charging)' : ''}`}>
      <div className="relative inline-flex items-center justify-center">
        <svg
          viewBox="0 0 20 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${className} overflow-visible`}
        >
          {/* Battery Outer Outline */}
          <rect
            x="0.75"
            y="0.75"
            width="15.5"
            height="8.5"
            rx="2.25"
            stroke="currentColor"
            strokeWidth="1.2"
            className="text-neutral-400"
          />
          {/* Battery Positive Terminal Pin */}
          <path
            d="M17.75 3.25C18.15 3.4 18.5 3.8 18.5 4.5V5.5C18.5 6.2 18.15 6.6 17.75 6.75"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            className="text-neutral-500"
          />
          {/* Dynamic Fill Level */}
          <rect
            x="2.25"
            y="2.25"
            width={fillWidth}
            height="5.5"
            rx="1.25"
            fill={fillColor}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* Small Charging Bolt Overlay */}
        {isCharging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Zap className="size-2.5 fill-black text-black stroke-[2.5]" />
          </div>
        )}
      </div>

      {showPercentText && (
        <span
          className={`font-mono text-xs font-semibold tracking-tight ${
            isCritical ? 'text-rose-400 animate-pulse' : isLow ? 'text-amber-300' : 'text-white'
          }`}
        >
          {clampedPercent}%
        </span>
      )}
    </div>
  );
};
