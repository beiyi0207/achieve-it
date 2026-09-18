import { computed, effect, signal } from '@preact/signals';
import { db as defaultDb, type DataStore } from './db';
import { DEFAULT_SETTINGS, type Achievement, type Child, type DataSnapshot, type Settings, type Tag, type Template } from './types';
import { uuid } from './core/ids';
import { isoNow } from './core/dates';
import { nextTagColor } from './core/palette';
import { makeLabels } from './core/labels';

let store: DataStore = defaultDb;

export const ready = signal(false);
export const children = signal<Child[]>([]);
export const achievements = signal<Achievement[]>([]);
export const tags = signal<Tag[]>([]);
export const templates = signal<Template[]>([]);
export const settings = signal<Settings>({ ...DEFAULT_SETTINGS });

export const childById = computed(() => new Map(children.value.map((c) => [c.id, c])));
export const tagById = computed(() => new Map(tags.value.map((t) => [t.id, t])));
export const sortedChildren = computed(() =>
  [...children.value].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
);
/** Configurable words for the people being tracked; read as L.value.one / L.value.Many etc. */
export const L = computed(() => makeLabels(settings.value.labels));
export const sortedTags = computed(() => [...tags.value].sort((a, b) => a.name.localeCompare(b.name)));
export const templateById = computed(() => new Map(templates.value.map((t) => [t.id, t])));
/** Most used first, then by name. */
export const sortedTemplates = computed(() =>
  [...templates.value].sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name)),
);
/** Most used first, then most recently used, for the "Start from" row. */
export const templatesByRecency = computed(() =>
  [...templates.value].sort((a, b) => b.usageCount - a.usageCount || (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '') || a.name.localeCompare(b.name)),
);

function applySnapshot(s: DataSnapshot) {
  children.value = s.children;
  achievements.value = s.achievements;
  tags.value = s.tags;
  templates.value = s.templates ?? [];
  settings.value = s.settings;
}

export async function initStore(impl: DataStore = defaultDb): Promise<void> {
  store = impl;
  await store.init();
  applySnapshot(await store.loadAll());
  ready.value = true;
}

