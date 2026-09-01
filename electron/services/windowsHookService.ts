/**
 * windowsHookService.ts
 *
 * Deep Win32 OS integration via koffi (pure-JS FFI, 0ms overhead, 0 subprocesses).
 * Provides foreground app detection, volume monitoring, screen lock detection.
 */

import { EventEmitter } from 'node:events';

export interface ForegroundAppInfo {
  processName: string;
  windowTitle: string;
  pid: number;
  isFullscreen: boolean;
}

export interface VolumeInfo {
  level: number;
  isMuted: boolean;
}

export interface ScreenState {
  isLocked: boolean;
}

export class WindowsHookService extends EventEmitter {
  private koffi: any = null;
  private user32: any = null;
  private kernel32: any = null;
  private psapi: any = null;
  private winmm: any = null;

  private lastForegroundPid = -1;
  private lastWindowTitle = '';
  private lastVolumeLevel = -1;
  private lastMuted: boolean | null = null;
  private lastScreenLocked = false;
  private lastIsFullscreen = false;

  private fgTimer: NodeJS.Timeout | null = null;
  private volTimer: NodeJS.Timeout | null = null;
  private lockTimer: NodeJS.Timeout | null = null;

  public isAvailable = false;

  private GetForegroundWindow: any = null;
  private GetWindowTextW: any = null;
  private GetWindowThreadProcessId: any = null;
  private IsZoomed: any = null;
  private OpenProcess: any = null;
  private CloseHandle: any = null;
  private GetModuleFileNameExW: any = null;
  private waveOutGetVolume: any = null;
  private OpenInputDesktop: any = null;
  private CloseDesktop: any = null;

  constructor() {
    super();
    this.init().catch(() => this.startFallbackPolling());
  }

  private async init() {
    try {
      const koffiMod = await import('koffi');
      this.koffi = (koffiMod as any).default ?? koffiMod;

      this.user32 = this.koffi.load('user32.dll');
      this.kernel32 = this.koffi.load('kernel32.dll');

      this.GetForegroundWindow = this.user32.func('HWND GetForegroundWindow()');
      this.GetWindowTextW = this.user32.func(
        'int GetWindowTextW(HWND hWnd, char16 *lpString, int nMaxCount)'
      );
      this.GetWindowThreadProcessId = this.user32.func(
        'uint GetWindowThreadProcessId(HWND hWnd, _Out_ uint *lpdwProcessId)'
      );
      this.IsZoomed = this.user32.func('int IsZoomed(HWND hWnd)');
      this.OpenProcess = this.kernel32.func(
        'void* OpenProcess(uint dwAccess, int bInherit, uint dwPid)'
      );
      this.CloseHandle = this.kernel32.func('int CloseHandle(void* h)');

      try {
        this.OpenInputDesktop = this.user32.func(
          'void* OpenInputDesktop(uint dwFlags, int fInherit, uint dwDesiredAccess)'
        );
        this.CloseDesktop = this.user32.func('int CloseDesktop(void* hDesktop)');
      } catch {}

      try {
        this.psapi = this.koffi.load('psapi.dll');
        this.GetModuleFileNameExW = this.psapi.func(
          'uint GetModuleFileNameExW(void* hProcess, void* hModule, char16 *lpFilename, uint nSize)'
        );
      } catch {}

      try {
        this.winmm = this.koffi.load('winmm.dll');
        this.waveOutGetVolume = this.winmm.func(
          'uint waveOutGetVolume(void* hwo, _Out_ uint *pdwVolume)'
        );
      } catch {}

      this.isAvailable = true;
      this.startForegroundHook();
      this.startVolumeHook();
      this.startScreenLockHook();
    } catch (err) {
      console.warn('[WindowsHookService] Koffi init failed:', err);
      this.startFallbackPolling();
    }
  }

  // ── 1. FOREGROUND APP (120ms - native Win32 GetForegroundWindow) ──────────
  private startForegroundHook() {
    const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    const poll = () => {
      try {
        const hwnd = this.GetForegroundWindow();
        if (!hwnd) return;

        const pidOut = [0];
        this.GetWindowThreadProcessId(hwnd, pidOut);
        const pid: number = pidOut[0];
        if (pid === 0) return;

        const titleBuf = Buffer.alloc(512);
        this.GetWindowTextW(hwnd, titleBuf, 256);
        const windowTitle = titleBuf
          .toString('utf16le')
          .split('\0')[0]
          .trim();

        const isFullscreen = this.IsZoomed(hwnd) === 1;

        let processName = '';
        if (this.GetModuleFileNameExW) {
          const hProc = this.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
          if (hProc) {
            const pathBuf = Buffer.alloc(1024);
            try {
              this.GetModuleFileNameExW(hProc, null, pathBuf, 512);
              const fullPath = pathBuf
                .toString('utf16le')
                .split('\0')[0]
                .trim();
              processName = fullPath.split('\\').pop() || fullPath;
            } finally {
              this.CloseHandle(hProc);
            }
          }
        }

        const changed =
          pid !== this.lastForegroundPid ||
          windowTitle !== this.lastWindowTitle ||
          isFullscreen !== this.lastIsFullscreen;

        if (changed) {
          this.lastForegroundPid = pid;
          this.lastWindowTitle = windowTitle;
          this.lastIsFullscreen = isFullscreen;
          this.emit('foreground', {
            processName,
            windowTitle,
            pid,
            isFullscreen,
          } as ForegroundAppInfo);
        }
      } catch {}
    };

    this.fgTimer = setInterval(poll, 120);
    poll();
  }

  // ── 2. VOLUME (400ms - waveOutGetVolume Win32) ────────────────────────────
  private startVolumeHook() {
    const poll = () => {
      try {
        if (!this.waveOutGetVolume) return;
        const volOut = [0];
        this.waveOutGetVolume(null, volOut);
        const rawVol: number = volOut[0];
        const level = Math.round(((rawVol & 0xffff) / 0xffff) * 100);
        const isMuted = level === 0;

        if (level !== this.lastVolumeLevel || isMuted !== this.lastMuted) {
          this.lastVolumeLevel = level;
          this.lastMuted = isMuted;
          this.emit('volume', { level, isMuted } as VolumeInfo);
        }
      } catch {}
    };

    this.volTimer = setInterval(poll, 400);
    poll();
  }

  // ── 3. SCREEN LOCK (Native Win32 OpenInputDesktop - 0 subprocesses) ─────────
  private startScreenLockHook() {
    const DESKTOP_SWITCHDESKTOP = 0x0100;

    const poll = () => {
      try {
        let isLocked = false;
        if (this.OpenInputDesktop) {
          const hDesk = this.OpenInputDesktop(0, 0, DESKTOP_SWITCHDESKTOP);
          if (!hDesk) {
            isLocked = true;
          } else if (this.CloseDesktop) {
            this.CloseDesktop(hDesk);
          }
        }

        if (isLocked !== this.lastScreenLocked) {
          this.lastScreenLocked = isLocked;
          this.emit('screenlock', { isLocked } as ScreenState);
        }
      } catch {}
    };

    this.lockTimer = setInterval(poll, 1000);
    poll();
  }

  // ── FALLBACK ──────────────────────────────────────────────────────────────
  private startFallbackPolling() {
    this.isAvailable = false;
  }

  public dispose() {
    if (this.fgTimer) clearInterval(this.fgTimer);
    if (this.volTimer) clearInterval(this.volTimer);
    if (this.lockTimer) clearInterval(this.lockTimer);
  }
}

export const windowsHookService = new WindowsHookService();
