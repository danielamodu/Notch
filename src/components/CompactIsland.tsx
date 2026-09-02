import React from 'react';
import {
  Music,
  CheckCircle2,
  Play,
  Pause,
  SkipForward,
  Flame,
  Target,
  Sparkles,
  Bot,
  Terminal,
  MessageSquare,
  Radio,
  PhoneCall,
  Bell,
  Mic,
  MicOff,
  GitBranch,
  Wifi,
} from 'lucide-react';
import { BatteryIcon } from './BatteryIcon.tsx';
import { MediaSourceIcon, MediaSourceBadge, detectMediaSource } from './MediaSourceBadge.tsx';
import { AgentBrandIcon, AgentStatusIndicator, AgentPillBadge } from './AgentStatusBadge.tsx';
import {
  MediaTrack,
  IslandMode,
  TaskItem,
  SystemInfo,
  FocusTimerState,
  IslandSettings,
  IslandNotification,
  ActiveCallState,
  AgentActivityState,
  GitStatus,
  NetworkPing,
} from '../types/island.ts';

interface CompactIslandProps {
  mode: IslandMode;
  media: MediaTrack;
  focusTimer: FocusTimerState;
  tasks: TaskItem[];
  system: SystemInfo;
  settings: IslandSettings;
  recentNotification: { title: string; subtitle: string } | null;
  incomingNotification?: IslandNotification | null;
  activeCall?: ActiveCallState;
  powerEvent?: { type: 'plugged' | 'unplugged'; batteryPercent: number } | null;
  agentActivity?: AgentActivityState;
  gitStatus?: GitStatus | null;
  networkPing?: NetworkPing;
  onControlMedia: (action: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => void;
  onToggleFocus: () => void;
  onClick: () => void;
}

export const CompactIsland: React.FC<CompactIslandProps> = ({
  mode,
  media,
  focusTimer,
  tasks,
  system,
  settings,
  recentNotification,
  incomingNotification,
  activeCall,
  powerEvent,
  agentActivity,
  gitStatus,
  networkPing,
  onControlMedia,
  onToggleFocus,
  onClick,
}) => {
  const pendingTasks = tasks.filter((t) => !t.completed);
  const nextTask = pendingTasks[0];

  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [isMicMuted, setIsMicMuted] = React.useState(false);

  React.useEffect(() => {
    // Clock only displays HH:mm, update every 10s to eliminate 90% idle wakeups
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const formatClock = (d: Date) => {
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${ampm}`;
  };

  const hasDualActivity = media.isPlaying && focusTimer.isActive;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const focusProgress =
    focusTimer.totalDuration > 0
      ? ((focusTimer.totalDuration - focusTimer.timeLeft) / focusTimer.totalDuration) * 100
      : 0;
  const strokeDashoffset = 44 - (44 * focusProgress) / 100;

  // Helper for app notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'permission':
        return <Terminal className="size-3.5 text-white shrink-0 animate-pulse" />;
      case 'antigravity':
        return <Sparkles className="size-3.5 text-white shrink-0 animate-pulse" />;
      case 'claude':
        return <Bot className="size-3.5 text-white shrink-0 animate-pulse" />;
      case 'chat':
        return <MessageSquare className="size-3.5 text-white shrink-0 animate-pulse" />;
      case 'community':
        return <Radio className="size-3.5 text-white shrink-0 animate-pulse" />;
      case 'call':
        return <PhoneCall className="size-3.5 text-white shrink-0 animate-pulse" />;
      default:
        return <Bell className="size-3.5 text-white shrink-0 animate-pulse" />;
    }
  };

  const mediaSource = detectMediaSource(media);

  return (
    <div
      onClick={onClick}
      className="w-full h-full flex items-center justify-between px-3 cursor-pointer text-white select-none relative group/island bg-black"
    >
      {/* 1. POWER EVENT (Charger Plugged / Unplugged) */}
      {powerEvent ? (
        <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0">
            <BatteryIcon percent={powerEvent.batteryPercent} isCharging={powerEvent.type === 'plugged'} />
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-semibold text-white">
                {powerEvent.type === 'plugged' ? 'Fast Charging' : 'On Battery'}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {powerEvent.batteryPercent}%
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-white/10 px-1.5 py-0.5 rounded text-white shrink-0">
            Power
          </span>
        </div>
      ) : incomingNotification ? (
        /* 2. INCOMING ACTIONABLE NOTIFICATION (Claude / Antigravity / Chat) */
        <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {getNotificationIcon(incomingNotification.type)}
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-xs font-semibold text-white truncate">
                {incomingNotification.title}
              </span>
              {incomingNotification.body && (
                <span className="text-xs text-neutral-400 truncate">
                  • {incomingNotification.body}
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] font-mono uppercase bg-white/10 px-1.5 py-0.5 rounded text-white shrink-0">
            {incomingNotification.type === 'permission' ? 'Grant' : 'New'}
          </span>
        </div>
      ) : agentActivity?.isActive || (agentActivity && (agentActivity.status === 'awaiting_approval' || agentActivity.status === 'thinking' || agentActivity.status === 'executing' || agentActivity.status === 'working' || agentActivity.status === 'error' || agentActivity.status === 'completed')) ? (
        /* 3. UNIVERSAL AGENT STATUS (Thinking, Executing, Done, Approval, Error) */
        <div className="flex items-center justify-between w-full gap-2 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <AgentBrandIcon agent={agentActivity.agent} className="size-3.5 shrink-0" />
              <AgentStatusIndicator status={agentActivity.status} className="size-3 shrink-0" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              <span className="text-xs font-semibold text-white truncate">
                {agentActivity.agent}
              </span>
              <span className="text-xs text-neutral-300 font-mono truncate">
                • {agentActivity.detail || agentActivity.action || (agentActivity.status === 'awaiting_approval' ? 'Needs Approval' : agentActivity.status === 'thinking' ? 'Thinking...' : agentActivity.status === 'executing' ? 'Executing...' : 'Active')}
              </span>
            </div>
          </div>
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
              agentActivity.status === 'awaiting_approval'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse'
                : agentActivity.status === 'error'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : agentActivity.status === 'completed'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : agentActivity.status === 'thinking'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'text-black bg-white animate-pulse'
            }`}
          >
            {agentActivity.status === 'awaiting_approval'
              ? 'Approval'
              : agentActivity.status === 'thinking'
              ? 'Think'
              : agentActivity.status === 'executing'
              ? 'Exec'
              : agentActivity.status === 'completed'
              ? 'Done'
              : agentActivity.status === 'error'
              ? 'Error'
              : 'Live'}
          </span>
        </div>
      ) : activeCall?.isActive ? (
        /* 4. ACTIVE CALL & UNIVERSAL MIC PRIVACY PILL */
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex items-center justify-center">
              {isMicMuted ? (
                <MicOff className="size-3.5 text-rose-400" />
              ) : (
                <Mic className="size-3.5 text-amber-400 animate-pulse" />
              )}
              <span
                className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${
                  isMicMuted ? 'bg-rose-400' : 'bg-emerald-400 animate-ping'
                }`}
              />
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-semibold text-white truncate">
                {activeCall.app || 'Microphone Active'}
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">
                {isMicMuted ? '• Muted' : '• In Call'}
              </span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMicMuted(!isMicMuted);
            }}
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full transition active:scale-95 shrink-0 ${
              isMicMuted
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300'
            }`}
          >
            {isMicMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      ) : hasDualActivity ? (
        /* 5. DUAL LIVE ACTIVITY (Music Playing + Focus Timer Running) */
        <div className="flex items-center justify-between w-full gap-2">
          {/* Left: Brand Icon or Album Art */}
          <div className="flex items-center gap-1.5 min-w-0">
            {media.thumbnail ? (
              <div className="relative size-4 rounded-[4px] overflow-hidden shrink-0 bg-neutral-900 flex items-center justify-center border border-white/10">
                <img src={media.thumbnail} alt="" className="size-full object-cover" />
              </div>
            ) : (
              <MediaSourceIcon media={media} className="size-3.5 shrink-0" />
            )}
            {mode === 'glance' ? (
              <span className="truncate text-xs text-white max-w-[130px]">
                {media.title}
              </span>
            ) : (
              /* Audio Wave Visualizer */
              <div className="flex items-end gap-0.5 h-3">
                <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-1" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-2" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-3" />
                <span className="w-0.5 bg-emerald-400 rounded-full animate-eq-4" />
              </div>
            )}
          </div>

          {/* Right: Live Focus Countdown */}
          <div className="flex items-center gap-1 font-mono text-xs text-white shrink-0">
            <div className="relative size-3 flex items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="7" className="stroke-white/20 fill-none" strokeWidth="2.5" />
                <circle
                  cx="10"
                  cy="10"
                  r="7"
                  className="stroke-white fill-none transition-all duration-300"
                  strokeWidth="2.5"
                  strokeDasharray="44"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span>{formatTimer(focusTimer.timeLeft)}</span>
          </div>
        </div>
      ) : focusTimer.isActive ? (
        /* 6. SOLO FOCUS LIVE ACTIVITY */
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="relative size-4 flex items-center justify-center shrink-0">
              <svg className="size-full -rotate-90" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="7" className="stroke-white/20 fill-none" strokeWidth="2.5" />
                <circle
                  cx="10"
                  cy="10"
                  r="7"
                  className="fill-none transition-all duration-300 stroke-white"
                  strokeWidth="2.5"
                  strokeDasharray="44"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {focusTimer.mode === 'work' ? (
                  <Target className="size-2 text-white" />
                ) : (
                  <Flame className="size-2 text-white" />
                )}
              </div>
            </div>

            <span className="truncate text-xs text-white font-medium">
              {focusTimer.mode === 'work' ? 'Deep Focus' : 'Break'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-xs text-white font-semibold">
              {formatTimer(focusTimer.timeLeft)}
            </span>

            {mode === 'glance' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFocus();
                }}
                className="size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition"
              >
                {focusTimer.isPaused ? (
                  <Play className="size-2.5 fill-white translate-x-0.5" />
                ) : (
                  <Pause className="size-2.5 fill-white" />
                )}
              </button>
            )}
          </div>
        </div>
      ) : media.title && (media.isPlaying || media.hasActiveMedia) ? (
        /* 7. SOLO NOW PLAYING WITH DYNAMIC AUDIO WAVE VISUALIZER */
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            {media.thumbnail ? (
              <div className="relative size-5 rounded-[5px] overflow-hidden shrink-0 bg-neutral-900 flex items-center justify-center border border-white/10">
                <img src={media.thumbnail} alt="" className="size-full object-cover" />
              </div>
            ) : (
              <div className="flex items-center justify-center shrink-0">
                <MediaSourceIcon media={media} className="size-4 shrink-0" />
              </div>
            )}
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {mode === 'glance' && (
                <MediaSourceBadge media={media} className="shrink-0" />
              )}
              <span className="truncate text-xs text-white font-medium">
                {media.title}
              </span>
              {media.artist && (
                <span className="truncate text-[11px] text-neutral-400 font-normal">
                  • {media.artist}
                </span>
              )}
            </div>
          </div>

          {/* Trailing Controls or 5-Bar Wave Visualizer */}
          <div className="flex items-center gap-1.5 shrink-0">
            {mode === 'glance' ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onControlMedia('toggle');
                  }}
                  className="size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition"
                >
                  {media.isPlaying ? (
                    <Pause className="size-2.5 fill-white" />
                  ) : (
                    <Play className="size-2.5 fill-white translate-x-0.5" />
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onControlMedia('next');
                  }}
                  className="size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white active:scale-95 transition"
                >
                  <SkipForward className="size-2.5" />
                </button>
              </div>
            ) : media.isPlaying ? (
              /* 5-Bar Pulsating Wave Visualizer */
              <div className="flex items-end gap-0.5 h-3.5 px-1">
                <span className="w-0.5 bg-white rounded-full animate-eq-1" />
                <span className="w-0.5 bg-white rounded-full animate-eq-2" />
                <span className="w-0.5 bg-white rounded-full animate-eq-3" />
                <span className="w-0.5 bg-white rounded-full animate-eq-4" />
                <span className="w-0.5 bg-white rounded-full animate-eq-2" />
              </div>
            ) : (
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wide">
                Paused
              </span>
            )}
          </div>
        </div>
      ) : (
        /* 8. IDLE STATE: SPACIOUS & CLEAN CLOCK, GIT PILL & BATTERY */
        <div className="flex items-center justify-between w-full px-1.5 overflow-hidden">
          {/* Left: Clock */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-white font-mono tracking-tight whitespace-nowrap">
              {formatClock(currentTime)}
            </span>
          </div>

          {/* Center: Git Workspace Badge (if in Git repository) */}
          {gitStatus?.branch ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/[0.08] border border-white/10 text-[10px] font-mono text-neutral-200 shrink-0">
              <GitBranch className="size-2.5 text-indigo-400 shrink-0" />
              <span className="truncate max-w-[70px] font-medium">{gitStatus.branch}</span>
              {gitStatus.modifiedCount > 0 && (
                <span className="text-amber-400 font-semibold text-[9px]">+{gitStatus.modifiedCount}</span>
              )}
            </div>
          ) : (
            <div className="size-1" />
          )}

          {/* Right: Battery Gauge */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-white shrink-0">
            <BatteryIcon
              percent={system.batteryPercent}
              isCharging={system.isCharging}
              showPercentText={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
