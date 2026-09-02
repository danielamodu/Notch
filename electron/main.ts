import { app, BrowserWindow, ipcMain, screen, globalShortcut, shell, powerMonitor, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WindowsMediaService } from './services/mediaService.ts';
import { ClipboardService } from './services/clipboardService.ts';
import { ScreenshotService } from './services/screenshotService.ts';
import { ShelfService } from './services/shelfService.ts';
import { systemService } from './services/systemService.ts';
import { notificationService } from './services/notificationService.ts';
import { agentWatcherService } from './services/agentWatcherService.ts';
import { agentGatewayService } from './services/agentGatewayService.ts';
import { windowsHookService } from './services/windowsHookService.ts';
import { memoryOptimizer } from './services/memoryOptimizer.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, '..');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null = null;

// Services
const mediaService = new WindowsMediaService();
const clipboardService = new ClipboardService();
const screenshotService = new ScreenshotService();
const shelfService = new ShelfService();

const WINDOW_WIDTH = 460;
const WINDOW_HEIGHT = 320;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: displayX, y: displayY, width: screenWidth } = primaryDisplay.bounds;

  // TOP DYNAMIC ISLAND WINDOW (Stable transparent overlay viewport)
  const xPos = displayX + Math.round((screenWidth - WINDOW_WIDTH) / 2);
  const yPos = displayY;

  win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: xPos,
    y: yPos,
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: true,
    webPreferences: {
      preload: path.join(process.env.APP_ROOT, 'electron', 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver', 1);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.moveTop();
  win.setMenu(null);

  win.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
    console.error(`[Renderer] Failed to load: ${errorDescription} (${errorCode})`);
  });

  win.webContents.on('console-message', (e, level, message) => {
    if (level >= 2) {
      console.error(`[Renderer Error]: ${message}`);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(RENDERER_DIST, 'index.html');
    win.loadFile(indexPath);
  }

  // ── Services & Event Broadcasters ──────────────────────────────────────────
  mediaService.onUpdate((track) => {
    win?.webContents.send('media:update', track);
  });
  mediaService.startPolling(700);

  clipboardService.onUpdate((items) => {
    win?.webContents.send('clipboard:update', items);
  });
  clipboardService.startPolling(1200);

  screenshotService.onUpdate((items) => {
    win?.webContents.send('screenshots:update', items);
  });
  screenshotService.onNewScreenshot((item) => {
    win?.webContents.send('screenshots:new', item);
  });

  shelfService.onUpdate((files) => {
    win?.webContents.send('shelf:update', files);
  });

  // System stats & 5s polling
  systemService.onUpdate((stats) => {
    win?.webContents.send('system:update', stats);
  });
  systemService.onPowerEvent((event) => {
    win?.webContents.send('system:power', event);
  });
  systemService.startPolling(5000);

  // Hook into native Windows Power Events via Electron's powerMonitor
  powerMonitor.on('on-ac', () => {
    systemService.poll();
  });
  powerMonitor.on('on-battery', () => {
    systemService.poll();
  });
  powerMonitor.on('speed-limit-change', () => {
    systemService.poll();
  });

  notificationService.onNewNotification((notif) => {
    win?.webContents.send('notifications:new', notif);
  });
  notificationService.onCallStatusChange((call) => {
    win?.webContents.send('call:update', call);
  });
  notificationService.startPolling(600);

  agentWatcherService.onUpdate((state) => {
    win?.webContents.send('agent:update', state);
  });
  agentWatcherService.startPolling(500);

  // Universal Agent Status Gateway (HTTP Server on port 4141)
  agentGatewayService.onUpdate((state) => {
    win?.webContents.send('agent:update', state);
  });

  // ── Windows Deep Hook Events (koffi Win32 FFI) ──────────────────────────
  windowsHookService.on('foreground', (info) => {
    win?.webContents.send('hook:foreground', info);
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.moveTop();
    }
  });

  // Persistent top-most enforcer (guarantees island is permanently visible on top of all apps)
  setInterval(() => {
    if (win && !win.isDestroyed()) {
      win.moveTop();
    }
  }, 1000);

  windowsHookService.on('volume', (vol) => {
    win?.webContents.send('hook:volume', vol);
  });
  windowsHookService.on('screenlock', (state) => {
    win?.webContents.send('hook:screenlock', state);
  });

  // Register global hotkey
  globalShortcut.register('Alt+`', () => {
    win?.webContents.send('hotkey:toggle');
  });
}

// ── Window sizing & mouse IPC ──────────────────────────────────────────────
ipcMain.handle('island:setState', () => {
  // Stable 460x320 viewport canvas: React animates layout internally
});

