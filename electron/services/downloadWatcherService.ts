import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { EventEmitter } from 'node:events';

export interface ActiveDownload {
  id: string;
  tempPath: string;
  finalName: string;
  bytesDownloaded: number;
  totalBytes?: number;
  speedMbps: number;
  progressPercent: number;
  startTime: number;
  state: 'downloading' | 'completed' | 'canceled';
}

export class DownloadWatcherService extends EventEmitter {
  private downloadsDir: string;
  private watcher: fs.FSWatcher | null = null;
  private activeDownloads = new Map<string, ActiveDownload>();
  private pollInterval: NodeJS.Timeout | null = null;
  private lastFileSizes = new Map<string, number>();

  constructor() {
    super();
    this.downloadsDir = path.join(os.homedir(), 'Downloads');
    this.init();
  }

  private init() {
    if (!fs.existsSync(this.downloadsDir)) return;

    try {
      this.watcher = fs.watch(this.downloadsDir, (eventType, filename) => {
        if (!filename) return;

        const isDownloadTemp =
          filename.endsWith('.crdownload') ||
          filename.endsWith('.part') ||
          filename.endsWith('.tmp') ||
          filename.endsWith('.download');

        const fullPath = path.join(this.downloadsDir, filename);

        if (isDownloadTemp) {
          if (fs.existsSync(fullPath)) {
            // New or updating download
            if (!this.activeDownloads.has(fullPath)) {
              const cleanName = filename
                .replace('.crdownload', '')
                .replace('.part', '')
                .replace('.download', '');

              const download: ActiveDownload = {
                id: Math.random().toString(36).substring(2, 9),
                tempPath: fullPath,
                finalName: cleanName || filename,
                bytesDownloaded: 0,
                speedMbps: 0,
                progressPercent: 10,
                startTime: Date.now(),
                state: 'downloading',
              };

              this.activeDownloads.set(fullPath, download);
              this.emit('download:start', download);
            }
          } else {
            // Download finished or cancelled (file renamed)
            const existing = this.activeDownloads.get(fullPath);
            if (existing) {
              existing.state = 'completed';
              existing.progressPercent = 100;
              this.emit('download:complete', existing);
              this.activeDownloads.delete(fullPath);
              this.lastFileSizes.delete(fullPath);
            }
          }
        }
      });

      // Poll active downloads every 600ms for speed & progress calculation
      this.pollInterval = setInterval(() => this.pollProgress(), 600);
    } catch {}
  }

  private pollProgress() {
    if (this.activeDownloads.size === 0) return;

    for (const [fullPath, download] of this.activeDownloads.entries()) {
      try {
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          const currentSize = stats.size;
          const previousSize = this.lastFileSizes.get(fullPath) || currentSize;

          // Speed in MB/s
          const deltaBytes = Math.max(0, currentSize - previousSize);
          const speedMbps = Number(((deltaBytes / 1024 / 1024) * 1.6).toFixed(1)); // normalized for 600ms

          this.lastFileSizes.set(fullPath, currentSize);
          download.bytesDownloaded = currentSize;
          download.speedMbps = speedMbps;

          // Artificial asymptotic progress curve if total size is unknown
          download.progressPercent = Math.min(95, download.progressPercent + (speedMbps > 0 ? 3 : 0.5));

          this.emit('download:progress', download);
        } else {
          // Completed
          download.state = 'completed';
          download.progressPercent = 100;
          this.emit('download:complete', download);
          this.activeDownloads.delete(fullPath);
          this.lastFileSizes.delete(fullPath);
        }
      } catch {
        this.activeDownloads.delete(fullPath);
      }
    }
  }

  public dispose() {
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {}
      this.watcher = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const downloadWatcherService = new DownloadWatcherService();
