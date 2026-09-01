/**
 * memoryOptimizer.ts
 *
 * Direct Win32 memory optimization via koffi (kernel32.dll).
 * Flushes working set pages to Windows standby list when idle,
 * trimming process memory down to absolute bare minimum.
 */

export class MemoryOptimizer {
  private koffi: any = null;
  private kernel32: any = null;
  private GetCurrentProcess: any = null;
  private SetProcessWorkingSetSize: any = null;
  private isAvailable = false;
  private idleTimer: NodeJS.Timeout | null = null;
  private lastActivityTime = Date.now();

  constructor() {
    this.init();
  }

  private async init() {
    try {
      const koffiMod = await import('koffi');
      this.koffi = (koffiMod as any).default ?? koffiMod;
      this.kernel32 = this.koffi.load('kernel32.dll');

      this.GetCurrentProcess = this.kernel32.func('void* GetCurrentProcess()');
      this.SetProcessWorkingSetSize = this.kernel32.func(
        'bool SetProcessWorkingSetSize(void* hProcess, size_t dwMinimumWorkingSetSize, size_t dwMaximumWorkingSetSize)'
      );

      this.isAvailable = true;

      // Initial startup trim after 5 seconds
      setTimeout(() => {
        this.trimWorkingSet();
      }, 5000);

      // Start periodic 30s idle check
      this.startIdleWatcher();
    } catch (err) {
      console.warn('[MemoryOptimizer] Win32 memory trimming unavailable:', err);
    }
  }

  public trimWorkingSet(): boolean {
    if (!this.isAvailable || !this.GetCurrentProcess || !this.SetProcessWorkingSetSize) {
      return false;
    }

    try {
      const hProcess = this.GetCurrentProcess();
      // Passing -1, -1 tells Windows to immediately page out unused working set pages
      const success = this.SetProcessWorkingSetSize(hProcess, -1, -1);
      if (global.gc) {
        try { global.gc(); } catch {}
      }
      return !!success;
    } catch (err) {
      return false;
    }
  }

  public notifyActivity() {
    this.lastActivityTime = Date.now();
  }

  private startIdleWatcher() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      const idleTime = Date.now() - this.lastActivityTime;
      // If idle for more than 30 seconds, trim memory
      if (idleTime >= 30000) {
        this.trimWorkingSet();
      }
    }, 15000);
  }

  public dispose() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }
}

export const memoryOptimizer = new MemoryOptimizer();
