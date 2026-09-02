import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface ShareSession {
  filePath: string;
  fileName: string;
  fileSize: number;
  shareUrl: string;
  localIp: string;
  port: number;
}

export class ApexDropService {
  private server: http.Server | null = null;
  private currentSession: ShareSession | null = null;
  private onDownloadListeners: (() => void)[] = [];

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        // Skip internal (i.e. 127.0.0.1) and non-ipv4 addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }

  public onDownload(callback: () => void) {
    this.onDownloadListeners.push(callback);
  }

  public async startShare(filePath: string): Promise<ShareSession | null> {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null;

      this.stopShare();

      const fileName = path.basename(filePath);
      const stat = fs.statSync(filePath);
      const localIp = this.getLocalIp();
      const port = 4242;

      this.server = http.createServer((req, res) => {
        const url = req.url || '/';

        if (url === '/download' || url.startsWith('/file')) {
          // Serve actual file
          const stream = fs.createReadStream(filePath);
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
            'Content-Length': stat.size,
            'Access-Control-Allow-Origin': '*',
          });

          stream.pipe(res);
          stream.on('end', () => {
            this.onDownloadListeners.forEach((cb) => cb());
          });
          return;
        }

        // Web Landing Page with Direct Download & Preview
        const isImage = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(
          path.extname(filePath).toLowerCase()
        );

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Apex Drop - ${fileName}</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { background: #0a0a0a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
              .card { background: #141414; border: 1px solid #262626; border-radius: 20px; padding: 24px; max-width: 380px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
              .icon { font-size: 36px; margin-bottom: 12px; }
              h1 { font-size: 18px; font-weight: 700; margin-bottom: 6px; word-break: break-all; }
              p { color: #888; font-size: 13px; margin-bottom: 20px; }
              .btn { display: inline-block; width: 100%; padding: 14px; background: #fff; color: #000; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 14px; transition: transform 0.1s; }
              .btn:active { transform: scale(0.97); }
              .preview { width: 100%; max-height: 200px; object-fit: contain; border-radius: 12px; margin-bottom: 16px; background: #000; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">⚡</div>
              <h1>${fileName}</h1>
              <p>${(stat.size / (1024 * 1024)).toFixed(2)} MB • Fast Local Transfer</p>
              ${isImage ? `<img src="/download" class="preview" alt="">` : ''}
              <a href="/download" class="btn">Download to Device</a>
            </div>
          </body>
          </html>
        `);
      });

      return new Promise((resolve) => {
        this.server?.listen(port, () => {
          const shareUrl = `http://${localIp}:${port}`;
          this.currentSession = {
            filePath,
            fileName,
            fileSize: stat.size,
            shareUrl,
            localIp,
            port,
          };
          resolve(this.currentSession);
        });

        this.server?.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            // Fallback random port
            this.server?.listen(0, () => {
              const addr = this.server?.address() as any;
              const freePort = addr.port;
              const shareUrl = `http://${localIp}:${freePort}`;
              this.currentSession = {
                filePath,
                fileName,
                fileSize: stat.size,
                shareUrl,
                localIp,
                port: freePort,
              };
              resolve(this.currentSession);
            });
          } else {
            resolve(null);
          }
        });
      });
    } catch {
      return null;
    }
  }

  public stopShare() {
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
    }
    this.currentSession = null;
  }
}

export const apexDropService = new ApexDropService();
