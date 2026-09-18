import type { Achievement, BackupFile, Child, DataSnapshot, Tag, Template } from '../types';
import { normaliseSettings } from '../db';
import { DEFAULT_STYLE, randomConfig } from './avatar';
import { isValidIsoDate } from './dates';

export type ParsedBackup = { ok: true; data: DataSnapshot; source: BackupFile } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function normChild(raw: unknown): Child | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null;
  const firstName = str(raw.firstName);
  const lastName = str(raw.lastName);
  const avatarRaw = isObj(raw.avatar) ? raw.avatar : null;
  const avatar = avatarRaw && typeof avatarRaw.style === 'string'
    ? {
        style: avatarRaw.style,
        seed: str(avatarRaw.seed) || undefined,
        skin: str(avatarRaw.skin),
        hair: str(avatarRaw.hair),
        hairColor: str(avatarRaw.hairColor),
        eyes: str(avatarRaw.eyes),
        mouth: str(avatarRaw.mouth),
        extras: str(avatarRaw.extras, 'none'),
        background: str(avatarRaw.background),
      }
    : randomConfig(DEFAULT_STYLE, `${firstName} ${lastName}`.trim() || raw.id);
  return {
    id: raw.id,
    firstName,
    lastName,
    avatar,
    createdAt: str(raw.createdAt) || new Date().toISOString(),
  };
}

function normTag(raw: unknown): Tag | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return { id: raw.id, name: raw.name, color: str(raw.color, 'slate') };
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : []);

function normAchievement(raw: unknown): Achievement | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.childId !== 'string') return null;
  const date = str(raw.date).slice(0, 10);
  if (!isValidIsoDate(date)) return null;
  const now = new Date().toISOString();
  const a: Achievement = {
    id: raw.id,
    childId: raw.childId,
    title: str(raw.title),
    description: str(raw.description),
    date,
    tags: strList(raw.tags),
    createdAt: str(raw.createdAt) || now,
    updatedAt: str(raw.updatedAt) || str(raw.createdAt) || now,
  };
  if (typeof raw.templateId === 'string' && raw.templateId) a.templateId = raw.templateId;
  if (typeof raw.templateVersion === 'number' && Number.isFinite(raw.templateVersion)) a.templateVersion = raw.templateVersion;
  if (typeof raw.batchId === 'string' && raw.batchId) a.batchId = raw.batchId;
  return a;
}

function normTemplate(raw: unknown): Template | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  const now = new Date().toISOString();
  const version = Number(raw.version);
  const usage = Number(raw.usageCount);
  const t: Template = {
    id: raw.id,
    name: raw.name.trim(),
    icon: str(raw.icon, 'template'),
    color: str(raw.color, 'slate'),
    tagIds: strList(raw.tagIds),
    titlePattern: str(raw.titlePattern),
    body: str(raw.body),
    suggestOnTag: raw.suggestOnTag !== false,
    version: Number.isInteger(version) && version >= 1 ? version : 1,
    usageCount: Number.isInteger(usage) && usage >= 0 ? usage : 0,
    createdAt: str(raw.createdAt) || now,
    updatedAt: str(raw.updatedAt) || str(raw.createdAt) || now,
  };
  if (typeof raw.starterKey === 'string' && raw.starterKey) t.starterKey = raw.starterKey;
  if (typeof raw.lastUsedAt === 'string' && raw.lastUsedAt) t.lastUsedAt = raw.lastUsedAt;
  return t;
}

/** Validate and normalise a JSON backup. Tolerates missing optional fields; rejects anything that is not our format. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObj(json)) return { ok: false, error: 'This file is not an Achievement tracker backup.' };
  if (json.app !== 'achieve-it' || !Array.isArray(json.children) || !Array.isArray(json.achievements)) {
    return { ok: false, error: 'This file is not an Achievement tracker backup.' };
  }
  if (typeof json.version === 'number' && json.version > 2) {
    return { ok: false, error: 'This backup was made by a newer version of the app.' };
  }
  const children = json.children.map(normChild).filter((c): c is Child => !!c);
  const tags = (Array.isArray(json.tags) ? json.tags : []).map(normTag).filter((t): t is Tag => !!t);
  const tagIds = new Set(tags.map((t) => t.id));
  const achievements = json.achievements
    .map(normAchievement)
    .filter((a): a is Achievement => !!a)
    .map((a) => ({ ...a, tags: a.tags.filter((t) => tagIds.has(t)) }));
  const seenNames = new Set<string>();
  const templates = (Array.isArray(json.templates) ? json.templates : [])
    .map(normTemplate)
    .filter((t): t is Template => !!t)
    // Names are unique; the first occurrence wins.
    .filter((t) => {
      const key = t.name.toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .map((t) => ({ ...t, tagIds: t.tagIds.filter((id) => tagIds.has(id)) }));
  const settings = normaliseSettings(isObj(json.settings) ? (json.settings as never) : undefined);
  return { ok: true, data: { children, achievements, tags, templates, settings }, source: json as unknown as BackupFile };
}

/**
 * Merge an imported snapshot into the current one.
 * - Children and tags are matched by id; tags also by name (case-insensitive) so duplicates collapse.
 * - Achievements are matched by id; the newer updatedAt wins.
 * - Templates are matched by id; an incoming template whose name clashes with a different
 *   existing template is renamed "{name} (imported)".
 * - Settings are kept from the current data.
 */
export function mergeSnapshots(current: DataSnapshot, incoming: DataSnapshot): DataSnapshot {
  const children = new Map(current.children.map((c) => [c.id, c]));
  for (const c of incoming.children) if (!children.has(c.id)) children.set(c.id, c);

  const tags = new Map(current.tags.map((t) => [t.id, t]));
  const byName = new Map(current.tags.map((t) => [t.name.toLowerCase(), t.id]));
  const remap = new Map<string, string>();
  for (const t of incoming.tags) {
    if (tags.has(t.id)) continue;
    const existingId = byName.get(t.name.toLowerCase());
    if (existingId) {
      remap.set(t.id, existingId);
    } else {
      tags.set(t.id, t);
      byName.set(t.name.toLowerCase(), t.id);
    }
  }

  const achievements = new Map(current.achievements.map((a) => [a.id, a]));
  for (const raw of incoming.achievements) {
    const a = { ...raw, tags: Array.from(new Set(raw.tags.map((id) => remap.get(id) ?? id))) };
    const existing = achievements.get(a.id);
    if (!existing || a.updatedAt > existing.updatedAt) achievements.set(a.id, a);
  }

  const templates = new Map(current.templates.map((t) => [t.id, t]));
  const templateNames = new Set(current.templates.map((t) => t.name.toLowerCase()));
  for (const raw of incoming.templates ?? []) {
    if (templates.has(raw.id)) continue;
    let name = raw.name;
    if (templateNames.has(name.toLowerCase())) {
      name = `${raw.name} (imported)`;
      for (let i = 2; templateNames.has(name.toLowerCase()); i++) name = `${raw.name} (imported ${i})`;
    }
    const t = { ...raw, name, tagIds: Array.from(new Set(raw.tagIds.map((id) => remap.get(id) ?? id))) };
    templates.set(t.id, t);
    templateNames.add(name.toLowerCase());
  }

  return {
    children: [...children.values()],
    achievements: [...achievements.values()],
    tags: [...tags.values()],
    templates: [...templates.values()],
    settings: current.settings,
  };
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsText(file);
  });
}
