import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Sparkles,
  Calendar as CalendarIcon,
  List,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { TaskItem } from '../../types/island.ts';

interface TasksTabProps {
  tasks: TaskItem[];
  onAddTask: (
    title: string,
    priority: 'low' | 'medium' | 'high',
    dueDate?: string,
    dueTime?: string
  ) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const [viewMode, setViewMode] = useState<'tasks' | 'calendar'>('tasks');
  const [newTitle, setNewTitle] = useState('');
  const [selectedDueDate, setSelectedDueDate] = useState<string>(''); // YYYY-MM-DD
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const handleAddTask = (e: React.FormEvent, customDate?: string) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const dateToUse = customDate || selectedDueDate || undefined;
    onAddTask(newTitle.trim(), 'medium', dateToUse);
    setNewTitle('');
    setSelectedDueDate('');
  };

  // Helper to format due date badge
  const getDueBadge = (dueDate?: string) => {
    if (!dueDate) return null;
    if (dueDate < todayStr) {
      return { label: 'Overdue', isOverdue: true };
    }
    if (dueDate === todayStr) {
      return { label: 'Today', isToday: true };
    }
    if (dueDate === tomorrowStr) {
      return { label: 'Tomorrow', isTomorrow: true };
    }
    const [y, m, d] = dueDate.split('-');
    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    const monthName = dateObj.toLocaleString('en-US', { month: 'short' });
    return { label: `${monthName} ${Number(d)}` };
  };

  // Sort tasks: Incomplete first, then by due date, then created
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.createdAt - a.createdAt;
  });

  // Calendar helpers
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleString('en-US', { month: 'long' });

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Day of week offset (Monday = 0)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentMonthDate(new Date());
    setSelectedCalendarDate(todayStr);
  };

  // Tasks for the selected calendar date
  const selectedDayTasks = tasks.filter(
    (t) => t.dueDate === selectedCalendarDate
  );

  return (
    <div className="flex flex-col gap-2 p-2.5 text-white">
      {/* Top Navigation Toggle: List vs Calendar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
        <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setViewMode('tasks')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              viewMode === 'tasks'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <List className="size-3" />
            <span>Tasks ({tasks.filter((t) => !t.completed).length})</span>
          </button>

          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
              viewMode === 'calendar'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="size-3" />
            <span>Calendar</span>
          </button>
        </div>

        {viewMode === 'calendar' && (
          <button
            onClick={jumpToToday}
            className="text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition font-mono"
          >
            Today
          </button>
        )}
      </div>

      {/* 1. LIST VIEW */}
      {viewMode === 'tasks' && (
        <div className="flex flex-col gap-2">
          {/* Quick Add Bar */}
          <form
            onSubmit={(e) => handleAddTask(e)}
            className="flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="What needs to be done?"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 bg-neutral-900 border-0 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30"
                autoFocus
              />
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="size-7 rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-30 flex items-center justify-center transition shrink-0 active:scale-95 font-bold"
                title="Add Task"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
              </button>
            </div>

            {/* Quick Due Date Chips */}
            <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono text-neutral-400">
              <span className="text-[9px] uppercase tracking-wider text-neutral-500 mr-0.5">
                Due:
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedDueDate(selectedDueDate === todayStr ? '' : todayStr)
                }
                className={`px-1.5 py-0.5 rounded transition ${
                  selectedDueDate === todayStr
                    ? 'bg-white text-black font-semibold'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedDueDate(
                    selectedDueDate === tomorrowStr ? '' : tomorrowStr
                  )
                }
                className={`px-1.5 py-0.5 rounded transition ${
                  selectedDueDate === tomorrowStr
                    ? 'bg-white text-black font-semibold'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                }`}
              >
                Tomorrow
              </button>
              <input
                type="date"
                value={selectedDueDate}
                onChange={(e) => setSelectedDueDate(e.target.value)}
                className="bg-white/5 hover:bg-white/10 text-neutral-300 px-1.5 py-0.5 rounded text-[10px] focus:outline-none cursor-pointer [color-scheme:dark]"
              />
              {selectedDueDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDueDate('')}
                  className="text-neutral-500 hover:text-rose-400 text-[10px] px-1"
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {/* Task List */}
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
            {sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-neutral-500 gap-1.5">
                <Sparkles className="size-4 text-neutral-600" />
                <span className="text-xs text-neutral-400">No active tasks</span>
                <span className="text-[10px] text-neutral-600">
                  Add a task or schedule a deadline
                </span>
              </div>
            ) : (
              sortedTasks.map((task) => {
                const badge = getDueBadge(task.dueDate);
                return (
                  <div
                    key={task.id}
                    className="group flex items-center justify-between gap-2 p-1.5 rounded-lg bg-neutral-950/60 hover:bg-neutral-900 transition"
                  >
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="size-3.5 text-white shrink-0" />
                      ) : (
                        <Circle className="size-3.5 text-neutral-500 group-hover:text-white shrink-0 transition" />
                      )}
                      <span
                        className={`text-xs truncate transition ${
                          task.completed
                            ? 'line-through text-neutral-500'
                            : 'text-neutral-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>

                    {/* Deadline Badge */}
                    {badge && !task.completed && (
                      <div
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${
                          badge.isOverdue
                            ? 'bg-rose-500/20 text-rose-300'
                            : badge.isToday
                            ? 'bg-white/15 text-white font-medium'
                            : 'bg-white/5 text-neutral-400'
                        }`}
                      >
                        <Clock className="size-2.5" />
                        <span>{badge.label}</span>
                      </div>
                    )}

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 p-0.5 transition active:scale-90"
                      title="Delete task"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. CALENDAR VIEW */}
      {viewMode === 'calendar' && (
        <div className="flex flex-col gap-2">
          {/* Calendar Month Header */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-white">
              {monthName} {year}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="size-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-neutral-300 transition"
              >
                <ChevronLeft className="size-3" />
              </button>
              <button
                onClick={nextMonth}
                className="size-5 rounded flex items-center justify-center bg-white/5 hover:bg-white/15 text-neutral-300 transition"
              >
                <ChevronRight className="size-3" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-mono text-neutral-500">
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
            <span>Su</span>
          </div>

          {/* Monthly Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Empty slots before day 1 */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-6" />
            ))}

            {/* Days of the Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedCalendarDate;
              const dayHasTasks = tasks.some(
                (t) => t.dueDate === dateStr && !t.completed
              );

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedCalendarDate(dateStr)}
                  className={`relative h-6 rounded-md flex flex-col items-center justify-center text-[11px] font-medium transition active:scale-95 ${
                    isToday
                      ? 'bg-white text-black font-bold shadow-sm'
                      : isSelected
                      ? 'bg-white/20 text-white ring-1 ring-white/50'
                      : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{dayNum}</span>
                  {dayHasTasks && (
                    <span
                      className={`absolute bottom-0.5 size-1 rounded-full ${
                        isToday ? 'bg-black' : 'bg-white'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Agenda & Quick Add */}
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
              <span>
                Schedule for {selectedCalendarDate === todayStr ? 'Today' : selectedCalendarDate}:
              </span>
              <span>{selectedDayTasks.length} tasks</span>
            </div>

            {/* Quick Add for Selected Date */}
            <form
              onSubmit={(e) => handleAddTask(e, selectedCalendarDate)}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                placeholder={`Add task for ${
                  selectedCalendarDate === todayStr ? 'Today' : selectedCalendarDate
                }...`}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 bg-neutral-900 border-0 rounded px-2 py-1 text-xs text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/30"
              />
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="size-6 rounded bg-white text-black hover:bg-neutral-200 disabled:opacity-30 flex items-center justify-center transition shrink-0 active:scale-95"
              >
                <Plus className="size-3 stroke-[2.5]" />
              </button>
            </form>

            {/* Tasks for Selected Day */}
            <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-0.5">
              {selectedDayTasks.length === 0 ? (
                <div className="text-[10px] text-neutral-500 py-1 text-center">
                  No tasks scheduled for this date.
                </div>
              ) : (
                selectedDayTasks.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-center justify-between gap-2 p-1 rounded bg-neutral-950/60 hover:bg-neutral-900 transition"
                  >
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="size-3 text-white shrink-0" />
                      ) : (
                        <Circle className="size-3 text-neutral-500 group-hover:text-white shrink-0 transition" />
                      )}
                      <span
                        className={`text-xs truncate transition ${
                          task.completed
                            ? 'line-through text-neutral-500'
                            : 'text-neutral-200'
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 p-0.5 transition"
                    >
                      <Trash2 className="size-2.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