export function snapshot(): DataSnapshot {
  return { children: children.value, achievements: achievements.value, tags: tags.value, templates: templates.value, settings: settings.value };
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

/** Save several new records at once (class mode). They share whatever `batchId` the caller sets. */
export async function addAchievements(inputs: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<Achievement[]> {
  const now = isoNow();
  const list: Achievement[] = inputs.map((input) => ({ ...input, id: uuid(), createdAt: now, updatedAt: now }));
  await store.putAchievements(list);
  achievements.value = [...achievements.value, ...list];
  return list;
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

/** Rewrite the tag lists of every template that references `fromId`; `intoId` undefined removes the tag. */
async function retagTemplates(fromId: string, intoId: string | undefined): Promise<void> {
  const touched = templates.value
    .filter((t) => t.tagIds.includes(fromId))
    .map((t) => ({ ...t, tagIds: Array.from(new Set(t.tagIds.map((x) => (x === fromId ? intoId : x)).filter((x): x is string => !!x))) }));
  if (!touched.length) return;
  await store.putTemplates(touched);
  const byId = new Map(touched.map((t) => [t.id, t]));
  templates.value = templates.value.map((t) => byId.get(t.id) ?? t);
}

/** Delete a tag and strip it from every record and template. */
export async function removeTag(id: string): Promise<void> {
  const touched = achievements.value.filter((a) => a.tags.includes(id)).map((a) => ({ ...a, tags: a.tags.filter((t) => t !== id) }));
  await store.putAchievements(touched);
  await retagTemplates(id, undefined);
  await store.deleteTag(id);
  const touchedIds = new Set(touched.map((a) => a.id));
  achievements.value = achievements.value.map((a) => (touchedIds.has(a.id) ? touched.find((t) => t.id === a.id)! : a));
  tags.value = tags.value.filter((t) => t.id !== id);
}

/** Merge `fromId` into `intoId`: rewrite records and templates, dedupe, delete the source tag. */
export async function mergeTags(fromId: string, intoId: string): Promise<void> {
  if (fromId === intoId) return;
  const touched = achievements.value
    .filter((a) => a.tags.includes(fromId))
    .map((a) => ({ ...a, tags: Array.from(new Set(a.tags.map((t) => (t === fromId ? intoId : t)))) }));
  await store.putAchievements(touched);
  await retagTemplates(fromId, intoId);
  await store.deleteTag(fromId);
  const byId = new Map(touched.map((a) => [a.id, a]));
  achievements.value = achievements.value.map((a) => byId.get(a.id) ?? a);
  tags.value = tags.value.filter((t) => t.id !== fromId);
}

/* ---------- Templates ---------- */

export type TemplateInput = Omit<Template, 'id' | 'version' | 'usageCount' | 'lastUsedAt' | 'createdAt' | 'updatedAt'>;

export function findTemplateByName(name: string): Template | undefined {
  const n = name.trim().toLowerCase();
  return templates.value.find((t) => t.name.toLowerCase() === n);
}

/** "{name}", then "{name} 2", "{name} 3", … until it is unique (case-insensitive). */
export function uniqueTemplateName(base: string, ignoreId?: string): string {
  const taken = new Set(templates.value.filter((t) => t.id !== ignoreId).map((t) => t.name.toLowerCase()));
  const clean = base.trim() || 'Template';
  if (!taken.has(clean.toLowerCase())) return clean;
  for (let i = 2; ; i++) {
    const candidate = `${clean} ${i}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export async function addTemplate(input: TemplateInput): Promise<Template> {
  const now = isoNow();
  const t: Template = { ...input, name: input.name.trim(), id: uuid(), version: 1, usageCount: 0, createdAt: now, updatedAt: now };
  await store.putTemplate(t);
  templates.value = [...templates.value, t];
  return t;
}

/** Save an edit. The version bumps only when the title pattern or body changed. */
export async function updateTemplate(t: Template): Promise<Template> {
  const prev = templateById.value.get(t.id);
  const contentChanged = !!prev && (prev.titlePattern !== t.titlePattern || prev.body !== t.body);
  const now = isoNow();
  const history = contentChanged && prev
    ? [...(prev.history ?? []), { version: prev.version, titlePattern: prev.titlePattern, body: prev.body, changedAt: now }]
    : t.history;
  const next: Template = { ...t, name: t.name.trim(), version: contentChanged ? t.version + 1 : t.version, history, updatedAt: now };
  await store.putTemplate(next);
  templates.value = templates.value.map((x) => (x.id === t.id ? next : x));
  return next;
}

export async function removeTemplate(id: string): Promise<void> {
  await store.deleteTemplate(id);
  templates.value = templates.value.filter((t) => t.id !== id);
}

export async function duplicateTemplate(id: string): Promise<Template | undefined> {
  const src = templateById.value.get(id);
  if (!src) return undefined;
  const { id: _id, version: _v, usageCount: _u, lastUsedAt: _l, createdAt: _c, updatedAt: _up, starterKey: _s, history: _h, ...rest } = src;
  return addTemplate({ ...rest, name: uniqueTemplateName(`${src.name} copy`) });
}

/** Count one use (a single record or a whole class-mode batch). */
export async function recordTemplateUsage(id: string): Promise<void> {
  const t = templateById.value.get(id);
  if (!t) return;
  const next: Template = { ...t, usageCount: t.usageCount + 1, lastUsedAt: isoNow() };
  await store.putTemplate(next);
  templates.value = templates.value.map((x) => (x.id === id ? next : x));
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
  applySnapshot({ children: [], achievements: [], tags: [], templates: [], settings: { ...DEFAULT_SETTINGS } });
}

/* ---------- Derived helpers ---------- */

export function achievementsForChild(childId: string): Achievement[] {
  return achievements.value.filter((a) => a.childId === childId);
}

export function childName(c: Child | undefined): string {
  if (!c) return `Unknown ${L.value.one}`;
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
