import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { CalendarEvent, GoogleAuthStatus, TaskItem } from '../../src/types/island.ts';

interface GoogleAuthStore {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  clientId?: string;
  clientSecret?: string;
  icalUrl?: string;
  user?: {
    email: string;
    name: string;
    picture?: string;
  } | null;
}

export class GoogleService {
  private storagePath: string;
  private authData: GoogleAuthStore = {};
  private authServer: http.Server | null = null;
  private readonly REDIRECT_URI = 'http://127.0.0.1:4280/callback';

  constructor() {
    try {
      const userData = app?.getPath('userData') || process.cwd();
      this.storagePath = path.join(userData, 'google_credentials.json');
      this.load();
    } catch {
      this.storagePath = path.join(process.cwd(), 'google_credentials.json');
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        this.authData = JSON.parse(raw);
      }
    } catch {}
  }

  private save() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.authData, null, 2), 'utf-8');
    } catch {}
  }

  public getStatus(): GoogleAuthStatus {
    const isConnected = !!(this.authData.accessToken || this.authData.refreshToken || this.authData.icalUrl);
    return {
      connected: isConnected,
      user: this.authData.user || (this.authData.icalUrl ? { name: 'Google Calendar (iCal)', email: 'Synced via Secret Link' } : null),
    };
  }

  public setIcalUrl(url: string): boolean {
    if (!url || !url.trim()) return false;
    this.authData.icalUrl = url.trim();
    this.save();
    return true;
  }

  public setCustomCredentials(clientId: string, clientSecret?: string) {
    this.authData.clientId = clientId.trim();
    if (clientSecret) {
      this.authData.clientSecret = clientSecret.trim();
    }
    this.save();
  }

  public async startAuthFlow(customClientId?: string, customClientSecret?: string): Promise<boolean> {
    if (customClientId) {
      this.authData.clientId = customClientId.trim();
    }
    if (customClientSecret) {
      this.authData.clientSecret = customClientSecret.trim();
    }
    this.save();

    if (!this.authData.clientId) {
      return false;
    }

    const clientId = this.authData.clientId;

    if (this.authServer) {
      try {
        this.authServer.close();
      } catch {}
      this.authServer = null;
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      this.REDIRECT_URI
    )}&response_type=code&scope=${encodeURIComponent(
      scopes
    )}&access_type=offline&prompt=consent`;

    return new Promise((resolve) => {
      this.authServer = http.createServer(async (req, res) => {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html>
                <head>
                  <title>Connected to Apex Island</title>
                  <style>
                    body { background: #0a0a0a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
                    .card { background: #141414; padding: 32px; border-radius: 20px; border: 1px solid #262626; }
                    h1 { color: #4ade80; font-size: 20px; margin-bottom: 8px; }
                    p { color: #888; font-size: 14px; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>✓ Google Account Linked!</h1>
                    <p>You can close this tab and return to Apex Island.</p>
                  </div>
                </body>
              </html>
            `);

            const success = await this.exchangeCode(code);
            try {
              this.authServer?.close();
            } catch {}
            this.authServer = null;
            resolve(success);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end(`Authentication failed: ${error || 'No code received'}`);
            try {
              this.authServer?.close();
            } catch {}
            this.authServer = null;
            resolve(false);
          }
        }
      });

      this.authServer.listen(4280, () => {
        shell.openExternal(authUrl);
      });

      this.authServer.on('error', () => {
        resolve(false);
      });
    });
  }

  private async exchangeCode(code: string): Promise<boolean> {
    const clientId = this.authData.clientId || '';
    const clientSecret = this.authData.clientSecret || '';

    try {
      const bodyParams: Record<string, string> = {
        code,
        client_id: clientId,
        redirect_uri: this.REDIRECT_URI,
        grant_type: 'authorization_code',
      };
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyParams).toString(),
      });

      if (!res.ok) return false;

      const data = await res.json();
      this.authData.accessToken = data.access_token;
      if (data.refresh_token) {
        this.authData.refreshToken = data.refresh_token;
      }
      this.authData.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

      await this.fetchUserProfile();
      this.save();
      return true;
    } catch {
      return false;
    }
  }

  private async fetchUserProfile() {
    if (!this.authData.accessToken) return;
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.authData.accessToken}` },
      });
      if (res.ok) {
        const user = await res.json();
        this.authData.user = {
          email: user.email,
          name: user.name,
          picture: user.picture,
        };
      }
    } catch {}
  }

  private async getValidToken(): Promise<string | null> {
    if (!this.authData.accessToken && !this.authData.refreshToken) return null;

    if (this.authData.accessToken && (this.authData.expiresAt || 0) > Date.now() + 60000) {
      return this.authData.accessToken;
    }

    if (!this.authData.refreshToken) return this.authData.accessToken || null;

    const clientId = this.authData.clientId || '';
    const clientSecret = this.authData.clientSecret || '';

    try {
      const bodyParams: Record<string, string> = {
        client_id: clientId,
        refresh_token: this.authData.refreshToken,
        grant_type: 'refresh_token',
      };
      if (clientSecret) {
        bodyParams.client_secret = clientSecret;
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(bodyParams).toString(),
      });

      if (!res.ok) return null;

      const data = await res.json();
      this.authData.accessToken = data.access_token;
      this.authData.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
      this.save();
      return this.authData.accessToken;
    } catch {
      return null;
    }
  }

  public logout() {
    this.authData = {};
    this.save();
  }

  // --- GOOGLE CALENDAR API (OAuth + iCal Fallback) ---
  public async getCalendarEvents(): Promise<CalendarEvent[]> {
    // 1. Try iCal Secret Feed first if configured
    if (this.authData.icalUrl) {
      try {
        const icsEvents = await this.fetchIcalEvents(this.authData.icalUrl);
        if (icsEvents.length > 0) return icsEvents;
      } catch {}
    }

    // 2. Try OAuth Token
    const token = await this.getValidToken();
    if (!token) return [];

    try {
      const timeMin = new Date().toISOString();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
        timeMin
      )}&maxResults=10&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return [];

      const data = await res.json();
      const items = data.items || [];

      return items.map((item: any) => {
        const start = item.start?.dateTime || item.start?.date || '';
        const end = item.end?.dateTime || item.end?.date || '';
        const isAllDay = !item.start?.dateTime;

        let meetLink = item.hangoutLink || '';
        if (!meetLink && item.description) {
          const match = item.description.match(/https:\/\/[^\s]+(meet\.google\.com|zoom\.us)[^\s]*/i);
          if (match) meetLink = match[0];
        }

        return {
          id: item.id,
          summary: item.summary || 'Untitled Event',
          description: item.description,
          location: item.location,
          start,
          end,
          isAllDay,
          meetLink,
          htmlLink: item.htmlLink,
        };
      });
    } catch {
      return [];
    }
  }

  private async fetchIcalEvents(icalUrl: string): Promise<CalendarEvent[]> {
    const res = await fetch(icalUrl);
    if (!res.ok) return [];

    const text = await res.text();
    const events: CalendarEvent[] = [];

    const vevents = text.split('BEGIN:VEVENT');
    const now = new Date();

    for (let i = 1; i < vevents.length; i++) {
      const chunk = vevents[i].split('END:VEVENT')[0];
      const summaryMatch = chunk.match(/SUMMARY:(.*)/);
      const startMatch = chunk.match(/DTSTART.*:(.*)/);
      const endMatch = chunk.match(/DTEND.*:(.*)/);
      const descMatch = chunk.match(/DESCRIPTION:(.*)/);
      const locMatch = chunk.match(/LOCATION:(.*)/);

      const summary = summaryMatch ? summaryMatch[1].trim() : 'Event';
      const rawStart = startMatch ? startMatch[1].trim() : '';
      const rawEnd = endMatch ? endMatch[1].trim() : '';

      const parseIcalDate = (dStr: string) => {
        if (!dStr) return new Date();
        if (dStr.length === 8) {
          // YYYYMMDD
          return new Date(
            parseInt(dStr.slice(0, 4)),
            parseInt(dStr.slice(4, 6)) - 1,
            parseInt(dStr.slice(6, 8))
          );
        }
        // YYYYMMDDTHHMMSSZ
        const year = parseInt(dStr.slice(0, 4));
        const month = parseInt(dStr.slice(4, 6)) - 1;
        const day = parseInt(dStr.slice(6, 8));
        const hour = parseInt(dStr.slice(9, 11)) || 0;
        const min = parseInt(dStr.slice(11, 13)) || 0;
        return new Date(Date.UTC(year, month, day, hour, min));
      };

      const startDate = parseIcalDate(rawStart);
      const endDate = parseIcalDate(rawEnd);

      // Only show events within next 7 days
      if (startDate.getTime() >= now.getTime() - 3600000 && startDate.getTime() <= now.getTime() + 7 * 86400000) {
        let meetLink = '';
        if (descMatch) {
          const m = descMatch[1].match(/https:\/\/[^\s]+(meet\.google\.com|zoom\.us)[^\s]*/i);
          if (m) meetLink = m[0];
        }
        if (!meetLink && locMatch) {
          const m = locMatch[1].match(/https:\/\/[^\s]+(meet\.google\.com|zoom\.us)[^\s]*/i);
          if (m) meetLink = m[0];
        }

        events.push({
          id: `ical-${i}-${rawStart}`,
          summary,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          isAllDay: rawStart.length === 8,
          location: locMatch ? locMatch[1].trim() : undefined,
          meetLink,
        });
      }
    }

    return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  // --- GOOGLE TASKS API ---
  public async getTasks(): Promise<TaskItem[]> {
    const token = await this.getValidToken();
    if (!token) return [];

    try {
      const url = `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?showCompleted=true&showHidden=false&maxResults=25`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return [];

      const data = await res.json();
      const items = data.items || [];

      return items
        .filter((t: any) => t.title && t.title.trim().length > 0)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          completed: t.status === 'completed',
          dueDate: t.due ? t.due.substring(0, 10) : undefined,
          isGoogleTask: true,
          createdAt: t.updated ? new Date(t.updated).getTime() : Date.now(),
        }));
    } catch {
      return [];
    }
  }

  public async createTask(title: string): Promise<TaskItem | null> {
    const token = await this.getValidToken();
    if (!token || !title.trim()) return null;

    try {
      const url = `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!res.ok) return null;

      const t = await res.json();
      return {
        id: t.id,
        title: t.title,
        completed: t.status === 'completed',
        dueDate: t.due ? t.due.substring(0, 10) : undefined,
        isGoogleTask: true,
        createdAt: Date.now(),
      };
    } catch {
      return null;
    }
  }

  public async toggleTask(id: string, completed: boolean): Promise<boolean> {
    const token = await this.getValidToken();
    if (!token || !id) return false;

    try {
      const url = `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: completed ? 'completed' : 'needsAction' }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  public async deleteTask(id: string): Promise<boolean> {
    const token = await this.getValidToken();
    if (!token || !id) return false;

    try {
      const url = `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      return res.ok;
    } catch {
      return false;
    }
  }
}

export const googleService = new GoogleService();
