import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_SETTINGS, type Achievement, type Child, type DataSnapshot, type Settings, type Tag } from './types';

/**
 * The only interface the UI talks to. Swap the implementation to move to a
 * synced backend later without touching screens or the store.
 */
export interface DataStore {
  init(): Promise<void>;
  loadAll(): Promise<DataSnapshot>;

  putChild(child: Child): Promise<void>;
  deleteChild(id: string): Promise<void>;

  putAchievement(a: Achievement): Promise<void>;
  putAchievements(list: Achievement[]): Promise<void>;
  deleteAchievement(id: string): Promise<void>;
  deleteAchievementsByChild(childId: string): Promise<void>;

  putTag(tag: Tag): Promise<void>;
  deleteTag(id: string): Promise<void>;

  putSettings(settings: Settings): Promise<void>;

  /** Replace everything with the snapshot (used by import "replace"). */
  replaceAll(snapshot: DataSnapshot): Promise<void>;
  clearAll(): Promise<void>;
}

interface AchieveDB extends DBSchema {
  children: { key: string; value: Child };
  achievements: {
    key: string;
    value: Achievement;
    indexes: { byChild: string; byDate: string };
  };
  tags: { key: string; value: Tag };
  settings: { key: string; value: Settings & { key: string } };
}

const DB_NAME = 'achieve-it';
const DB_VERSION = 1;
const SETTINGS_KEY = 'settings';

export class IndexedDbStore implements DataStore {
  private db: IDBPDatabase<AchieveDB> | null = null;

  constructor(private name: string = DB_NAME) {}

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB<AchieveDB>(this.name, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('children', { keyPath: 'id' });
        const ach = db.createObjectStore('achievements', { keyPath: 'id' });
        ach.createIndex('byChild', 'childId');
        ach.createIndex('byDate', 'date');
        db.createObjectStore('tags', { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }

  private get conn(): IDBPDatabase<AchieveDB> {
    if (!this.db) throw new Error('DataStore not initialised. Call init() first.');
    return this.db;
  }

  async loadAll(): Promise<DataSnapshot> {
    const db = this.conn;
    const [children, achievements, tags, storedSettings] = await Promise.all([
      db.getAll('children'),
      db.getAll('achievements'),
      db.getAll('tags'),
      db.get('settings', SETTINGS_KEY),
    ]);
    const settings = normaliseSettings(storedSettings);
    return { children, achievements, tags, settings };
  }

  async putChild(child: Child): Promise<void> {
    await this.conn.put('children', child);
  }

  async deleteChild(id: string): Promise<void> {
    await this.conn.delete('children', id);
  }

  async putAchievement(a: Achievement): Promise<void> {
    await this.conn.put('achievements', a);
  }

  async putAchievements(list: Achievement[]): Promise<void> {
    const tx = this.conn.transaction('achievements', 'readwrite');
    await Promise.all([...list.map((a) => tx.store.put(a)), tx.done]);
  }

  async deleteAchievement(id: string): Promise<void> {
    await this.conn.delete('achievements', id);
  }

  async deleteAchievementsByChild(childId: string): Promise<void> {
    const tx = this.conn.transaction('achievements', 'readwrite');
    const keys = await tx.store.index('byChild').getAllKeys(childId);
    await Promise.all([...keys.map((k) => tx.store.delete(k)), tx.done]);
  }

  async putTag(tag: Tag): Promise<void> {
    await this.conn.put('tags', tag);
  }

  async deleteTag(id: string): Promise<void> {
    await this.conn.delete('tags', id);
  }

  async putSettings(settings: Settings): Promise<void> {
    await this.conn.put('settings', { ...settings, key: SETTINGS_KEY });
  }

  async replaceAll(snapshot: DataSnapshot): Promise<void> {
    const tx = this.conn.transaction(['children', 'achievements', 'tags', 'settings'], 'readwrite');
    const children = tx.objectStore('children');
    const achievements = tx.objectStore('achievements');
    const tags = tx.objectStore('tags');
    const settings = tx.objectStore('settings');
    await Promise.all([children.clear(), achievements.clear(), tags.clear(), settings.clear()]);
    await Promise.all([
      ...snapshot.children.map((c) => children.put(c)),
      ...snapshot.achievements.map((a) => achievements.put(a)),
      ...snapshot.tags.map((t) => tags.put(t)),
      settings.put({ ...snapshot.settings, key: SETTINGS_KEY }),
      tx.done,
    ]);
  }

  async clearAll(): Promise<void> {
    const tx = this.conn.transaction(['children', 'achievements', 'tags', 'settings'], 'readwrite');
    await Promise.all([
      tx.objectStore('children').clear(),
      tx.objectStore('achievements').clear(),
      tx.objectStore('tags').clear(),
      tx.objectStore('settings').clear(),
      tx.done,
    ]);
  }
}

/** Fill in any missing settings keys (forward-compatible with older backups). */
export function normaliseSettings(input: Partial<Settings> | undefined | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) } as Settings & { key?: string };
  delete s.key;
  if (!s.defaultRecordView || !s.defaultRecordView.sort) s.defaultRecordView = { ...DEFAULT_SETTINGS.defaultRecordView };
  if (!Array.isArray(s.termDates)) s.termDates = [];
  if (typeof s.backupReminderDays !== 'number' || s.backupReminderDays < 1) s.backupReminderDays = DEFAULT_SETTINGS.backupReminderDays;
  return s;
}

export const db: DataStore = new IndexedDbStore();
