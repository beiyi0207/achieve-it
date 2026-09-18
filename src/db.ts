import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { normaliseLabels } from './lib/labels';
import { DEFAULT_SETTINGS, type Achievement, type Child, type DataSnapshot, type Settings, type Tag, type Template } from './types';

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

  putTemplate(t: Template): Promise<void>;
  putTemplates(list: Template[]): Promise<void>;
  deleteTemplate(id: string): Promise<void>;

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
    indexes: { byChild: string; byDate: string; byTemplate: string; byBatch: string };
  };
  tags: { key: string; value: Tag };
  templates: {
    key: string;
    value: Template;
    indexes: { byName: string; byUsage: number };
  };
  settings: { key: string; value: Settings & { key: string } };
}

const DB_NAME = 'achieve-it';
/** v1: children, achievements, tags, settings. v2: templates store + template/batch indexes on achievements. */
const DB_VERSION = 2;
const SETTINGS_KEY = 'settings';
const ALL_STORES = ['children', 'achievements', 'tags', 'templates', 'settings'] as const;

export class IndexedDbStore implements DataStore {
  private db: IDBPDatabase<AchieveDB> | null = null;

  constructor(private name: string = DB_NAME) {}

  async init(): Promise<void> {
    if (this.db) return;
    this.db = await openDB<AchieveDB>(this.name, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore('children', { keyPath: 'id' });
          const ach = db.createObjectStore('achievements', { keyPath: 'id' });
          ach.createIndex('byChild', 'childId');
          ach.createIndex('byDate', 'date');
          db.createObjectStore('tags', { keyPath: 'id' });
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          // Existing records simply have no template fields; records without a
          // value for an indexed key are left out of that index.
          const ach = tx.objectStore('achievements');
          ach.createIndex('byTemplate', 'templateId');
          ach.createIndex('byBatch', 'batchId');
          const tpl = db.createObjectStore('templates', { keyPath: 'id' });
          tpl.createIndex('byName', 'name');
          tpl.createIndex('byUsage', 'usageCount');
        }
      },
    });
  }

  private get conn(): IDBPDatabase<AchieveDB> {
    if (!this.db) throw new Error('DataStore not initialised. Call init() first.');
    return this.db;
  }

  async loadAll(): Promise<DataSnapshot> {
    const db = this.conn;
    const [children, achievements, tags, templates, storedSettings] = await Promise.all([
      db.getAll('children'),
      db.getAll('achievements'),
      db.getAll('tags'),
      db.getAll('templates'),
      db.get('settings', SETTINGS_KEY),
    ]);
    const settings = normaliseSettings(storedSettings);
    return { children, achievements, tags, templates, settings };
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

  async putTemplate(t: Template): Promise<void> {
    await this.conn.put('templates', t);
  }

  async putTemplates(list: Template[]): Promise<void> {
    const tx = this.conn.transaction('templates', 'readwrite');
    await Promise.all([...list.map((t) => tx.store.put(t)), tx.done]);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.conn.delete('templates', id);
  }

  async putSettings(settings: Settings): Promise<void> {
    await this.conn.put('settings', { ...settings, key: SETTINGS_KEY });
  }

  async replaceAll(snapshot: DataSnapshot): Promise<void> {
    const tx = this.conn.transaction(ALL_STORES, 'readwrite');
    const children = tx.objectStore('children');
    const achievements = tx.objectStore('achievements');
    const tags = tx.objectStore('tags');
    const templates = tx.objectStore('templates');
    const settings = tx.objectStore('settings');
    await Promise.all([children.clear(), achievements.clear(), tags.clear(), templates.clear(), settings.clear()]);
    await Promise.all([
      ...snapshot.children.map((c) => children.put(c)),
      ...snapshot.achievements.map((a) => achievements.put(a)),
      ...snapshot.tags.map((t) => tags.put(t)),
      ...(snapshot.templates ?? []).map((t) => templates.put(t)),
      settings.put({ ...snapshot.settings, key: SETTINGS_KEY }),
      tx.done,
    ]);
  }

  async clearAll(): Promise<void> {
    const tx = this.conn.transaction(ALL_STORES, 'readwrite');
    await Promise.all([...ALL_STORES.map((name) => tx.objectStore(name).clear()), tx.done]);
  }
}

/** Fill in any missing settings keys (forward-compatible with older backups). */
export function normaliseSettings(input: Partial<Settings> | undefined | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) } as Settings & { key?: string };
  delete s.key;
  if (!s.defaultRecordView || !s.defaultRecordView.sort) s.defaultRecordView = { ...DEFAULT_SETTINGS.defaultRecordView };
  if (!Array.isArray(s.termDates)) s.termDates = [];
  s.labels = normaliseLabels(s.labels);
  if (typeof s.backupReminderDays !== 'number' || s.backupReminderDays < 1) s.backupReminderDays = DEFAULT_SETTINGS.backupReminderDays;
  return s;
}

export const db: DataStore = new IndexedDbStore();
