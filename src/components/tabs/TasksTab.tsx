import React, { useState } from 'react';
import {
  Plus,
  Check,
  Trash2,
  Calendar,
  CheckSquare,
  Video,
  ExternalLink,
  LogOut,
  Sparkles,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { TaskItem, CalendarEvent, GoogleAuthStatus } from '../../types/island.ts';

interface TasksTabProps {
  tasks: TaskItem[];
  calendarEvents?: CalendarEvent[];
  googleAuth?: GoogleAuthStatus;
  onAddTask: (title: string, priority: 'low' | 'medium' | 'high', dueDate?: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onLoginGoogle?: (clientId?: string, clientSecret?: string) => Promise<boolean>;
  onLogoutGoogle?: () => Promise<void>;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  calendarEvents = [],
  googleAuth = { connected: false, user: null },
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onLoginGoogle,
  onLogoutGoogle,
}) => {
  const [subView, setSubView] = useState<'tasks' | 'calendar'>('tasks');
  const [newTitle, setNewTitle] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [customSecret, setCustomSecret] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), 'medium');
    setNewTitle('');
  };

  const handleStartLogin = async () => {
    setIsLoggingIn(true);
    try {
      await onLoginGoogle?.(customClientId || undefined, customSecret || undefined);
      setShowConfigModal(false);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleOpenMeet = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank');
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const visibleTasks = [...pendingTasks, ...completedTasks].slice(0, 4);

  const formatEventTime = (startStr: string, isAllDay?: boolean) => {
    if (isAllDay) return 'All Day';
    try {
      const d = new Date(startStr);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col justify-between h-full px-4 pt-1.5 pb-2.5 text-white select-none overflow-hidden gap-1.5">
      {/* 1. Header View Switcher & Google Sync Status */}
      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[11px] text-neutral-400 shrink-0">
        <div className="flex items-center gap-1 bg-white/[0.06] p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setSubView('tasks')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
              subView === 'tasks' ? 'bg-white/20 text-white font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CheckSquare className="size-2.5" />
            <span>Tasks ({pendingTasks.length})</span>
          </button>

          <button
            onClick={() => setSubView('calendar')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition ${
              subView === 'calendar' ? 'bg-white/20 text-white font-semibold shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Calendar className="size-2.5" />
            <span>Calendar ({calendarEvents.length})</span>
          </button>
        </div>

        {/* Google Status Pill */}
        {googleAuth.connected ? (
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {googleAuth.user?.name ? googleAuth.user.name.split(' ')[0] : 'Google'}
            </span>
            <button
              onClick={() => onLogoutGoogle?.()}
              className="text-neutral-500 hover:text-rose-400 transition"
              title="Disconnect Google Account"
            >
              <LogOut className="size-2.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 text-[10px] font-medium transition active:scale-95"
          >
            <Sparkles className="size-2.5" />
            <span>Link Google</span>
          </button>
        )}
      </div>

      {/* 2. MAIN VIEW CONTENT */}
      {showConfigModal ? (
        /* GOOGLE AUTH SETUP MODAL */
        <div className="flex-1 flex flex-col justify-between bg-neutral-900/90 rounded-xl p-2.5 border border-white/10">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-white">Connect Google Calendar & Tasks</span>
            <span className="text-[10px] text-neutral-400">
              Sign in with your Google account to sync meetings and 2-way tasks directly in Notch.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              onClick={() => setShowConfigModal(false)}
              className="px-2.5 py-1 rounded-lg text-[10px] text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleStartLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-indigo-600" />}
              <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
            </button>
          </div>
        </div>
      ) : subView === 'tasks' ? (
        /* TASKS VIEW */
        <div className="flex flex-col justify-between flex-1 overflow-hidden gap-1.5">
          {/* Quick Add Bar */}
          <form
            onSubmit={handleAddTask}
            className="flex items-center justify-between bg-white/[0.06] border border-white/[0.08] rounded-xl px-2.5 py-1 transition-colors focus-within:border-white/20 focus-within:bg-white/[0.09] shrink-0"
          >
            <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1.5">
              <Plus className="size-3 text-neutral-400 shrink-0" />
              <input
                type="text"
                placeholder={googleAuth.connected ? "Add Google Task..." : "Add new task..."}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-transparent border-0 text-xs text-white placeholder-neutral-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="text-[10px] font-semibold text-neutral-400 hover:text-white disabled:opacity-30 transition px-2 py-0.5 rounded-md hover:bg-white/10"
            >
              Add
            </button>
          </form>

          {/* Tasks List */}
          <div className="flex flex-col gap-1 overflow-y-auto flex-1 pr-0.5 custom-scrollbar">
            {visibleTasks.length === 0 ? (
              <div className="flex items-center justify-center text-neutral-500 text-[11px] py-4">
                No active tasks. Add one above!
              </div>
            ) : (
              visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className={`group flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg hover:bg-white/[0.06] transition shrink-0 ${
                    task.completed ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <button
                    onClick={() => onToggleTask(task.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    {task.completed ? (
                      <div className="size-3.5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="size-2 text-black stroke-[3]" />
                      </div>
                    ) : (
                      <div className="size-3.5 rounded-full border border-neutral-500 group-hover:border-white shrink-0 transition" />
                    )}
                    <span
                      className={`text-xs font-medium truncate ${
                        task.completed ? 'line-through text-neutral-400' : 'text-neutral-200'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.isGoogleTask && (
                      <span className="text-[8px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 rounded shrink-0">
                        G-Task
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 transition p-1 rounded-md hover:bg-white/10"
                    title="Delete"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* CALENDAR & MEETINGS VIEW */
        <div className="flex flex-col flex-1 overflow-y-auto gap-1 pr-0.5 custom-scrollbar">
          {calendarEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-neutral-500 text-[11px] py-6 text-center">
              <span>No upcoming events found.</span>
              {!googleAuth.connected && (
                <span className="text-[10px] text-neutral-600 mt-0.5">
                  Link Google Account to view your calendar schedule.
                </span>
              )}
            </div>
          ) : (
            calendarEvents.map((evt) => (
              <div
                key={evt.id}
                className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition shrink-0"
              >
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-medium text-neutral-100 truncate">
                    {evt.summary}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono mt-0.5">
                    <span className="text-indigo-400 font-semibold">
                      {formatEventTime(evt.start, evt.isAllDay)}
                    </span>
                    {evt.location && <span className="truncate max-w-[120px]">• {evt.location}</span>}
                  </div>
                </div>

                {evt.meetLink ? (
                  <button
                    onClick={() => handleOpenMeet(evt.meetLink)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-[10px] font-semibold transition active:scale-95 shrink-0"
                    title="Join Video Meeting"
                  >
                    <Video className="size-2.5" />
                    <span>Join</span>
                  </button>
                ) : evt.htmlLink ? (
                  <button
                    onClick={() => handleOpenMeet(evt.htmlLink)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition shrink-0"
                    title="Open in Google Calendar"
                  >
                    <ExternalLink className="size-2.5" />
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
