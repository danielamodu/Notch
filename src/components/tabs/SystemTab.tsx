import React from 'react';
import { HardDrive, Power, Keyboard, Type } from 'lucide-react';
import { BatteryIcon } from '../BatteryIcon.tsx';
import { SystemInfo, IslandSettings } from '../../types/island.ts';

interface SystemTabProps {
  system: SystemInfo;
  settings: IslandSettings;
  onUpdateSettings: (settings: Partial<IslandSettings>) => void;
}

export const SystemTab: React.FC<SystemTabProps> = ({
  system,
  settings,
  onUpdateSettings,
}) => {
  const handleQuit = () => {
    const api = (window as any).islandAPI;
    api?.quitApp?.();
  };

  const quickPresets = ['⚡ Locked In', '🎯 Ship v1', '🚀 Deep Work', '☕ Low Key'];

  return (
    <div className="flex flex-col gap-2 p-2.5 text-white">
      {/* Custom Text Setting */}
      <div className="flex flex-col gap-1 p-2 rounded-lg bg-neutral-900 text-xs">
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Type className="size-3 text-neutral-400" />
            <span>Custom Island Text</span>
          </div>
          {settings.customText && (
            <button
              onClick={() => onUpdateSettings({ customText: '' })}
              className="text-[10px] text-neutral-500 hover:text-rose-400"
            >
              Reset
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="e.g. ⚡ Locked In or Your Name"
          value={settings.customText || ''}
          onChange={(e) => onUpdateSettings({ customText: e.target.value })}
          className="w-full bg-black border-0 rounded-md px-2 py-1 text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-white/30 font-medium"
        />
        <div className="flex items-center gap-1 mt-0.5 overflow-x-auto">
          {quickPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onUpdateSettings({ customText: preset })}
              className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/15 text-[10px] text-neutral-300 shrink-0 transition"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Telemetry Row */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-900">
          <BatteryIcon percent={system.batteryPercent} isCharging={system.isCharging} />
          <div className="flex flex-col text-xs">
            <span className="text-[9px] text-neutral-400 font-mono">Battery</span>
            <span className="font-semibold font-mono text-[11px]">
              {system.batteryPercent !== null ? `${system.batteryPercent}%` : 'AC Power'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-900">
          <HardDrive className="size-3.5 text-white" />
          <div className="flex flex-col text-xs">
            <span className="text-[9px] text-neutral-400 font-mono">RAM</span>
            <span className="font-semibold font-mono text-[11px]">{system.memoryUsagePercent}% used</span>
          </div>
        </div>
      </div>

      {/* Shortcut & Quit */}
      <div className="flex items-center justify-between pt-0.5 text-xs">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Keyboard className="size-3" />
          <span className="font-mono text-white text-[11px]">Alt + `</span>
        </div>

        <button
          onClick={handleQuit}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[11px] font-medium transition"
        >
          <Power className="size-3" />
          Quit App
        </button>
      </div>
    </div>
  );
};
