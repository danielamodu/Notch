import React from 'react';
import {
  Sparkles,
  Bot,
  Terminal,
  Brain,
  Code2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { AgentActivityState, AgentStatus } from '../types/island.ts';

export interface AgentBrandMeta {
  id: string;
  name: string;
  brandColor: string;
  accentBg: string;
}

export function detectAgentBrand(agentName: string = ''): AgentBrandMeta {
  const norm = agentName.toLowerCase();

  if (norm.includes('claude')) {
    return {
      id: 'claude',
      name: 'Claude Code',
      brandColor: '#CC785C',
      accentBg: 'rgba(204, 120, 92, 0.18)',
    };
  }

  if (norm.includes('antigravity')) {
    return {
      id: 'antigravity',
      name: 'Antigravity',
      brandColor: '#A855F7',
      accentBg: 'rgba(168, 85, 247, 0.18)',
    };
  }

  if (norm.includes('opencode')) {
    return {
      id: 'opencode',
      name: 'OpenCode',
      brandColor: '#10B981',
      accentBg: 'rgba(16, 185, 129, 0.18)',
    };
  }

  if (norm.includes('cursor')) {
    return {
      id: 'cursor',
      name: 'Cursor',
      brandColor: '#3B82F6',
      accentBg: 'rgba(59, 130, 246, 0.18)',
    };
  }

  if (norm.includes('copilot') || norm.includes('codex') || norm.includes('openai')) {
    return {
      id: 'copilot',
      name: 'Codex / Copilot',
      brandColor: '#10A37F',
      accentBg: 'rgba(16, 163, 127, 0.18)',
    };
  }

  if (norm.includes('gemini')) {
    return {
      id: 'gemini',
      name: 'Gemini',
      brandColor: '#4E80EE',
      accentBg: 'rgba(78, 128, 238, 0.18)',
    };
  }

  return {
    id: 'generic',
    name: agentName || 'AI Agent',
    brandColor: '#A855F7',
    accentBg: 'rgba(168, 85, 247, 0.18)',
  };
}

export const AgentBrandIcon: React.FC<{ agent?: string; className?: string }> = ({
  agent = '',
  className = 'size-3.5',
}) => {
  const meta = detectAgentBrand(agent);

  switch (meta.id) {
    case 'claude':
      return (
        /* Claude Code official geometric starburst */
        <svg className={className} viewBox="0 0 24 24" fill="#CC785C">
          <path d="M12 2L14.4 8.6L21 11L14.4 13.4L12 20L9.6 13.4L3 11L9.6 8.6L12 2Z" />
        </svg>
      );

    case 'antigravity':
      return (
        /* Antigravity Sparkle Vortex */
        <svg className={className} viewBox="0 0 24 24" fill="#A855F7">
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
        </svg>
      );

    case 'opencode':
      return <Code2 className={`${className} text-emerald-400`} />;

    case 'cursor':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#3B82F6">
          <path d="M4 2l16 11-7 1.5-4 7.5-2.5-1.5 4-7.5L4 2z" />
        </svg>
      );

    case 'gemini':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#4E80EE">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
        </svg>
      );

    case 'copilot':
      return <Bot className={`${className} text-emerald-400`} />;

    default:
      return <Terminal className={`${className} text-purple-400`} />;
  }
};

export const AgentStatusIndicator: React.FC<{
  status: AgentStatus;
  className?: string;
}> = ({ status, className = 'size-3.5' }) => {
  switch (status) {
    case 'awaiting_approval':
      return (
        <div className="relative flex items-center justify-center">
          <ShieldAlert className={`${className} text-amber-400 animate-pulse`} />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-400 animate-ping" />
        </div>
      );

    case 'thinking':
      return (
        <div className="relative flex items-center justify-center">
          <Brain className={`${className} text-amber-400 animate-pulse`} />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-400 animate-ping" />
        </div>
      );

    case 'executing':
    case 'working':
      return (
        <div className="relative flex items-center justify-center">
          <Loader2 className={`${className} text-emerald-400 animate-spin`} />
          <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 animate-ping" />
        </div>
      );

    case 'completed':
      return <CheckCircle2 className={`${className} text-emerald-400`} />;

    case 'error':
      return <AlertCircle className={`${className} text-rose-400 animate-bounce`} />;

    default:
      return <Zap className={`${className} text-neutral-400`} />;
  }
};

export const AgentPillBadge: React.FC<{
  activity: AgentActivityState;
  className?: string;
}> = ({ activity, className = '' }) => {
  const brand = detectAgentBrand(activity.agent);
  const isBusy =
    activity.status === 'thinking' ||
    activity.status === 'executing' ||
    activity.status === 'working' ||
    activity.status === 'awaiting_approval';

  const isWarning = activity.status === 'awaiting_approval';

  return (
    <div
      style={{
        backgroundColor: isWarning ? 'rgba(245, 158, 11, 0.2)' : brand.accentBg,
        borderColor: isWarning ? 'rgba(245, 158, 11, 0.5)' : `${brand.brandColor}40`,
      }}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${className}`}
    >
      <AgentBrandIcon agent={activity.agent} className="size-3" />
      <span
        style={{ color: isWarning ? '#FBBF24' : brand.brandColor }}
        className="text-[10px] font-bold font-mono tracking-tight leading-none"
      >
        {activity.agent}
      </span>
      {isBusy && (
        <span
          className="size-1.5 rounded-full animate-ping"
          style={{ backgroundColor: isWarning ? '#FBBF24' : brand.brandColor }}
        />
      )}
    </div>
  );
};
