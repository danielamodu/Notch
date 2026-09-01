import React, { useState } from 'react';
import { FolderOpen, Copy, Trash2, Image as ImageIcon, Check, UploadCloud } from 'lucide-react';
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
  const [activeSection, setActiveSection] = useState<'screenshots' | 'shelf'>('screenshots');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const copyScreenshot = async (item: ScreenshotEntry) => {
    try {
      if (item.dataUrl) {
        const res = await fetch(item.dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
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

  const handleDragEnter = (e: React.DragEvent) => {
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
      setActiveSection('shelf');
      for (const file of files) {
        const nativePath = (file as any).path || file.name;
        if (nativePath) {
          onAddShelfFile?.(nativePath);
        }
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col gap-2 p-2.5 text-white transition-colors duration-150 rounded-lg ${
        isDraggingOver ? 'bg-indigo-500/10 border-2 border-dashed border-indigo-400/60' : ''
      }`}
    >
      {/* Drop Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-indigo-400/40">
          <UploadCloud className="size-6 text-indigo-400 animate-bounce" />
          <span className="text-xs font-semibold text-white">Drop files to stage in Shelf</span>
        </div>
      )}

      {/* Mini Toggle */}
      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSection('screenshots')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
              activeSection === 'screenshots' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Screenshots ({screenshots.length})
          </button>
          <button
            onClick={() => setActiveSection('shelf')}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
              activeSection === 'shelf' ? 'bg-white/15 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Files ({shelfFiles.length})
          </button>
        </div>
        <span className="text-[9px] font-mono text-neutral-500">Win+Shift+S</span>
      </div>

      {/* Grid of Screenshots */}
      {activeSection === 'screenshots' ? (
        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
          {screenshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-neutral-500 gap-1">
              <ImageIcon className="size-4 text-neutral-600" />
              <span className="text-[11px]">No screenshots yet</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {screenshots.map((s) => (
                <div
                  key={s.id}
                  draggable={!!s.filePath}
                  onDragStart={() => s.filePath && handleStartDrag(s.filePath)}
                  className="group relative rounded-lg bg-neutral-900 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing hover:ring-1 hover:ring-white/20 transition"
                >
                  <div className="aspect-video w-full bg-black/40 overflow-hidden flex items-center justify-center">
                    <img src={s.dataUrl} alt="" className="size-full object-cover" />
                  </div>
                  <div className="p-1 flex items-center justify-between bg-neutral-950/90 text-[10px]">
                    <span className="truncate text-neutral-300 max-w-[80px]">{s.name}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyScreenshot(s)}
                        className="p-0.5 text-neutral-400 hover:text-white"
                        title="Copy Image"
                      >
                        {copiedId === s.id ? <Check className="size-3 text-white" /> : <Copy className="size-3" />}
                      </button>
                      <button
                        onClick={() => onDeleteScreenshot(s.id)}
                        className="p-0.5 text-neutral-500 hover:text-rose-400"
                        title="Delete Screenshot"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5">
          {shelfFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-neutral-500 gap-1 border border-dashed border-white/10 rounded-lg">
              <FolderOpen className="size-4 text-neutral-600" />
              <span className="text-[11px]">Drop files or images here</span>
            </div>
          ) : (
            shelfFiles.map((file) => (
              <div
                key={file.id}
                draggable
                onDragStart={() => handleStartDrag(file.filePath)}
                className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-neutral-900 text-xs cursor-grab active:cursor-grabbing hover:bg-neutral-800 transition"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <FolderOpen className="size-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate text-neutral-200">{file.name}</span>
                </div>
                <button
                  onClick={() => onRemoveShelfFile(file.id)}
                  className="text-neutral-500 hover:text-rose-400 p-0.5"
                  title="Remove from Shelf"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
