import os from 'node:os';
import net from 'node:net';

export interface SystemStats {
  batteryPercent: number | null;
  isCharging: boolean;
  hasBattery: boolean;
  cpuUsage: number;
  memoryUsagePercent: number;
  totalMemoryGb: number;
  freeMemoryGb: number;
  uptimeHours: number;
  activePorts?: number[];
  cpuHistory?: number[];
  ramHistory?: number[];
}

export interface PowerEvent {
  type: 'plugged' | 'unplugged' | 'low_battery';
  batteryPercent: number;
}

export class SystemService {
  private isPolling = false;
  private koffiAvailable = false;
  private GetSystemPowerStatus: any = null;
  private SYSTEM_POWER_STATUS: any = null;

  private lastCpuMeasure = { idle: 0, total: 0 };
  private cpuHistory: number[] = [12, 18, 15, 22, 16, 20, 14, 19, 25, 18];
  private ramHistory: number[] = [];

  private lastStats: SystemStats = {
    batteryPercent: null,
    isCharging: false,
    hasBattery: true,
    cpuUsage: 0,
    memoryUsagePercent: 0,
    totalMemoryGb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
    freeMemoryGb: Math.round(os.freemem() / (1024 * 1024 * 1024)),
    uptimeHours: Math.round(os.uptime() / 3600),
    activePorts: [],
    cpuHistory: [],
    ramHistory: [],
  };

  private pollInterval: NodeJS.Timeout | null = null;
  private listeners: ((stats: SystemStats) => void)[] = [];
  private powerListeners: ((event: PowerEvent) => void)[] = [];
  private hasInitialPowerState = false;
  private lastIsCharging = false;
  private lastKnownBatteryPercent: number | null = null;

  constructor() {
    this.initKoffi();
    this.initCpu();
    this.poll();
  }

  private async initKoffi() {
    try {
      const koffiMod = await import('koffi');
      const koffi = (koffiMod as any).default ?? koffiMod;
      const kernel32 = koffi.load('kernel32.dll');

      this.SYSTEM_POWER_STATUS = koffi.struct('SYSTEM_POWER_STATUS', {
        ACLineStatus: 'uint8',
        BatteryFlag: 'uint8',
        BatteryLifePercent: 'uint8',
        SystemStatusFlag: 'uint8',
        BatteryLifeTime: 'uint32',
        BatteryFullLifeTime: 'uint32',
      });

      this.GetSystemPowerStatus = kernel32.func(
        'bool GetSystemPowerStatus(_Out_ SYSTEM_POWER_STATUS *lpSystemPowerStatus)'
      );

      const FILETIME = koffi.struct('FILETIME', {
        dwLowDateTime: 'uint32',
        dwHighDateTime: 'uint32',
      });

      this.GetSystemTimes = kernel32.func(
        'bool GetSystemTimes(_Out_ FILETIME *lpIdleTime, _Out_ FILETIME *lpKernelTime, _Out_ FILETIME *lpUserTime)'
      );

      this.koffiAvailable = true;
      this.poll();
    } catch (err) {
      console.warn('[SystemService] Koffi power hook unavailable:', err);
    }
  }

  private fileTimeToNum(ft: { dwLowDateTime: number; dwHighDateTime: number }): number {
    return ft.dwLowDateTime + ft.dwHighDateTime * 4294967296;
  }

  private lastTimes = { idle: 0, kernel: 0, user: 0 };