// Click-through: Top Island
ipcMain.handle('island:setIgnoreMouseEvents', (_, ignore: boolean, forward?: { forward: boolean }) => {
  win?.setIgnoreMouseEvents(ignore, forward);
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('app:openExternal', (_, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('app:showItemInFolder', (_, filePath: string) => {
  shell.showItemInFolder(filePath);
});

// Media IPC
ipcMain.handle('media:get', () => mediaService.getCurrentTrack());
ipcMain.handle('media:control', (_, action: 'play' | 'pause' | 'toggle' | 'next' | 'previous') =>
  mediaService.controlMedia(action)
);

// Clipboard IPC
ipcMain.handle('clipboard:get', () => clipboardService.getHistory());
ipcMain.handle('clipboard:copy', (_, content: string) => clipboardService.copyItem(content));
ipcMain.handle('clipboard:togglePin', (_, id: string) => clipboardService.togglePin(id));
ipcMain.handle('clipboard:delete', (_, id: string) => clipboardService.removeItem(id));
ipcMain.handle('clipboard:clear', () => clipboardService.clearAll());

// Screenshots IPC
ipcMain.handle('screenshots:get', () => screenshotService.getScreenshots());
ipcMain.handle('screenshots:delete', (_, id: string) => screenshotService.deleteItem(id));

// Shelf IPC
ipcMain.handle('shelf:get', () => shelfService.getFiles());
ipcMain.handle('shelf:add', (_, filePath: string) => shelfService.addFile(filePath));
ipcMain.handle('shelf:remove', (_, id: string) => shelfService.removeFile(id));
ipcMain.handle('shelf:clear', () => shelfService.clearAll());

ipcMain.on('shelf:startDrag', async (event, filePath: string) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return;

    let dragIcon: Electron.NativeImage | null = null;
    const ext = path.extname(filePath).toLowerCase();

    // 1. If it's an image file, use the actual image thumbnail
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(ext)) {
      try {
        const img = nativeImage.createFromPath(filePath);
        if (!img.isEmpty()) {
          dragIcon = img.resize({ width: 32, height: 32 });
        }
      } catch {}
    }

    // 2. Otherwise fetch the native OS file icon via app.getFileIcon
    if (!dragIcon || dragIcon.isEmpty()) {
      try {
        dragIcon = await app.getFileIcon(filePath, { size: 'normal' });
      } catch {}
    }

    // 3. Fallback: transparent 1x1 image so startDrag never throws
    if (!dragIcon || dragIcon.isEmpty()) {
      dragIcon = nativeImage.createFromBuffer(
        Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
      );
    }

    event.sender.startDrag({
      file: filePath,
      icon: dragIcon,
    });
  } catch (err) {
    console.warn('[Shelf] Drag error:', err);
  }
});

// System IPC
ipcMain.handle('system:get', () => systemService.getStats());
ipcMain.handle('system:trimMemory', () => memoryOptimizer.trimWorkingSet());

// Git Status IPC
ipcMain.handle('git:getStatus', async () => {
  return new Promise((resolve) => {
    import('node:child_process').then(({ exec }) => {
      exec('git branch --show-current', { cwd: process.cwd() }, (err, branchOut) => {
        const branch = branchOut ? branchOut.trim() : '';
        if (!branch) return resolve(null);
        exec('git status --porcelain', { cwd: process.cwd() }, (err2, statusOut) => {
          const modifiedCount = statusOut ? statusOut.trim().split('\n').filter(Boolean).length : 0;
          resolve({
            branch,
            modifiedCount,
            isClean: modifiedCount === 0,
          });
        });
      });
    }).catch(() => resolve(null));
  });
});

// Network Ping IPC
ipcMain.handle('network:getPing', async () => {
  const start = Date.now();
  try {
    const res = await fetch('https://1.1.1.1', { method: 'HEAD', signal: AbortSignal.timeout(1200) });
    const latency = Date.now() - start;
    return { latency: Math.min(latency, 999), online: res.ok };
  } catch {
    return { latency: null, online: false };
  }
});

// Apex Drop (QR Wi-Fi Phone Transfer) IPC
import { apexDropService } from './services/apexDropService.ts';

ipcMain.handle('drop:startShare', async (_, filePath: string) => {
  return await apexDropService.startShare(filePath);
});

ipcMain.handle('drop:stopShare', () => {
  apexDropService.stopShare();
});

apexDropService.onDownload(() => {
  win?.webContents.send('drop:downloaded');
});

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  mediaService.stopPolling();
  clipboardService.stopPolling();
  screenshotService.dispose();
  systemService.stopPolling();
  notificationService.stopPolling();
  agentWatcherService.stopPolling();
  agentGatewayService.dispose();
  memoryOptimizer.dispose();
  windowsHookService.dispose();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
