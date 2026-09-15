import { computed, effect, signal } from '@preact/signals';
import { db as defaultDb, type DataStore } from './db';
import { DEFAULT_SETTINGS, type Achievement, type Child, type DataSnapshot, type Settings, type Tag } from './types';
import { uuid } from './lib/ids';
import { isoNow } from './lib/dates';
import { nextTagColor } from './lib/palette';

let store: DataStore = defaultDb;

export const ready = signal(false);
export const children = signal<Child[]>([]);
export const achievements = signal<Achievement[]>([]);
export const tags = signal<Tag[]>([]);
export const settings = signal<Settings>({ ...DEFAULT_SETTINGS });

export const childById = computed(() => new Map(children.value.map((c) => [c.id, c])));
export const tagById = computed(() => new Map(tags.value.map((t) => [t.id, t])));
export const sortedChildren = computed(() =>
  [...children.value].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
);
export const sortedTags = computed(() => [...tags.value].sort((a, b) => a.name.localeCompare(b.name)));

function applySnapshot(s: DataSnapshot) {
  children.value = s.children;
  achievements.value = s.achievements;
  tags.value = s.tags;
  settings.value = s.settings;
}

export async function initStore(impl: DataStore = defaultDb): Promise<void> {
  store = impl;
  await store.init();
  applySnapshot(await store.loadAll());
  ready.value = true;
}

export function snapshot(): DataSnapshot {
  return { children: children.value, achievements: achievements.value, tags: tags.value, settings: settings.value };
}

/* ---------- Children ---------- */

export async function addChild(input: Omit<Child, 'id' | 'createdAt'>): Promise<Child> {
  const child: Child = { ...input, id: uuid(), createdAt: isoNow() };
  await store.putChild(child);
  children.value = [...children.value, child];
  return child;
}

export async function updateChild(child: Child): Promise<void> {
  await store.putChild(child);
  children.value = children.value.map((c) => (c.id === child.id ? child : c));
}

export async function removeChild(id: string, records: 'delete' | 'keep'): Promise<void> {
  if (records === 'delete') {
    await store.deleteAchievementsByChild(id);
    achievements.value = achievements.value.filter((a) => a.childId !== id);
  }
  await store.deleteChild(id);
  children.value = children.value.filter((c) => c.id !== id);
}

/* ---------- Achievements ---------- */

export async function addAchievement(input: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>): Promise<Achievement> {
  const now = isoNow();
  const a: Achievement = { ...input, id: uuid(), createdAt: now, updatedAt: now };
  await store.putAchievement(a);
  achievements.value = [...achievements.value, a];
  return a;
}

export async function updateAchievement(a: Achievement): Promise<void> {
  const next = { ...a, updatedAt: isoNow() };
  await store.putAchievement(next);
  achievements.value = achievements.value.map((x) => (x.id === a.id ? next : x));
}

export async function removeAchievement(id: string): Promise<void> {
  await store.deleteAchievement(id);
  achievements.value = achievements.value.filter((a) => a.id !== id);
}

/* ---------- Tags ---------- */

export function findTagByName(name: string): Tag | undefined {
  const n = name.trim().toLowerCase();
  return tags.value.find((t) => t.name.toLowerCase() === n);
}

export async function addTag(name: string, color?: string): Promise<Tag> {
  const existing = findTagByName(name);
  if (existing) return existing;
  const tag: Tag = { id: uuid(), name: name.trim(), color: color ?? nextTagColor(tags.value.map((t) => t.color)) };
  await store.putTag(tag);
  tags.value = [...tags.value, tag];
  return tag;
}

export async function updateTag(tag: Tag): Promise<void> {
  await store.putTag(tag);
  tags.value = tags.value.map((t) => (t.id === tag.id ? tag : t));
}

/** Delete a tag and strip it from every record. */
export async function removeTag(id: string): Promise<void> {
  const touched = achievements.value.filter((a) => a.tags.includes(id)).map((a) => ({ ...a, tags: a.tags.filter((t) => t !== id) }));
  await store.putAchievements(touched);
  await store.deleteTag(id);
  const touchedIds = new Set(touched.map((a) => a.id));
  achievements.value = achievements.value.map((a) => (touchedIds.has(a.id) ? touched.find((t) => t.id === a.id)! : a));
  tags.value = tags.value.filter((t) => t.id !== id);
}

/** Merge `fromId` into `intoId`: rewrite records, dedupe, delete the source tag. */
export async function mergeTags(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  const touched = achievements.value
    .filter((a) => a.tags.includes(fromId))
    .map((a) => ({ ...a, tags: Array.from(new Set(a.tags.map((t) => (t === fromId ? intoId : t)))) }));
  await store.putAchievements(touched);
  await store.deleteTag(fromId);
  const byId = new Map(touched.map((a) => [a.id, a]));
  achievements.value = achievements.value.map((a) => byId.get(a.id) ?? a);
  tags.value = tags.value.filter((t) => t.id !== fromId);
}

/* ---------- Settings ---------- */

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const next = { ...settings.value, ...patch };
  await store.putSettings(next);
  settings.value = next;
}

/* ---------- Bulk ---------- */

export async function replaceAllData(s: DataSnapshot): Promise<void> {
  await store.replaceAll(s);
  applySnapshot(s);
}

export async function eraseAllData(): Promise<void> {
  await store.clearAll();
  applySnapshot({ children: [], achievements: [], tags: [], settings: { ...DEFAULT_SETTINGS } });
}

/* ---------- Derived helpers ---------- */

export function achievementsForChild(childId: string): Achievement[] {
  return achievements.value.filter((a) => a.childId === childId);
}

export function childName(c: Child | undefined): string {
  if (!c) return 'Unknown child';
  return `${c.firstName} ${c.lastName}`.trim();
}

/* ---------- Appearance ---------- */

if (typeof document !== 'undefined') {
  effect(() => {
    const a = settings.value.appearance;
    const root = document.documentElement;
    if (a === 'system') delete root.dataset.theme;
    else root.dataset.theme = a;
  });
}

/* ---------- Toasts ---------- */

export const toastMessage = signal<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, ms = 2500): void {
  toastMessage.value = message;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMessage.value = null), ms);
}
