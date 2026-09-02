import React, { useState } from 'react';
import { Trash2, Copy, Check, Inbox, UploadCloud } from 'lucide-react';
import { ScreenshotEntry, ShelfEntry } from '../../types/island.ts';

interface ShelfTabProps {
  screenshots: ScreenshotEntry[];
  shelfFiles: ShelfEntry[];
  onDeleteScreenshot: (id: string) => void;
  onRemoveShelfFile: (id: string) => void;
  onAddShelfFile?: (filePath: string) => void;
}

export const ShelfTab: React.FC<ShelfTabProps> = ({
  screenshots,
  shelfFiles,
  onDeleteScreenshot,
  onRemoveShelfFile,
  onAddShelfFile,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const copyScreenshot = async (item: ScreenshotEntry) => {
    try {
      if (item.dataUrl) {
        const res = await fetch(item.dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch {}
  };

  const handleStartDrag = (filePath: string) => {
    const api = (window as any).islandAPI;
    api?.startDrag?.(filePath);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      for (const file of files) {
        const nativePath = (file as any).path || file.name;
        if (nativePath) {
          onAddShelfFile?.(nativePath);
        }
      }
    }
  };

  const allItems = [
    ...screenshots.map((s) => ({ type: 'screenshot' as const, ...s })),
    ...shelfFiles.map((f) => ({ type: 'file' as const, ...f })),
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col h-full px-3.5 pt-1.5 pb-2.5 text-white select-none gap-1.5 relative overflow-hidden"
    >
      {isDraggingOver ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-neutral-900 border-2 border-dashed border-indigo-400 text-center p-2">
          <UploadCloud className="size-5 text-indigo-400 animate-bounce" />
          <span className="text-xs font-semibold text-white mt-1">Drop to stage file</span>
        </div>
      ) : allItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-neutral-900/60 border border-neutral-800 text-center p-2">
          <Inbox className="size-5 text-neutral-500 mb-1" />
          <span className="text-xs font-medium text-neutral-300">Shelf is Empty</span>
          <span className="text-[10px] text-neutral-500">Drag files here to stage or copy</span>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
          {allItems.map((item) => (
            <div
              key={item.id}
              draggable={!!(item as any).filePath}
              onDragStart={() => (item as any).filePath && handleStartDrag((item as any).filePath)}
              className="group relative aspect-video rounded-lg bg-neutral-900 overflow-hidden border border-white/5 cursor-grab active:cursor-grabbing hover:border-white/20 transition flex items-center justify-center shrink-0"
            >
              {item.type === 'screenshot' && (item as any).dataUrl ? (
                <img src={(item as any).dataUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-[9px] text-neutral-300 truncate max-w-[60px] px-1 font-mono">
                  {item.name}
                </span>
              )}

              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
                {item.type === 'screenshot' && (
                  <button
                    onClick={() => copyScreenshot(item as any)}
                    className="p-1 rounded-full bg-white/20 text-white hover:bg-white/40 transition"
                  >
                    {copiedId === item.id ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                  </button>
                )}
                <button
                  onClick={() =>
                    item.type === 'screenshot'
                      ? onDeleteScreenshot(item.id)
                      : onRemoveShelfFile(item.id)
                  }
                  className="p-1 rounded-full bg-white/20 text-rose-300 hover:bg-rose-500/40 transition"
                >
                  <Trash2 className="size-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
