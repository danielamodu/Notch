import { useState, useEffect, useCallback } from 'react';
import {
  MediaTrack,
  TaskItem,
  ClipboardEntry,
  ScreenshotEntry,
  ShelfEntry,
  SystemInfo,
  FocusTimerState,
  IslandSettings,
  IslandMode,
  IslandTab,
  IslandNotification,
  ActiveCallState,
  AgentActivityState,
} from '../types/island.ts';

const DEFAULT_TRACK: MediaTrack = {
  title: '',
  artist: '',
  album: '',
  appId: '',
  isPlaying: false,
  position: 0,
  duration: 0,
  hasActiveMedia: false,
  thumbnail: '',
};

const DEFAULT_SETTINGS: IslandSettings = {
  topMargin: 8,
  compactWidth: 280,
  compactHeight: 32,
  notchStyle: 'floating',
  autoHideFullscreen: true,
  soundEffects: true,
  enableAgentWatcher: true,
  customText: '',
  idleDisplayMode: 'both',
};

const DEFAULT_FOCUS: FocusTimerState = {
  isActive: false,
  isPaused: false,
  mode: 'work',
  timeLeft: 25 * 60,
  totalDuration: 25 * 60,
  completedSessions: 0,
};

export function useIslandData() {
  const [islandMode, setIslandMode] = useState<IslandMode>('compact');
  const [activeTab, setActiveTab] = useState<IslandTab>('media');
  const [media, setMedia] = useState<MediaTrack>(DEFAULT_TRACK);

  const [focusTimer, setFocusTimer] = useState<FocusTimerState>(() => {
    try {
      const saved = localStorage.getItem('apex_focus');
      if (saved) return { ...DEFAULT_FOCUS, ...JSON.parse(saved), isActive: false };
    } catch {}
    return DEFAULT_FOCUS;
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('apex_tasks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [clipboardItems, setClipboardItems] = useState<ClipboardEntry[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const [shelfFiles, setShelfFiles] = useState<ShelfEntry[]>([]);
  const [system, setSystem] = useState<SystemInfo>({
    batteryPercent: null,
    isCharging: false,
    cpuUsage: 0,
    memoryUsagePercent: 0,
    totalMemoryGb: 16,
    freeMemoryGb: 8,
    uptimeHours: 0,
  });

  const [settings, setSettings] = useState<IslandSettings>(() => {
    try {
      const s = localStorage.getItem('apex_settings');
      if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const [incomingNotification, setIncomingNotification] = useState<IslandNotification | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallState>({ isActive: false, app: '' });
  const [powerEvent, setPowerEvent] = useState<{ type: 'plugged' | 'unplugged'; batteryPercent: number } | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivityState>({
    isActive: false,
    agent: 'Antigravity',
    action: '',
    status: 'idle',
    updatedAt: 0,
  });

  const [recentNotification, setRecentNotification] = useState<{
    id: string;
    title: string;
    subtitle: string;
    type: string;
  } | null>(null);

  // Google Calendar & Tasks state
  const [googleAuth, setGoogleAuth] = useState<GoogleAuthStatus>({ connected: false, user: null });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [networkPing, setNetworkPing] = useState<NetworkPing>({ latency: 18, online: true });

  // Deep OS Signals (Downloads, Volume HUD, Bluetooth, CapsLock)
  const [activeDownload, setActiveDownload] = useState<ActiveDownloadInfo | null>(null);
  const [volumeHUD, setVolumeHUD] = useState<VolumeHUDState | null>(null);
  const [bluetoothHUD, setBluetoothHUD] = useState<BluetoothHUDState | null>(null);
  const [capsLockHUD, setCapsLockHUD] = useState<CapsLockHUDState | null>(null);

  // Poll Git Status & Network Ping for closed-state radars
  useEffect(() => {
    const api = (window as any).islandAPI;
    const fetchGitAndPing = async () => {
      try {
        if (api?.getGitStatus) {
          const g = await api.getGitStatus();
          if (g && g.branch) setGitStatus(g);
        }
        if (api?.getPing) {
          const p = await api.getPing();
          if (p) setNetworkPing(p);
        }
      } catch {}
    };

    fetchGitAndPing();
    const interval = setInterval(fetchGitAndPing, 6000);
    return () => clearInterval(interval);
  }, []);

  // Focus Timer Tick Engine
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (focusTimer.isActive && !focusTimer.isPaused && focusTimer.timeLeft > 0) {
      interval = setInterval(() => {
        setFocusTimer((prev) => {
          if (prev.timeLeft <= 1) {
            // Completed session
            const nextMode = prev.mode === 'work' ? 'break' : 'work';
            const nextDuration = nextMode === 'work' ? 25 * 60 : 5 * 60;
            return {
              ...prev,
              isActive: false,
              mode: nextMode,
              timeLeft: nextDuration,
              totalDuration: nextDuration,
              completedSessions: prev.mode === 'work' ? prev.completedSessions + 1 : prev.completedSessions,
            };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [focusTimer.isActive, focusTimer.isPaused, focusTimer.timeLeft]);

  // Sync tasks & settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('apex_tasks', JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem('apex_settings', JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('apex_focus', JSON.stringify(focusTimer));
    } catch {}
  }, [focusTimer]);

  // Connect to Electron IPC
  useEffect(() => {
    const api = (window as any).islandAPI;
    if (!api) return;

    api.getMedia?.().then((m: any) => m && m.hasActiveMedia && setMedia(m));
    api.getClipboardHistory?.().then((c: any) => c && setClipboardItems(c));
    api.getScreenshots?.().then((s: any) => s && setScreenshots(s));
    api.getShelfFiles?.().then((f: any) => f && setShelfFiles(f));
    api.getSystemStats?.().then((st: any) => st && setSystem(st));

    const unsubMedia = api.onMediaUpdate?.((track: MediaTrack) => {
      if (track) {
        setMedia(track);
      }
    });

    // Continuous live playback tracker (so opening the dropdown shows the exact live second)
    const mediaTick = setInterval(() => {
      setMedia((prev) => {
        if (!prev.isPlaying || !prev.duration) return prev;
        const nextPos = prev.position + 1;
        return {
          ...prev,
          position: nextPos <= prev.duration ? nextPos : prev.duration,
        };
      });
    }, 1000);

    const unsubClipboard = api.onClipboardUpdate?.((items: ClipboardEntry[]) => {
      setClipboardItems(items);
    });

    const unsubScreenshots = api.onScreenshotsUpdate?.((items: ScreenshotEntry[]) => {
      setScreenshots(items);
    });

    const unsubNewScreenshot = api.onNewScreenshot?.((item: ScreenshotEntry) => {
      setRecentNotification({
        id: item.id,
        title: 'Screenshot Captured',
        subtitle: item.name,
        type: 'screenshot',
      });
      setIslandMode('glance');
      const apiRef = (window as any).islandAPI;
      apiRef?.setIslandState?.('glance');
      setTimeout(() => {
        setRecentNotification(null);
        setIslandMode((cur) => {
          if (cur === 'glance') {
            apiRef?.setIslandState?.('compact');
            return 'compact';
          }
          return cur;
        });
      }, 4000);
    });

    const unsubShelf = api.onShelfUpdate?.((files: ShelfEntry[]) => {
      setShelfFiles(files);
    });

    const unsubSystem = api.onSystemUpdate?.((stats: SystemInfo) => {
      setSystem(stats);
    });

    const unsubNotifications = api.onNewNotification?.((notif: IslandNotification) => {
      if (notif) {
        setIncomingNotification(notif);
        setIslandMode('glance');
        const apiRef = (window as any).islandAPI;
        apiRef?.setIslandState?.('glance');
        setTimeout(() => {
          setIncomingNotification((cur) => (cur?.id === notif.id ? null : cur));
          setIslandMode((cur) => {
            if (cur === 'glance') {
              apiRef?.setIslandState?.('compact');
              return 'compact';
            }
            return cur;
          });
        }, 5000);
      }
    });

    const unsubCall = api.onCallStatusChange?.((call: ActiveCallState) => {
      if (call) {
        setActiveCall({
          ...call,
          startTime: call.isActive ? Date.now() : undefined,
        });
      }
    });

    const unsubPower = api.onPowerEvent?.((event: { type: 'plugged' | 'unplugged'; batteryPercent: number }) => {
      if (event) {
        setPowerEvent(event);
        setIslandMode('glance');
        const apiRef = (window as any).islandAPI;
        apiRef?.setIslandState?.('glance');
        setTimeout(() => {
          setPowerEvent(null);
          setIslandMode((cur) => {
            if (cur === 'glance') {
              apiRef?.setIslandState?.('compact');
              return 'compact';
            }
            return cur;
          });
        }, 4500);
      }
    });

    let pendingAgentState: AgentActivityState | null = null;
    let agentRafId: number | null = null;
    let completeCollapseTimer: NodeJS.Timeout | null = null;

    const unsubAgent = api.onAgentUpdate?.((state: AgentActivityState) => {
      if (!state) return;
      pendingAgentState = state;
      if (agentRafId === null) {
        agentRafId = requestAnimationFrame(() => {
          if (pendingAgentState) {
            setAgentActivity(pendingAgentState);

            if (completeCollapseTimer) {
              clearTimeout(completeCollapseTimer);
              completeCollapseTimer = null;
            }

            // When completed, show green checkmark for 3 seconds before collapsing
            if (pendingAgentState.status === 'completed') {
              completeCollapseTimer = setTimeout(() => {
                setAgentActivity((cur) =>
                  cur.status === 'completed'
                    ? { ...cur, isActive: false, status: 'idle' }
                    : cur
                );
              }, 3000);
            }
          }
          agentRafId = null;
        });
      }
    });

    const unsubHotkey = api.onToggleHotkey?.(() => {
      setIslandMode((prev) => {
        const next = prev === 'expanded' ? 'compact' : 'expanded';
        const api = (window as any).islandAPI;
        api?.setIslandState?.(next);
        return next;
      });
    });

    let volTimer: NodeJS.Timeout | null = null;
    const unsubVolume = api.onVolumeChange?.((vol: VolumeHUDState) => {
      if (!vol) return;
      setVolumeHUD(vol);
      setIslandMode('glance');
      const apiRef = (window as any).islandAPI;
      apiRef?.setIslandState?.('glance');
      if (volTimer) clearTimeout(volTimer);
      volTimer = setTimeout(() => {
        setVolumeHUD(null);
        setIslandMode((cur) => {
          if (cur === 'glance') {
            apiRef?.setIslandState?.('compact');
            return 'compact';
          }
          return cur;
        });
      }, 1600);
    });

    let capsTimer: NodeJS.Timeout | null = null;
    const unsubCaps = api.onCapsLock?.((caps: CapsLockHUDState) => {
      if (!caps) return;
      setCapsLockHUD(caps);
      setIslandMode('glance');
      const apiRef = (window as any).islandAPI;
      apiRef?.setIslandState?.('glance');
      if (capsTimer) clearTimeout(capsTimer);
      capsTimer = setTimeout(() => {
        setCapsLockHUD(null);
        setIslandMode((cur) => {
          if (cur === 'glance') {
            apiRef?.setIslandState?.('compact');
            return 'compact';
          }
          return cur;
        });
      }, 1400);
    });

    const unsubDownloadProgress = api.onDownloadProgress?.((dl: ActiveDownloadInfo) => {
      if (!dl) return;
      setActiveDownload(dl);
    });

    const unsubDownloadComplete = api.onDownloadComplete?.((dl: ActiveDownloadInfo) => {
      if (!dl) return;
      setActiveDownload({ ...dl, state: 'completed', progressPercent: 100 });
      setRecentNotification({
        id: dl.id,
        title: 'Download Complete',
        subtitle: dl.finalName,
        type: 'download',
      });
      setIslandMode('glance');
      const apiRef = (window as any).islandAPI;
      apiRef?.setIslandState?.('glance');
      setTimeout(() => {
        setActiveDownload(null);
        setRecentNotification(null);
        setIslandMode((cur) => (cur === 'glance' ? 'compact' : cur));
      }, 4000);
    });

    const unsubBluetooth = api.onBluetoothDeviceChange?.((dev: BluetoothHUDState) => {
      if (!dev) return;
      setBluetoothHUD(dev);
      setIslandMode('glance');
      const apiRef = (window as any).islandAPI;
      apiRef?.setIslandState?.('glance');
      setTimeout(() => {
        setBluetoothHUD(null);
        setIslandMode((cur) => (cur === 'glance' ? 'compact' : cur));
      }, 3500);
    });

    // Git & Network Ping polling
    const fetchGitAndPing = async () => {
      try {
        const [git, ping] = await Promise.all([
          api.getGitStatus?.(),
          api.getPing?.(),
        ]);
        if (git !== undefined) setGitStatus(git);
        if (ping) setNetworkPing(ping);
      } catch {}
    };

    fetchGitAndPing();
    const gitInterval = setInterval(fetchGitAndPing, 6000);

    // Google Calendar & Tasks polling
    const fetchGoogle = async () => {
      try {
        const auth = await api.getGoogleStatus?.();
        if (auth) {
          setGoogleAuth(auth);
          if (auth.connected) {
            const [events, gTasks] = await Promise.all([
              api.getGoogleCalendarEvents?.(),
              api.getGoogleTasks?.(),
            ]);
            if (events) setCalendarEvents(events);
            if (gTasks && gTasks.length > 0) {
              setTasks((prev) => {
                const local = prev.filter((t) => !t.isGoogleTask);
                return [...local, ...gTasks];
              });
            }
          }
        }
      } catch {}
    };

    fetchGoogle();
    const googleInterval = setInterval(fetchGoogle, 30000);

    return () => {
      clearInterval(mediaTick);
      clearInterval(gitInterval);
      clearInterval(googleInterval);
      unsubMedia?.();
      unsubClipboard?.();
      unsubScreenshots?.();
      unsubNewScreenshot?.();
      unsubShelf?.();
      unsubSystem?.();
      unsubNotifications?.();
      unsubCall?.();
      unsubPower?.();
      unsubAgent?.();
      unsubHotkey?.();
    };
  }, []);

  const updateMode = useCallback((mode: IslandMode) => {
    setIslandMode(mode);
    const api = (window as any).islandAPI;
    api?.setIslandState?.(mode);
  }, []);

  // Expand with contextual smart tab selection
  const expandToContext = useCallback(() => {
    if (recentNotification?.type === 'screenshot') {
      setActiveTab('shelf');
    } else if (focusTimer.isActive) {
      setActiveTab('focus');
    } else if (media.isPlaying) {
      setActiveTab('media');
    }
    updateMode('expanded');
  }, [recentNotification, focusTimer.isActive, media.isPlaying, updateMode]);

  // Google Login / Logout Actions
  const loginGoogle = async (clientId?: string, clientSecret?: string) => {
    const api = (window as any).islandAPI;
    if (api?.loginGoogle) {
      const ok = await api.loginGoogle(clientId, clientSecret);
      if (ok) {
        const auth = await api.getGoogleStatus?.();
        if (auth) setGoogleAuth(auth);
        const [events, gTasks] = await Promise.all([
          api.getGoogleCalendarEvents?.(),
          api.getGoogleTasks?.(),
        ]);
        if (events) setCalendarEvents(events);
        if (gTasks) {
          setTasks((prev) => [...prev.filter((t) => !t.isGoogleTask), ...gTasks]);
        }
      }
      return ok;
    }
    return false;
  };

  const logoutGoogle = async () => {
    const api = (window as any).islandAPI;
    if (api?.logoutGoogle) {
      await api.logoutGoogle();
      setGoogleAuth({ connected: false, user: null });
      setCalendarEvents([]);
      setTasks((prev) => prev.filter((t) => !t.isGoogleTask));
    }
  };

  // Focus Timer Actions
  const toggleFocusTimer = () => {
    setFocusTimer((prev) => ({
      ...prev,
      isActive: !prev.isActive,
      isPaused: false,
    }));
  };

  const resetFocusTimer = () => {
    setFocusTimer((prev) => ({
      ...prev,
      isActive: false,
      isPaused: false,
      timeLeft: prev.totalDuration,
    }));
  };

  const switchFocusMode = (newMode: 'work' | 'break', customSeconds?: number) => {
    const dur = customSeconds || (newMode === 'work' ? 25 * 60 : 5 * 60);
    setFocusTimer((prev) => ({
      ...prev,
      isActive: false,
      isPaused: false,
      mode: newMode,
      timeLeft: dur,
      totalDuration: dur,
    }));
  };

  // Task Actions (2-Way Google Tasks Sync)
  const addTask = async (
    title: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    dueDate?: string,
    dueTime?: string
  ) => {
    if (!title.trim()) return;
    const api = (window as any).islandAPI;
    if (googleAuth.connected && api?.createGoogleTask) {
      const created = await api.createGoogleTask(title.trim());
      if (created) {
        setTasks((prev) => [created, ...prev]);
        return;
      }
    }
    const newTask: TaskItem = {
      id: Math.random().toString(36).substring(2, 9),
      title: title.trim(),
      completed: false,
      priority,
      dueDate,
      dueTime,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    const nextCompleted = !task?.completed;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted } : t))
    );
    if (task?.isGoogleTask) {
      const api = (window as any).islandAPI;
      api?.toggleGoogleTask?.(id, nextCompleted);
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (task?.isGoogleTask) {
      const api = (window as any).islandAPI;
      api?.deleteGoogleTask?.(id);
    }
  };

  // Media Actions
  const controlMedia = async (action: 'play' | 'pause' | 'toggle' | 'next' | 'previous') => {
    if (action === 'toggle') {
      setMedia((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
    } else if (action === 'play') {
      setMedia((prev) => ({ ...prev, isPlaying: true }));
    } else if (action === 'pause') {
      setMedia((prev) => ({ ...prev, isPlaying: false }));
    }

    const api = (window as any).islandAPI;
    if (api) {
      await api.controlMedia(action);
    }
  };

  // Clipboard Actions
  const copyClipboard = async (content: string) => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.copyClipboardItem(content);
    } else {
      await navigator.clipboard.writeText(content);
    }
  };

  const deleteClipboard = async (id: string) => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.deleteClipboardItem(id);
    } else {
      setClipboardItems((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const togglePinClipboard = async (id: string) => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.togglePinClipboard(id);
    } else {
      setClipboardItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
      );
    }
  };

  const clearClipboard = async () => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.clearClipboard();
    } else {
      setClipboardItems((prev) => prev.filter((c) => c.isPinned));
    }
  };

  // Shelf Actions
  const addShelfFile = async (filePath: string) => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.addShelfFile(filePath);
    }
  };

  const removeShelfFile = async (id: string) => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.removeShelfFile(id);
    } else {
      setShelfFiles((prev) => prev.filter((f) => f.id !== id));
    }
  };

  const deleteScreenshot = async (id: string) => {
    const api = (window as any).islandAPI;
    if (api) {
      await api.deleteScreenshot(id);
    } else {
      setScreenshots((prev) => prev.filter((s) => s.id !== id));
    }
  };

  return {
    islandMode,
    setIslandMode: updateMode,
    expandToContext,
    activeTab,
    setActiveTab,
    media,
    controlMedia,
    focusTimer,
    toggleFocusTimer,
    resetFocusTimer,
    switchFocusMode,
    tasks,
    addTask,
    toggleTask,
    deleteTask,
    clipboardItems,
    copyClipboard,
    deleteClipboard,
    togglePinClipboard,
    clearClipboard,
    screenshots,
    deleteScreenshot,
    shelfFiles,
    addShelfFile,
    removeShelfFile,
    system,
    settings,
    setSettings,
    recentNotification,
    incomingNotification,
    activeCall,
    powerEvent,
    agentActivity,
    gitStatus,
    networkPing,
    googleAuth,
    calendarEvents,
    loginGoogle,
    logoutGoogle,
    activeDownload,
    volumeHUD,
    bluetoothHUD,
    capsLockHUD,
  };
}
