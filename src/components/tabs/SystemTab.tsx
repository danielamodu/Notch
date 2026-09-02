import React from 'react';
import { HardDrive, Power, Keyboard } from 'lucide-react';
import { BatteryIcon } from '../BatteryIcon.tsx';
import { SystemInfo, IslandSettings } from '../../types/island.ts';

interface SystemTabProps {
  system: SystemInfo;
  settings: IslandSettings;
  onUpdateSettings: (settings: Partial<IslandSettings>) => void;
  onCollapse: () => void;
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

  return (
    <div className="flex flex-col justify-between h-full px-3.5 pt-1.5 pb-3 text-white select-none overflow-hidden gap-1.5">
      {/* 1. Custom Text Setting */}
      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-900 text-xs">
        <span className="text-[10px] text-neutral-400 font-mono shrink-0">Custom Text:</span>
        <input
          type="text"
          placeholder="⚡ Apex Island"
          value={settings.customText || ''}
          onChange={(e) => onUpdateSettings({ customText: e.target.value })}
          className="w-full bg-transparent border-0 text-xs text-white placeholder-neutral-600 focus:outline-none font-medium"
        />
      </div>

      {/* 2. System Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-900">
          <BatteryIcon percent={system.batteryPercent} isCharging={system.isCharging} />
          <div className="flex flex-col text-xs">
            <span className="text-[9px] text-neutral-400 font-mono">Battery</span>
            <span className="font-semibold font-mono text-[10px]">
              {system.batteryPercent !== null ? `${system.batteryPercent}%` : 'AC Power'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-neutral-900">
          <HardDrive className="size-3 text-neutral-400" />
          <div className="flex flex-col text-xs">
            <span className="text-[9px] text-neutral-400 font-mono">RAM</span>
            <span className="font-semibold font-mono text-[10px]">{system.memoryUsagePercent}%</span>
          </div>
        </div>
      </div>

      {/* 3. Shortcut & Quit Button */}
      <div className="flex items-center justify-between pt-0.5 text-xs">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Keyboard className="size-3" />
          <span className="font-mono text-white text-[10px]">Alt + `</span>
        </div>

        <button
          onClick={handleQuit}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[10px] font-medium transition"
        >
          <Power className="size-2.5" />
          Quit
        </button>
      </div>
    </div>
  );
};
