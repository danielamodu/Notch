import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface ShelfFileItem {
  id: string;
  filePath: string;
  name: string;
  extension: string;
  sizeBytes: number;
  addedAt: number;
}

export class ShelfService {
  private files: ShelfFileItem[] = [];
  private storagePath: string = '';
  private listeners: ((files: ShelfFileItem[]) => void)[] = [];

  constructor() {
    try {
      const userData = app?.getPath('userData') || process.cwd();
      this.storagePath = path.join(userData, 'shelf_items.json');
      this.load();
    } catch {
      this.storagePath = path.join(process.cwd(), 'shelf_items.json');
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf-8');
        const list: ShelfFileItem[] = JSON.parse(raw);
        // Verify files still exist
        this.files = list.filter((f) => fs.existsSync(f.filePath));
      }
    } catch {}
  }

  private save() {
    try {
      fs.writeFileSync(this.storagePath, JSON.stringify(this.files, null, 2), 'utf-8');
    } catch {}
  }

  public onUpdate(listener: (files: ShelfFileItem[]) => void) {
    this.listeners.push(listener);
  }

  public addFile(filePath: string): ShelfFileItem | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stats = fs.statSync(filePath);

      // Avoid duplicates
      this.files = this.files.filter((f) => f.filePath !== filePath);

      const item: ShelfFileItem = {
        id: Math.random().toString(36).substring(2, 9),
        filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath).replace('.', '').toUpperCase(),
        sizeBytes: stats.size,
        addedAt: Date.now(),
      };

      this.files.unshift(item);
      this.save();
      this.notify();
      return item;
    } catch {
      return null;
    }
  }

  public removeFile(id: string) {
    this.files = this.files.filter((f) => f.id !== id);
    this.save();
    this.notify();
  }

  public clearAll() {
    this.files = [];
    this.save();
    this.notify();
  }

  public getFiles(): ShelfFileItem[] {
    return this.files;
  }

  private notify() {
    for (const l of this.listeners) {
      l(this.files);
    }
  }
}
