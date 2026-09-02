import React, { useState, useEffect } from 'react';
import { Trash2, Copy, Check, Inbox, UploadCloud, QrCode, Smartphone, X, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
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
  const [dragTarget, setDragTarget] = useState<'shelf' | 'drop' | null>(null);

  // Apex Drop Share Session State
  const [activeShare, setActiveShare] = useState<{
    fileName: string;
    fileSize: number;
    shareUrl: string;
    qrDataUrl: string;
    isDownloaded: boolean;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const api = (window as any).islandAPI;
    const unsub = api?.onApexDropDownloaded?.(() => {
      setActiveShare((prev) => (prev ? { ...prev, isDownloaded: true } : null));
    });
    return () => unsub?.();
  }, []);

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
    setDragTarget(null);
  };

  const handleDropOnShelf = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragTarget(null);

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

  const handleDropOnApexDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    setDragTarget(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const firstFile = files[0];
      const nativePath = (firstFile as any).path || firstFile.name;
      if (nativePath) {
        startSharingFile(nativePath, firstFile.name, firstFile.size);
      }
    }
  };

  const startSharingFile = async (filePath: string, name?: string, size?: number) => {
    const api = (window as any).islandAPI;
    if (api?.startApexDrop) {
      const session = await api.startApexDrop(filePath);
      if (session && session.shareUrl) {
        try {
          const qrDataUrl = await QRCode.toDataURL(session.shareUrl, {
            margin: 1,
            width: 130,
            color: {
              dark: '#000000',
              light: '#ffffff',
            },
          });

          setActiveShare({
            fileName: session.fileName || name || 'file',
            fileSize: session.fileSize || size || 0,
            shareUrl: session.shareUrl,
            qrDataUrl,
            isDownloaded: false,
          });
        } catch {}
      }
    }
  };

  const handleCloseShare = () => {
    const api = (window as any).islandAPI;
    api?.stopApexDrop?.();
    setActiveShare(null);
  };

  const handleCopyLink = async () => {
    if (!activeShare?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(activeShare.shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1500);
    } catch {}
  };

  const allItems = [
    ...screenshots.map((s) => ({ type: 'screenshot' as const, ...s })),
    ...shelfFiles.map((f) => ({ type: 'file' as const, ...f })),
  ];

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="flex flex-col h-full px-4 pt-1.5 pb-2.5 text-white select-none gap-1.5 relative overflow-hidden"
    >
      {/* 1. APEX DROP QR MODAL (When sharing file to phone) */}
      {activeShare ? (
        <div className="flex items-center justify-between h-full bg-neutral-950 rounded-xl p-2.5 border border-white/10 gap-3">
          {/* Left: 110px High-Contrast QR Code */}
          <div className="size-[105px] shrink-0 bg-white rounded-lg p-1.5 flex items-center justify-center shadow-md">
            <img src={activeShare.qrDataUrl} alt="QR Code" className="size-full object-contain" />
          </div>

          {/* Right: Transfer Info & Direct Link */}
          <div className="flex flex-col justify-between flex-1 min-w-0 h-full py-0.5">
            <div className="flex items-start justify-between gap-1">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="size-3 text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                    {activeShare.fileName}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 mt-0.5">
                  {activeShare.isDownloaded ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Check className="size-2.5" /> Transfer Complete!
                    </span>
                  ) : (
                    'Point phone camera to download'
                  )}
                </span>
              </div>

              <button
                onClick={handleCloseShare}
                className="p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
                title="Close"
              >
                <X className="size-3" />
              </button>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition active:scale-95 border border-white/5"
            >
              {copiedLink ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              <span>{copiedLink ? 'Link Copied' : 'Copy Direct Link'}</span>
            </button>
          </div>
        </div>
      ) : isDraggingOver ? (
        /* 2. DUAL SPLIT DROP TARGET (Shelf vs Apex Drop QR) */
        <div className="flex items-center justify-between h-full gap-2 z-20">
          {/* Target 1: Add to Shelf */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragTarget('shelf');
            }}
            onDrop={handleDropOnShelf}
            className={`flex-1 flex flex-col items-center justify-center h-full rounded-xl border-2 border-dashed transition-colors p-2 text-center ${
              dragTarget === 'shelf'
                ? 'bg-indigo-500/20 border-indigo-400'
                : 'bg-neutral-900/90 border-neutral-700 hover:border-indigo-400/60'
            }`}
          >
            <UploadCloud
              className={`size-5 mb-1 ${
                dragTarget === 'shelf' ? 'text-indigo-300 animate-bounce' : 'text-neutral-400'
              }`}
            />
            <span className="text-xs font-semibold text-white">Add to Shelf</span>
            <span className="text-[9px] text-neutral-400">Keep in Notch</span>
          </div>

          {/* Target 2: Apex Drop (Phone QR Transfer) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragTarget('drop');
            }}
            onDrop={handleDropOnApexDrop}
            className={`flex-1 flex flex-col items-center justify-center h-full rounded-xl border-2 border-dashed transition-colors p-2 text-center ${
              dragTarget === 'drop'
                ? 'bg-emerald-500/20 border-emerald-400'
                : 'bg-neutral-900/90 border-neutral-700 hover:border-emerald-400/60'
            }`}
          >
            <QrCode
              className={`size-5 mb-1 ${
                dragTarget === 'drop' ? 'text-emerald-300 animate-bounce' : 'text-neutral-400'
              }`}
            />
            <span className="text-xs font-semibold text-white">Apex Drop</span>
            <span className="text-[9px] text-neutral-400">Scan QR on Phone</span>
          </div>
        </div>
      ) : allItems.length === 0 ? (
        /* 3. EMPTY STATE */
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-neutral-900/60 border border-neutral-800 text-center p-2">
          <Inbox className="size-5 text-neutral-500 mb-1" />
          <span className="text-xs font-medium text-neutral-300">Shelf is Empty</span>
          <span className="text-[10px] text-neutral-500">
            Drag files here to stage or drop onto Apex Drop
          </span>
        </div>
      ) : (
        /* 4. SHELF GRID ITEMS */
        <div className="grid grid-cols-4 gap-2 flex-1 overflow-y-auto pr-0.5 custom-scrollbar">
          {allItems.map((item) => (
            <div
              key={item.id}
              draggable={!!(item as any).filePath}
              onDragStart={() => (item as any).filePath && handleStartDrag((item as any).filePath)}
              className="group relative aspect-video rounded-xl bg-neutral-900 overflow-hidden border border-white/5 cursor-grab active:cursor-grabbing hover:border-white/20 transition flex items-center justify-center shrink-0"
            >
              {item.type === 'screenshot' && (item as any).dataUrl ? (
                <img src={(item as any).dataUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="text-[9px] text-neutral-300 truncate max-w-[60px] px-1 font-mono">
                  {item.name}
                </span>
              )}

              <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1.5">
                {item.type === 'screenshot' && (
                  <button
                    onClick={() => copyScreenshot(item as any)}
                    className="p-1 rounded-full bg-white/20 text-white hover:bg-white/40 transition"
                    title="Copy Image"
                  >
                    {copiedId === item.id ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                  </button>
                )}

                {(item as any).filePath && (
                  <button
                    onClick={() => startSharingFile((item as any).filePath, item.name)}
                    className="p-1 rounded-full bg-indigo-500/30 text-indigo-300 hover:bg-indigo-500/50 transition"
                    title="Share with Apex Drop QR"
                  >
                    <QrCode className="size-2.5" />
                  </button>
                )}

                <button
                  onClick={() =>
                    item.type === 'screenshot'
                      ? onDeleteScreenshot(item.id)
                      : onRemoveShelfFile(item.id)
                  }
                  className="p-1 rounded-full bg-white/20 text-rose-300 hover:bg-rose-500/40 transition"
                  title="Remove"
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
