import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';
import { SystemInfo } from '../types/island.ts';

export const BottomShelf: React.FC = () => {
  const [system, setSystem] = useState<SystemInfo>({
    batteryPercent: null,
    isCharging: false,
    cpuUsage: 12,
    memoryUsagePercent: 38,
    totalMemoryGb: 16,
    freeMemoryGb: 9.8,
    uptimeHours: 0,
    activePorts: [3001],
    cpuHistory: [6, 10, 14, 8, 12, 16, 11, 15, 9, 14, 12, 18, 10, 14, 8, 12],
    ramHistory: [36, 37, 38, 38, 38, 39, 38, 38],
  });

  useEffect(() => {
    const api = (window as any).islandAPI;
    if (!api) return;

    api.getSystemStats?.().then((st: any) => {
      if (st) setSystem(st);
    });

    const unsubSystem = api.onSystemUpdate?.((stats: SystemInfo) => {
      if (stats) setSystem(stats);
    });

    return () => {
      unsubSystem?.();
    };
  }, []);

  const handleMouseEnter = () => {
    const api = (window as any).islandAPI;
    api?.setShelfIgnoreMouseEvents?.(false);
  };

  const handleMouseLeave = () => {
    const api = (window as any).islandAPI;
    api?.setShelfIgnoreMouseEvents?.(true, { forward: true });
  };

  const openPort = (port: number) => {
    const api = (window as any).islandAPI;
    api?.openExternal?.(`http://localhost:${port}`);
  };

  // Build sleek SVG Area Chart path with padding
  const cpuPoints =
    system.cpuHistory && system.cpuHistory.length > 2
      ? system.cpuHistory
      : [8, 12, 16, 10, 14, 18, 12, 16, 20, 14, 18, 22, 15, 18, 12, 15];

  const svgWidth = 96;
  const svgHeight = 22;
  const maxVal = 100;
  const step = (svgWidth - 4) / (cpuPoints.length - 1);

  const coords = cpuPoints.map((val, i) => {
    const x = 2 + i * step;
    const clamped = Math.min(92, Math.max(6, val));
    const y = svgHeight - (clamped / maxVal) * (svgHeight - 4) - 2;
    return { x, y };
  });

  const linePath = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${svgHeight} L ${coords[0].x.toFixed(1)} ${svgHeight} Z`;

  const activePorts = system.activePorts || [];
  const primaryPort = activePorts[0];

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="w-full h-full flex items-center justify-start select-none pointer-events-none p-0.5"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="pointer-events-auto relative w-full h-[36px] rounded-[7px] bg-[#181818]/60 text-white border border-white/5 shadow-sm backdrop-blur-xl flex items-center justify-between px-3 overflow-hidden"
      >
        {/* Module 1: CPU & RAM Telemetry */}
        <div className="flex items-center gap-3 shrink-0 z-10">
          <div className="flex flex-col justify-center">
            <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400 leading-none">
              Live CPU
            </span>
            <span className="text-[13px] font-bold text-white tracking-tight leading-none font-mono mt-0.5">
              {system.cpuUsage}%
            </span>
          </div>

          <div className="flex flex-col justify-center border-l border-white/10 pl-3">
            <span className="text-[8px] font-mono uppercase tracking-wider text-neutral-400 leading-none">
              Memory
            </span>
            <span className="text-[13px] font-semibold text-neutral-200 tracking-tight leading-none font-mono mt-0.5">
              {system.memoryUsagePercent}%
            </span>
          </div>
        </div>

        {/* Module 2: Radiant Live Sparkline Area Chart */}
        <div className="relative w-[96px] h-[22px] shrink-0 overflow-hidden flex items-end justify-center px-1">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="shelfGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#shelfGradient)" />
            <path
              d={linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Module 3: Active Dev Server / Port Slot */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 border-l border-white/10 pl-3">
          {primaryPort ? (
            <button
              onClick={() => openPort(primaryPort)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition active:scale-95 group/btn"
              title={`Open http://localhost:${primaryPort} in browser`}
            >
              <span className="relative flex size-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono font-bold tracking-tight">
                :{primaryPort}
              </span>
              <span className="text-[9px] font-mono uppercase bg-emerald-500/20 px-1 py-0.2 rounded text-emerald-300">
                Live
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Radio className="size-3 text-neutral-500" />
              <span className="text-[10px] font-mono text-neutral-400">Dev Idle</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
