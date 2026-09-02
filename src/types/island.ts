export type IslandMode = 'compact' | 'glance' | 'expanded';

export type IslandTab = 'media' | 'tasks' | 'shelf' | 'clipboard' | 'focus' | 'notes' | 'system' | 'settings';

export interface MediaTrack {
  title: string;
  artist: string;
  album: string;
  appId: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  thumbnail?: string;
  hasActiveMedia: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  tag?: string;
  isGoogleTask?: boolean;
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  isAllDay?: boolean;
  meetLink?: string;
  htmlLink?: string;
}

export interface GoogleAuthStatus {
  connected: boolean;
  user?: {
    email: string;
    name: string;
    picture?: string;
  } | null;
}

export interface ClipboardEntry {
  id: string;
  type: 'text' | 'link' | 'code' | 'color' | 'image';
  content: string;
  preview: string;
  isSensitive: boolean;
  isPinned: boolean;
  timestamp: number;
}

export interface ScreenshotEntry {
  id: string;
  filePath?: string;
  dataUrl: string;
  name: string;
  sizeBytes?: number;
  timestamp: number;
  isRecent: boolean;
}

export interface ShelfEntry {
  id: string;
  filePath: string;
  name: string;
  extension: string;
  sizeBytes: number;
  addedAt: number;
}

export interface SystemInfo {
  batteryPercent: number | null;
  isCharging: boolean;
  hasBattery?: boolean;
  cpuUsage: number;
  memoryUsagePercent: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  uptimeHours: number;
  activePorts?: number[];
  cpuHistory?: number[];
  ramHistory?: number[];
}

export interface FocusTimerState {
  isActive: boolean;
  isPaused: boolean;
  mode: 'work' | 'break';
  timeLeft: number;
  totalDuration: number;
  completedSessions: number;
}

export interface IslandSettings {
  topMargin: number; // px from screen top
  compactWidth: number; // default 280
  compactHeight: number; // default 32
  notchStyle: 'floating' | 'notch' | 'minimal';
  autoHideFullscreen: boolean;
  soundEffects: boolean;
  enableAgentWatcher: boolean;
  customText: string;
  idleDisplayMode: 'task' | 'custom' | 'both';
}

export interface IslandNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  type: 'permission' | 'antigravity' | 'claude' | 'chat' | 'community' | 'call' | 'system';
  timestamp: number;
}

export interface ActiveCallState {
  isActive: boolean;
  app: string;
  startTime?: number;
}

export type AgentStatus = 'thinking' | 'executing' | 'idle' | 'error' | 'working' | 'completed';

export interface AgentActivityState {
  isActive: boolean;
  agent: string;
  action: string;
  detail?: string;
  status: AgentStatus;
  updatedAt: number;
}

export interface GitStatus {
  branch: string;
  modifiedCount: number;
  isClean: boolean;
}

export interface NetworkPing {
  latency: number | null;
  online: boolean;
}

