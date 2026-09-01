import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { clipboard, nativeImage } from 'electron';

export interface ScreenshotItem {
  id: string;
  filePath?: string;
  dataUrl: string;
  name: string;
  sizeBytes?: number;
  timestamp: number;
  isRecent: boolean;
}

export class ScreenshotService {
  private screenshots: ScreenshotItem[] = [];
  private watchers: fs.FSWatcher[] = [];
  private lastImageHash: string = '';
  private listeners: ((items: ScreenshotItem[]) => void)[] = [];
  private onNewScreenshotListener?: (item: ScreenshotItem) => void;

  constructor() {
    this.initWatchers();
    this.scanRecentScreenshots();
  }

  public onUpdate(listener: (items: ScreenshotItem[]) => void) {
    this.listeners.push(listener);
  }

  public onNewScreenshot(listener: (item: ScreenshotItem) => void) {
    this.onNewScreenshotListener = listener;
  }

  private getScreenshotDirs(): string[] {
    const userHome = os.homedir();
    const dirs = [
      path.join(userHome, 'Pictures', 'Screenshots'),
      path.join(userHome, 'OneDrive', 'Pictures', 'Screenshots'),
      path.join(userHome, 'Videos', 'Captures'),
    ];
    return dirs.filter((d) => fs.existsSync(d));
  }

  private initWatchers() {
    const dirs = this.getScreenshotDirs();
    for (const dir of dirs) {
      try {
        const watcher = fs.watch(dir, (eventType, filename) => {
          if (filename && (eventType === 'rename' || eventType === 'change')) {
            const ext = path.extname(filename).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
              const fullPath = path.join(dir, filename);
              // Small debounce so the OS finishes writing the file
              setTimeout(() => this.handleNewFile(fullPath), 400);
            }
          }
        });
        this.watchers.push(watcher);
      } catch {}
    }
  }

  private handleNewFile(fullPath: string) {
    try {
      if (!fs.existsSync(fullPath)) return;
      const stats = fs.statSync(fullPath);
      if (stats.size === 0) return;

      const nImage = nativeImage.createFromPath(fullPath);
      if (nImage.isEmpty()) return;

      const dataUrl = nImage.resize({ width: 300 }).toDataURL();
      const item: ScreenshotItem = {
        id: Math.random().toString(36).substring(2, 9),
        filePath: fullPath,
        dataUrl,
        name: path.basename(fullPath),
        sizeBytes: stats.size,
        timestamp: stats.mtimeMs,
        isRecent: true,
      };

      // Check if already in list
      if (!this.screenshots.some((s) => s.filePath === fullPath)) {
        this.screenshots.unshift(item);
        this.screenshots = this.screenshots.slice(0, 20);
        this.notify();
        this.onNewScreenshotListener?.(item);
      }
    } catch {}
  }

  public scanRecentScreenshots() {
    const dirs = this.getScreenshotDirs();
    for (const dir of dirs) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            const fullPath = path.join(dir, file);
            const stats = fs.statSync(fullPath);
            // Only add recent files within last 7 days
            if (Date.now() - stats.mtimeMs < 7 * 24 * 60 * 60 * 1000) {
              const nImage = nativeImage.createFromPath(fullPath);
              if (!nImage.isEmpty()) {
                const dataUrl = nImage.resize({ width: 240 }).toDataURL();
                this.screenshots.push({
                  id: Math.random().toString(36).substring(2, 9),
                  filePath: fullPath,
                  dataUrl,
                  name: file,
                  sizeBytes: stats.size,
                  timestamp: stats.mtimeMs,
                  isRecent: false,
                });
              }
            }
          }
        }
      } catch {}
    }

    this.screenshots.sort((a, b) => b.timestamp - a.timestamp);
    this.screenshots = this.screenshots.slice(0, 20);
    this.notify();
  }

  public checkClipboardImage() {
    try {
      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const dataUrl = img.resize({ width: 240 }).toDataURL();
        if (dataUrl !== this.lastImageHash) {
          this.lastImageHash = dataUrl;
          const item: ScreenshotItem = {
            id: Math.random().toString(36).substring(2, 9),
            dataUrl,
            name: `Clipboard Image ${new Date().toLocaleTimeString()}`,
            timestamp: Date.now(),
            isRecent: true,
          };
          this.screenshots.unshift(item);
          this.screenshots = this.screenshots.slice(0, 20);
          this.notify();
          this.onNewScreenshotListener?.(item);
        }
      }
    } catch {}
  }

  public deleteItem(id: string) {
    this.screenshots = this.screenshots.filter((s) => s.id !== id);
    this.notify();
  }

  public getScreenshots(): ScreenshotItem[] {
    return this.screenshots;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.screenshots);
    }
  }

  public dispose() {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
  }
}
