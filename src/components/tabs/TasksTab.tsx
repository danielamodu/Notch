import React, { useState } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import { TaskItem } from '../../types/island.ts';

interface TasksTabProps {
  tasks: TaskItem[];
  onAddTask: (title: string, priority: 'low' | 'medium' | 'high', dueDate?: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}) => {
  const [newTitle, setNewTitle] = useState('');

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask(newTitle.trim(), 'medium');
    setNewTitle('');
  };

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const visibleTasks = [...pendingTasks, ...completedTasks].slice(0, 3);

  return (
    <div className="flex flex-col justify-between h-full px-4 pt-1 pb-3 text-white select-none overflow-hidden gap-2">
      {/* 1. Quick Add Input Bar */}
      <form
        onSubmit={handleAddTask}
        className="flex items-center justify-between bg-white/[0.06] border border-white/[0.08] rounded-full px-3 py-1.5 transition-colors focus-within:border-white/20 focus-within:bg-white/[0.09]"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 mr-1.5">
          <Plus className="size-3 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Add new task..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full bg-transparent border-0 text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className="text-[11px] font-semibold text-neutral-400 hover:text-white disabled:opacity-30 transition px-2 py-0.5 rounded-full hover:bg-white/10"
        >
          Add
        </button>
      </form>

      {/* 2. Compact Seamless Tasks List */}
      <div className="flex flex-col gap-1 overflow-hidden flex-1 justify-center">
        {visibleTasks.length === 0 ? (
          <div className="flex items-center justify-center text-neutral-500 text-[11px] py-4">
            No active tasks. Add one above!
          </div>
        ) : (
          visibleTasks.map((task) => (
            <div
              key={task.id}
              className={`group flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl hover:bg-white/[0.06] transition ${
                task.completed ? 'opacity-40' : 'opacity-100'
              }`}
            >
              <button
                onClick={() => onToggleTask(task.id)}
                className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
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
              </button>

              <button
                onClick={() => onDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-rose-400 transition p-1 rounded-md hover:bg-white/10"
                title="Delete"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
