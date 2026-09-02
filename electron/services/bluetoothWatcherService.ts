import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';

export interface BluetoothDeviceEvent {
  name: string;
  type: 'headphones' | 'mouse' | 'keyboard' | 'controller' | 'device';
  connected: boolean;
  battery?: number;
}

export class BluetoothWatcherService extends EventEmitter {
  private knownDevices = new Set<string>();
  private pollTimer: NodeJS.Timeout | null = null;
  private isFirstRun = true;

  constructor() {
    super();
    this.pollDevices();
    this.pollTimer = setInterval(() => this.pollDevices(), 5000);
  }

  private pollDevices() {
    // Fast Windows PowerShell query for OK/Connected Bluetooth Devices
    const cmd = `powershell -NoProfile -Command "Get-PnpDevice -Class Bluetooth -Status OK | Select-Object -ExpandProperty FriendlyName"`;

    exec(cmd, { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return;

      const lines = stdout
        .split('\r\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.includes('Adapter') && !l.includes('Enumerator') && !l.includes('Intel') && !l.includes('Realtek') && !l.includes('Radio'));

      const currentSet = new Set(lines);

      if (!this.isFirstRun) {
        // Check newly connected devices
        for (const dev of currentSet) {
          if (!this.knownDevices.has(dev)) {
            const devType = this.classifyDevice(dev);
            this.emit('device:change', {
              name: dev,
              type: devType,
              connected: true,
            });
          }
        }

        // Check disconnected devices
        for (const dev of this.knownDevices) {
          if (!currentSet.has(dev)) {
            const devType = this.classifyDevice(dev);
            this.emit('device:change', {
              name: dev,
              type: devType,
              connected: false,
            });
          }
        }
      }

      this.knownDevices = currentSet;
      this.isFirstRun = false;
    });
  }

  private classifyDevice(name: string): BluetoothDeviceEvent['type'] {
    const lower = name.toLowerCase();
    if (lower.includes('airpods') || lower.includes('buds') || lower.includes('headphone') || lower.includes('wh-') || lower.includes('wf-') || lower.includes('speaker') || lower.includes('audio')) {
      return 'headphones';
    }
    if (lower.includes('mouse') || lower.includes('mx master') || lower.includes('trackpad')) {
      return 'mouse';
    }
    if (lower.includes('keyboard') || lower.includes('keychron')) {
      return 'keyboard';
    }
    if (lower.includes('xbox') || lower.includes('controller') || lower.includes('dualsense') || lower.includes('gamepad')) {
      return 'controller';
    }
    return 'device';
  }

  public dispose() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const bluetoothWatcherService = new BluetoothWatcherService();
