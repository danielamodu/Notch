import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, CheckSquare, FolderHeart, ClipboardList, Timer, Settings as SettingsIcon, ChevronUp } from 'lucide-react';
import { CompactIsland } from './CompactIsland.tsx';
import { NowPlayingTab } from './tabs/NowPlayingTab.tsx';
import { TasksTab } from './tabs/TasksTab.tsx';
import { ShelfTab } from './tabs/ShelfTab.tsx';
import { ClipboardTab } from './tabs/ClipboardTab.tsx';
import { FocusTab } from './tabs/FocusTab.tsx';
import { SystemTab } from './tabs/SystemTab.tsx';
import { IslandTab } from '../types/island.ts';
import { useIslandData } from '../hooks/useIslandData.ts';

export const DynamicIsland: React.FC = () => {
  const {
    islandMode,
    setIslandMode,
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
  } = useIslandData();

  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ensure mouse events are enabled when expanded
  useEffect(() => {
    const api = (window as any).islandAPI;
    if (islandMode === 'expanded') {
      api?.setIgnoreMouseEvents?.(false);
    }
  }, [islandMode]);

  // Handle hover over compact pill with click-through passthrough
  const handleMouseEnter = () => {
    const api = (window as any).islandAPI;
    api?.setIgnoreMouseEvents?.(false);

    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    // Only pass through clicks if compact/glance - keep expanded window interactive
    if (islandMode !== 'expanded') {
      const api = (window as any).islandAPI;
      api?.setIgnoreMouseEvents?.(true, { forward: true });
    }
  };

  const pendingTasksCount = tasks.filter((t) => !t.completed).length;
  const hasDualActivity = media.isPlaying && focusTimer.isActive;

  // Adaptive Dynamic Island Dimensions
  const getIslandDimensions = () => {
    const baseWidth = settings.compactWidth || 280;
    if (islandMode === 'compact') {
      let width = baseWidth;
      if (incomingNotification) {
        width = Math.max(baseWidth + 110, 390);
      } else if (powerEvent || activeCall?.isActive) {
        width = Math.max(baseWidth + 40, 320);
      } else if (agentActivity?.isActive || agentActivity?.status === 'completed') {
        width = Math.max(baseWidth + 50, 330);
      } else if (recentNotification) {
        width = Math.max(baseWidth, 300);
      } else if (hasDualActivity) {
        width = Math.max(baseWidth, 310);
      }
      return {
        width,
        height: 32,
        borderRadius: 9999,
      };
    }
    if (islandMode === 'glance') {
      let width = Math.max(baseWidth + 30, 320);
      if (incomingNotification) {
        width = Math.max(baseWidth + 110, 390);
      }
      return {
        width,
        height: 38,
        borderRadius: 9999,
      };
    }

    // Expanded Dropdown - matching exact 180px height
    return {
      width: 360,
      height: 180,
      borderRadius: 20,
    };
  };

  const dimensions = getIslandDimensions();

  const tabs: { id: IslandTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'media', label: 'Now Playing', icon: <Music className="size-3.5" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="size-3.5" />, badge: pendingTasksCount },
    { id: 'shelf', label: 'Shelf & Screenshots', icon: <FolderHeart className="size-3.5" />, badge: screenshots.length + shelfFiles.length },
    { id: 'clipboard', label: 'Clipboard History', icon: <ClipboardList className="size-3.5" />, badge: clipboardItems.length },
    { id: 'focus', label: 'Focus Timer', icon: <Timer className="size-3.5" /> },
    { id: 'system', label: 'System Settings', icon: <SettingsIcon className="size-3.5" /> },
  ];

  return (
    <div
      className="fixed inset-x-0 top-0 flex items-start justify-center z-[999999] pointer-events-none"
      style={{ paddingTop: `${settings.topMargin || 0}px` }}
    >
      <motion.div
        layout
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={false}
        animate={{
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.borderRadius,
        }}
        transition={{
          type: 'spring',
          stiffness: 460,
          damping: 36,
          mass: 0.7,
        }}
        className="pointer-events-auto relative overflow-hidden bg-black text-white border-0 shadow-none"
        style={{
          backgroundColor: '#000000',
          boxShadow: 'none',
        }}
      >
        {/* COMPACT & GLANCE MODE */}
        {islandMode !== 'expanded' ? (
          <CompactIsland
            mode={islandMode}
            media={media}
            focusTimer={focusTimer}
            tasks={tasks}
            system={system}
            settings={settings}
            recentNotification={recentNotification}
            incomingNotification={incomingNotification}
            activeCall={activeCall}
            powerEvent={powerEvent}
            agentActivity={agentActivity}
            onControlMedia={controlMedia}
            onToggleFocus={toggleFocusTimer}
            onClick={expandToContext}
          />
        ) : (
          /* EXPANDED FULL WORKSPACE */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col size-full overflow-hidden bg-black"
          >
            {/* Header / Full-Width Tab Bar */}
            <div className="flex items-center justify-between gap-1 px-3 py-1.5 border-b border-white/5 bg-black shrink-0">
              <div className="flex items-center justify-between flex-1 gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    className={`relative flex-1 flex items-center justify-center h-6 rounded-md transition active:scale-95 ${
                      activeTab === tab.id
                        ? 'bg-neutral-800 text-white font-semibold'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {tab.icon}
                  </button>
                ))}
              </div>

              {/* Collapse Button */}
              <button
                onClick={() => setIslandMode('compact')}
                className="size-6 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-300 transition active:scale-95 shrink-0 ml-1"
                title="Collapse Island (Alt + `)"
              >
                <ChevronUp className="size-3.5" />
              </button>
            </div>

            {/* Tab Contents - 100% Non-Scrollable */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === 'media' && (
                  <NowPlayingTab key="media" media={media} onControl={controlMedia} />
                )}
                {activeTab === 'tasks' && (
                  <TasksTab
                    key="tasks"
                    tasks={tasks}
                    onAddTask={addTask}
                    onToggleTask={toggleTask}
                    onDeleteTask={deleteTask}
                  />
                )}
                {activeTab === 'shelf' && (
                  <ShelfTab
                    key="shelf"
                    screenshots={screenshots}
                    shelfFiles={shelfFiles}
                    onDeleteScreenshot={deleteScreenshot}
                    onRemoveShelfFile={removeShelfFile}
                    onAddShelfFile={addShelfFile}
                  />
                )}
                {activeTab === 'clipboard' && (
                  <ClipboardTab
                    key="clipboard"
                    items={clipboardItems}
                    onCopy={copyClipboard}
                    onDelete={deleteClipboard}
                    onTogglePin={togglePinClipboard}
                    onClear={clearClipboard}
                  />
                )}
                {activeTab === 'focus' && (
                  <FocusTab
                    key="focus"
                    focusTimer={focusTimer}
                    onToggleFocus={toggleFocusTimer}
                    onResetFocus={resetFocusTimer}
                    onSwitchMode={switchFocusMode}
                  />
                )}
                {activeTab === 'system' && (
                  <SystemTab
                    key="system"
                    system={system}
                    settings={settings}
                    onUpdateSettings={(newS) => setSettings((prev) => ({ ...prev, ...newS }))}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
