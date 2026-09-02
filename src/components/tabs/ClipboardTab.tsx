import React, { useState } from 'react';
import { Pin, Trash2, Copy, Check } from 'lucide-react';
import { ClipboardEntry } from '../../types/island.ts';

interface ClipboardTabProps {
  items: ClipboardEntry[];
  onCopy: (content: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClear: () => void;
}

export const ClipboardTab: React.FC<ClipboardTabProps> = ({
  items,
  onCopy,
  onDelete,
  onTogglePin,
  onClear,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (item: ClipboardEntry) => {
    onCopy(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const visibleItems = items.slice(0, 3);

  return (
    <div className="flex flex-col justify-between h-full px-3.5 pt-1.5 pb-3 text-white select-none overflow-hidden gap-1.5">
      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[11px] text-neutral-400">
        <span>Recent Clips ({items.length})</span>
        {items.length > 0 && (
          <button onClick={onClear} className="hover:text-rose-400 text-[10px] transition">
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 overflow-hidden flex-1 justify-center">
        {visibleItems.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-neutral-500 text-[11px]">
            Clipboard history is empty
          </div>
        ) : (
          visibleItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-850 border border-white/5 transition"
            >
              <div
                onClick={() => handleCopy(item)}
                className="text-xs text-neutral-200 font-mono truncate flex-1 cursor-pointer hover:text-white"
              >
                {item.isSensitive ? '••••••••••••••••' : item.content}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onTogglePin(item.id)}
                  className={`p-0.5 ${item.isPinned ? 'text-amber-400' : 'text-neutral-500 hover:text-white'}`}
                >
                  <Pin className="size-3" />
                </button>
                <button
                  onClick={() => handleCopy(item)}
                  className="p-0.5 text-neutral-400 hover:text-white"
                >
                  {copiedId === item.id ? <Check className="size-3 text-white" /> : <Copy className="size-3" />}
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-0.5 text-neutral-500 hover:text-rose-400"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
