import path from 'node:path';
import fs from 'node:fs';

export interface SystemNotification {
  id: string;
  app: string;
  title: string;
  body: string;
  type: 'permission' | 'antigravity' | 'claude' | 'chat' | 'community' | 'call' | 'system';
  timestamp: number;
}

export interface ActiveCallStatus {
  isActive: boolean;
  app: string;
}

export class NotificationService {
  private dbPath: string = '';
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private seenSignatures = new Set<string>();
  private isInitialLoad = true;
  private lastCallState: ActiveCallStatus = { isActive: false, app: '' };

  private notificationListeners: ((notification: SystemNotification) => void)[] = [];
  private callListeners: ((status: ActiveCallStatus) => void)[] = [];

  constructor() {
    this.initDbPath();
  }

  private initDbPath() {
    const localAppData = process.env.LOCALAPPDATA || '';
    if (localAppData) {
      this.dbPath = path.join(localAppData, 'Microsoft', 'Windows', 'Notifications', 'wpndatabase.db');
    }
  }

  public onNewNotification(listener: (notification: SystemNotification) => void) {
    this.notificationListeners.push(listener);
  }

  public onCallStatusChange(listener: (status: ActiveCallStatus) => void) {
    this.callListeners.push(listener);
  }

  private normalizeNotification(n: SystemNotification): SystemNotification {
    let app = n.app || 'System';
    let title = n.title || '';
    let body = n.body || '';
    let type = n.type || 'system';

    const fullStr = `${app} ${title} ${body}`.toLowerCase();

    if (fullStr.includes('antigravity') || app.toLowerCase() === 'antigravity') {
      app = 'Antigravity';
      if (title.includes('Requesting your permission') || fullStr.includes('permission')) {
        type = 'permission';
        const match = title.match(/Command:\s*(.+)$/i) || title.match(/in Terminal:\s*(.+)$/i);
        if (match) {
          title = 'Permission: ' + match[1].trim();
        } else {
          title = title.replace(/^Requesting your permission\s*(in\s*Terminal:?)?/i, 'Permission: ').trim();
        }
      } else {
        type = 'antigravity';
      }
    } else if (fullStr.includes('claude')) {
      app = 'Claude';
      type = fullStr.includes('permission') ? 'permission' : 'claude';
    }

    return {
      id: n.id,
      app,
      title: title || app,
      body,
      type,
      timestamp: n.timestamp || Date.now(),
    };
  }

  public async poll() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // 1. Direct SQLite / Notifications Query (Zero PowerShell)
      if (this.dbPath && fs.existsSync(this.dbPath)) {
        try {
          // Use dynamic import for node:sqlite
          const sqlite = await import('node:sqlite');
          if (sqlite && sqlite.DatabaseSync) {
            const db = new sqlite.DatabaseSync(this.dbPath, { readOnly: true });
            try {
              const rows: any[] = db
                .prepare(
                  `SELECT Id, Type, Payload, ArrivalTime FROM Notification ORDER BY ArrivalTime DESC LIMIT 10`
                )
                .all();

              for (const row of rows) {
                if (!row.Payload) continue;
                const payloadStr = row.Payload.toString('utf8');
                
                // Parse XML elements: <text id="1">Title</text><text id="2">Body</text>
                const titleMatch = payloadStr.match(/<text[^>]*id=["']1["'][^>]*>([^<]+)<\/text>/i) ||
                                   payloadStr.match(/<text[^>]*>([^<]+)<\/text>/i);
                const bodyMatch = payloadStr.match(/<text[^>]*id=["']2["'][^>]*>([^<]+)<\/text>/i);

                const title = titleMatch ? titleMatch[1].trim() : '';
                const body = bodyMatch ? bodyMatch[1].trim() : '';
                const id = String(row.Id || Date.now());

                if (!title && !body) continue;

                const sig = `${id}::${title}::${body}`;
                if (!this.seenSignatures.has(sig)) {
                  this.seenSignatures.add(sig);
                  if (!this.isInitialLoad) {
                    const normalized = this.normalizeNotification({
                      id,
                      app: 'Windows',
                      title,
                      body,
                      type: 'system',
                      timestamp: Date.now(),
                    });
                    for (const l of this.notificationListeners) {
                      l(normalized);
                    }
                  }
                }
              }
              this.isInitialLoad = false;
            } finally {
              db.close();
            }
          }
        } catch {}
      }
    } catch {} finally {
      this.isPolling = false;
    }
  }

  public startPolling(intervalMs = 1500) {
    if (this.pollInterval) return;
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
  }

  public stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const notificationService = new NotificationService();
