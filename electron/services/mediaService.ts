import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MediaTrackInfo {
  title: string;
  artist: string;
  album: string;
  appId: string;
  isPlaying: boolean;
  position: number; // in seconds
  duration: number; // in seconds
  thumbnail?: string; // base64 or url
  hasActiveMedia: boolean;
}

export class WindowsMediaService {
  private lastTrack: MediaTrackInfo = {
    title: 'No media playing',
    artist: 'Spotify / Windows Media',
    album: '',
    appId: '',
    isPlaying: false,
    position: 0,
    duration: 0,
    hasActiveMedia: false,
  };

  private listeners: ((info: MediaTrackInfo) => void)[] = [];
  private bridgeProcess: ChildProcess | null = null;
  private isDisposed = false;
  private bridgePath: string = '';

  constructor() {
    this.initBridgePath();
    this.startBridge();
  }

  private initBridgePath() {
    const rootDir = process.env.APP_ROOT || process.cwd();
    const candidates = [
      path.join(rootDir, 'electron', 'bin', 'WinRTMediaBridge', 'WinRTMediaBridge.exe'),
      path.join(__dirname, '..', 'bin', 'WinRTMediaBridge', 'WinRTMediaBridge.exe'),
      path.join(process.cwd(), 'electron', 'bin', 'WinRTMediaBridge', 'WinRTMediaBridge.exe'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        this.bridgePath = c;
        break;
      }
    }

    if (!this.bridgePath) {
      this.bridgePath = candidates[0];
    }
  }

  private startBridge() {
    if (this.isDisposed || !fs.existsSync(this.bridgePath)) return;

    try {
      this.bridgeProcess = spawn(this.bridgePath, [], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      if (!this.bridgeProcess.stdout) return;

      const rl = readline.createInterface({
        input: this.bridgeProcess.stdout,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) return;

        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed.title === 'string') {
            this.lastTrack = {
              title: parsed.title || 'No media playing',
              artist: parsed.artist || 'Spotify / Windows Media',
              album: parsed.album || '',
              appId: parsed.appId || '',
              isPlaying: !!parsed.isPlaying,
              position: parsed.position || 0,
              duration: parsed.duration || 0,
              thumbnail: parsed.thumbnail || '',
              hasActiveMedia: !!parsed.hasActiveMedia,
            };
            this.notify();
          }
        } catch {}
      });

      this.bridgeProcess.on('exit', () => {
        this.bridgeProcess = null;
        if (!this.isDisposed) {
          // Restart after brief delay
          setTimeout(() => this.startBridge(), 1500);
        }
      });

      this.bridgeProcess.on('error', (err) => {
        console.warn('[WindowsMediaService] Bridge process error:', err.message);
      });
    } catch (err: any) {
      console.warn('[WindowsMediaService] Failed to start WinRT bridge:', err.message);
    }
  }

  public onUpdate(listener: (info: MediaTrackInfo) => void) {
    this.listeners.push(listener);
    // Send immediate initial state
    listener(this.lastTrack);
  }

  public startPolling(_intervalMs = 1000) {
    // Kept for backward compatibility with main.ts, but WinRT is 100% event-driven!
    if (!this.bridgeProcess) {
      this.startBridge();
    }
  }

  public stopPolling() {
    // Kept for backward compatibility
  }

  public async controlMedia(action: 'play' | 'pause' | 'toggle' | 'next' | 'previous'): Promise<boolean> {
    // 1. Optimistic instant UI update
    if (action === 'toggle') {
      this.lastTrack = { ...this.lastTrack, isPlaying: !this.lastTrack.isPlaying };
      this.notify();
    } else if (action === 'play') {
      this.lastTrack = { ...this.lastTrack, isPlaying: true };
      this.notify();
    } else if (action === 'pause') {
      this.lastTrack = { ...this.lastTrack, isPlaying: false };
      this.notify();
    }

    // 2. Direct instant stdin command to WinRT bridge (0ms overhead)
    if (this.bridgeProcess && this.bridgeProcess.stdin && this.bridgeProcess.stdin.writable) {
      try {
        this.bridgeProcess.stdin.write(JSON.stringify({ action }) + '\n');
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.lastTrack);
    }
  }

  public getCurrentTrack(): MediaTrackInfo {
    return this.lastTrack;
  }

  public dispose() {
    this.isDisposed = true;
    if (this.bridgeProcess) {
      try {
        this.bridgeProcess.kill();
      } catch {}
      this.bridgeProcess = null;
    }
  }
}
