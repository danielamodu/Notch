import { clipboard } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ClipboardItem {
  id: string;
  type: 'text' | 'link' | 'code' | 'color' | 'image';
  content: string;
  preview: string;
  isSensitive: boolean;
  isPinned: boolean;
  timestamp: number;
}

export class ClipboardService {
  private history: ClipboardItem[] = [];
  private lastContent: string = '';
  private pollInterval: NodeJS.Timeout | null = null;
  private storagePath: string = '';
  private listeners: ((items: ClipboardItem[]) => void)[] = [];

  constructor() {
    try {
      const userData = app?.getPath('userData') || process.cwd();
      this.storagePath = path.join(userData, 'clipboard_history.json');
      this.load();
    } catch {
      this.storagePath = path.join(process.cwd(), 'clipboard_history.json');
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        this.history = JSON.parse(raw);
      }
    } catch {}
  }

  private save() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.history.slice(0, 60), null, 2), 'utf-8');
    } catch {}
  }

  public startPolling(intervalMs = 600) {
    this.checkClipboard();
    this.pollInterval = setInterval(() => this.checkClipboard(), intervalMs);
  }

  public stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public onUpdate(listener: (items: ClipboardItem[]) => void) {
    this.listeners.push(listener);
  }

  private checkClipboard() {
    try {
      const text = clipboard.readText();
      if (text && text.trim() && text !== this.lastContent) {
        this.lastContent = text;
        this.addItem(text);
      }
    } catch {}
  }

  private isSecret(text: string): boolean {
    const trimmed = text.trim();
    // Patterns for API keys, tokens, passwords
    if (/^(sk-[a-zA-Z0-9_-]{20,}|ghp_[a-zA-Z0-9]{30,}|ey[a-zA-Z0-9_-]+\.ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/i.test(trimmed)) {
      return true;
    }
    if (/^(password|secret|apikey|access_token|private_key)\s*[:=]\s*\S+/i.test(trimmed)) {
      return true;
    }
    return false;
  }

  private detectType(text: string): 'text' | 'link' | 'code' | 'color' {
    const trimmed = text.trim();
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      return 'link';
    }
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed) || /^rgba?\([\d\s,.]+\)$/.test(trimmed)) {
      return 'color';
    }
    if (
      trimmed.includes('function ') ||
      trimmed.includes('const ') ||
      trimmed.includes('let ') ||
      trimmed.includes('import ') ||
      trimmed.includes('def ') ||
      trimmed.includes('class ') ||
      trimmed.includes('{\n') ||
      trimmed.includes('=>')
    ) {
      return 'code';
    }
    return 'text';
  }

  public addItem(content: string) {
    const sensitive = this.isSecret(content);
    const type = this.detectType(content);
    const preview = content.length > 120 ? content.slice(0, 120) + '...' : content;

    // Filter duplicates
    this.history = this.history.filter((item) => item.content !== content);

    const newItem: ClipboardItem = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      content,
      preview,
      isSensitive: sensitive,
      isPinned: false,
      timestamp: Date.now(),
    };

    this.history.unshift(newItem);
    if (this.history.length > 80) {
      // Keep pinned items
      const pinned = this.history.filter((i) => i.isPinned);
      const unpinned = this.history.filter((i) => !i.isPinned).slice(0, 50);
      this.history = [...pinned, ...unpinned];
    }

    this.save();
    this.notify();
  }

  public togglePin(id: string) {
    const item = this.history.find((i) => i.id === id);
    if (item) {
      item.isPinned = !item.isPinned;
      this.save();
      this.notify();
    }
  }

  public removeItem(id: string) {
    this.history = this.history.filter((i) => i.id !== id);
    this.save();
    this.notify();
  }

  public clearAll() {
    this.history = this.history.filter((i) => i.isPinned);
    this.save();
    this.notify();
  }

  public copyItem(content: string) {
    this.lastContent = content;
    clipboard.writeText(content);
  }

  public getHistory(): ClipboardItem[] {
    return this.history;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.history);
    }
  }
}