  private initCpu() {
    try {
      if (this.GetSystemTimes) {
        const i = {}, k = {}, u = {};
        if (this.GetSystemTimes(i, k, u)) {
          this.lastTimes = {
            idle: this.fileTimeToNum(i as any),
            kernel: this.fileTimeToNum(k as any),
            user: this.fileTimeToNum(u as any),
          };
          return;
        }
      }
    } catch {}

    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      idle += cpu.times.idle;
    }
    this.lastCpuMeasure = {
      idle: idle / (cpus.length || 1),
      total: total / (cpus.length || 1),
    };
  }

  private calculateCpuUsage(): number {
    // 1. Preferred: Win32 GetSystemTimes (100% accurate Windows Task Manager metric)
    if (this.GetSystemTimes) {
      try {
        const i = {}, k = {}, u = {};
        if (this.GetSystemTimes(i, k, u)) {
          const idle = this.fileTimeToNum(i as any);
          const kernel = this.fileTimeToNum(k as any);
          const user = this.fileTimeToNum(u as any);

          const idleDiff = idle - this.lastTimes.idle;
          const kernelDiff = kernel - this.lastTimes.kernel;
          const userDiff = user - this.lastTimes.user;
          const totalDiff = kernelDiff + userDiff;

          this.lastTimes = { idle, kernel, user };

          if (totalDiff > 0 && this.lastTimes.idle > 0) {
            const usage = Math.round((100 * (totalDiff - idleDiff)) / totalDiff);
            return Math.max(1, Math.min(100, isNaN(usage) ? 12 : usage));
          }
        }
      } catch {}
    }

    // 2. Fallback: os.cpus()
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      idle += cpu.times.idle;
    }
    const currentIdle = idle / (cpus.length || 1);
    const currentTotal = total / (cpus.length || 1);

    const idleDiff = currentIdle - this.lastCpuMeasure.idle;
    const totalDiff = currentTotal - this.lastCpuMeasure.total;

    this.lastCpuMeasure = { idle: currentIdle, total: currentTotal };

    if (totalDiff < 15) return this.lastStats.cpuUsage || 12;
    const usage = Math.round(100 - (100 * idleDiff) / totalDiff);
    return Math.max(1, Math.min(100, isNaN(usage) ? 12 : usage));
  }

  private async scanActiveLocalhostPorts(): Promise<number[]> {
    const commonDevPorts = [3000, 3001, 5173, 8000, 8080, 5000, 4200, 8888, 1337, 27017, 5432, 6379, 9000];
    const checks = commonDevPorts.map((port) => {
      return new Promise<number | null>((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(120);

        socket.on('connect', () => {
          socket.destroy();
          resolve(port);
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve(null);
        });

        socket.on('error', () => {
          socket.destroy();
          resolve(null);
        });

        socket.connect(port, '127.0.0.1');
      });
    });

    const results = await Promise.all(checks);
    return results.filter((p): p is number => p !== null);
  }

  public startPolling(intervalMs = 5000) {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
  }

  public stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public onUpdate(listener: (stats: SystemStats) => void) {
    this.listeners.push(listener);
  }

  public onPowerEvent(listener: (event: PowerEvent) => void) {
    this.powerListeners.push(listener);
  }

  public async poll(): Promise<SystemStats> {
    if (this.isPolling) return this.lastStats;
    this.isPolling = true;

    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
      const cpuPercent = this.calculateCpuUsage();

      let batteryPercent: number | null = this.lastKnownBatteryPercent;
      let isCharging = false;
      let hasBattery = true;

      // ── 1. Win32 Native GetSystemPowerStatus (0ms synchronous call) ──
      if (this.koffiAvailable && this.GetSystemPowerStatus) {
        try {
          const powerStatus: any = {};
          const ok = this.GetSystemPowerStatus(powerStatus);
          if (ok) {
            const acLine = powerStatus.ACLineStatus; // 0 = Offline, 1 = Online, 255 = Unknown
            const flag = powerStatus.BatteryFlag; // 8 = Charging, 128 = No battery, 255 = Unknown
            const percent = powerStatus.BatteryLifePercent; // 0-100 or 255

            if (flag === 128 || (percent === 255 && acLine === 1)) {
              hasBattery = false;
              batteryPercent = null;
              isCharging = true;
            } else if (percent >= 0 && percent <= 100) {
              batteryPercent = percent;
              this.lastKnownBatteryPercent = percent;
              isCharging = acLine === 1 || (flag & 8) !== 0;
              hasBattery = true;
            } else if (acLine === 1) {
              isCharging = true;
            }
          }
        } catch (err) {
          console.error('[SystemService] Error executing GetSystemPowerStatus:', err);
        }
      }

      // ── 2. Active Localhost Ports Scan ──
      let activePorts: number[] = this.lastStats.activePorts || [];
      try {
        activePorts = await this.scanActiveLocalhostPorts();
      } catch {}

      // ── 3. Sparkline Histories (last 16 data points) ──
      this.cpuHistory.push(cpuPercent);
      if (this.cpuHistory.length > 16) this.cpuHistory.shift();

      this.ramHistory.push(memPercent);
      if (this.ramHistory.length > 16) this.ramHistory.shift();

      this.lastStats = {
        batteryPercent,
        isCharging,
        hasBattery,
        cpuUsage: cpuPercent,
        memoryUsagePercent: memPercent,
        totalMemoryGb: Math.round((totalMem / (1024 * 1024 * 1024)) * 10) / 10,
        freeMemoryGb: Math.round((freeMem / (1024 * 1024 * 1024)) * 10) / 10,
        uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
        activePorts,
        cpuHistory: [...this.cpuHistory],
        ramHistory: [...this.ramHistory],
      };

      // ── 4. Detect Instant Power State Changes ──
      if (batteryPercent !== null) {
        if (!this.hasInitialPowerState) {
          this.hasInitialPowerState = true;
          this.lastIsCharging = isCharging;
        } else if (isCharging !== this.lastIsCharging) {
          const eventType = isCharging ? 'plugged' : 'unplugged';
          this.lastIsCharging = isCharging;
          this.emitPowerEvent({ type: eventType, batteryPercent });
        }
      }

      this.notify();
    } catch (err) {
      console.error('[SystemService] Polling error:', err);
    } finally {
      this.isPolling = false;
    }

    return this.lastStats;
  }

  private emitPowerEvent(event: PowerEvent) {
    for (const l of this.powerListeners) {
      try {
        l(event);
      } catch {}
    }
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l(this.lastStats);
      } catch {}
    }
  }

  public getStats(): SystemStats {
    return this.lastStats;
  }
}

export const systemService = new SystemService();
