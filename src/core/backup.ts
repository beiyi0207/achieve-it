/**
 * The backup JSON is the contract between the app and anything outside the browser
 * (see docs/data-format.md). This module builds, parses and merges it without touching
 * the DOM, so the connector can use it as-is.
 */
import type { Achievement, AvatarConfig, BackupFile, Child, DataSnapshot, Tag, Template, TemplateRevision } from '../types';
import { isValidIsoDate, todayIso, type RangePreset } from './dates';
import { filterAchievements, type FilterContext } from './filters';
import { AVATAR_BACKGROUNDS, SKIN_COLORS } from './palette';
import { hashString } from './ids';
import { normaliseSettings } from './settings';

/** Current format version written by `buildBackup`. Readers accept anything up to this. */
export const BACKUP_VERSION = 2;

/* ---------- Build ---------- */

export type ExportOptions = {
  format: 'json' | 'csv';
  /** Empty means all kids. */
  childIds: string[];
  range: RangePreset;
  from?: string;
  to?: string;
  includeAvatars: boolean;
};

export const DEFAULT_EXPORT: ExportOptions = { format: 'json', childIds: [], range: 'all', includeAvatars: true };

export type ExportChild = Omit<Child, 'avatar'> & { avatar?: Child['avatar'] };

function selectData(s: DataSnapshot, o: ExportOptions, ctx: Pick<FilterContext, 'terms' | 'now'>) {
  const children = o.childIds.length ? s.children.filter((c) => o.childIds.includes(c.id)) : s.children;
  const childSet = new Set(children.map((c) => c.id));
  const achievements = filterAchievements(
    s.achievements,
    { q: '', childIds: o.childIds, tagIds: [], templateIds: [], range: o.range, from: o.from, to: o.to },
    { children: new Map(children.map((c) => [c.id, c])), tags: new Map(), terms: ctx.terms, now: ctx.now },
  ).filter((a) => !o.childIds.length || childSet.has(a.childId));
  return { children, achievements };
}

export function buildBackup(s: DataSnapshot, o: ExportOptions, ctx: Pick<FilterContext, 'terms' | 'now'> = {}): BackupFile {
  const { children, achievements } = selectData(s, o, ctx);
  const usedTags = new Set(achievements.flatMap((a) => a.tags));
  const partial = o.childIds.length > 0 || o.range !== 'all';
  const outChildren: ExportChild[] = children.map((c) => {
    if (o.includeAvatars) return c;
    const { avatar: _avatar, ...rest } = c;
    return rest;
  });
  return {
    app: 'achieve-it',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    children: outChildren as Child[],
    achievements,
    // A partial export only carries the tags it references; a full one carries all.
    tags: partial ? s.tags.filter((t) => usedTags.has(t.id)) : s.tags,
    // Templates are small and useful on their own, so every backup carries all of them.
    templates: s.templates,
    // Settings always travel too: labels and term dates give a reader the vocabulary and calendar.
    settings: s.settings,
  };
}

function csvCell(v: string | number): string {
  const str = String(v ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildCsv(s: DataSnapshot, o: ExportOptions, ctx: Pick<FilterContext, 'terms' | 'now'> = {}): string {
  const { children, achievements } = selectData(s, o, ctx);
  const childMap = new Map(children.map((c) => [c.id, c]));
  const tagMap = new Map(s.tags.map((t) => [t.id, t]));
  const templateMap = new Map(s.templates.map((t) => [t.id, t]));
  const header = ['date', 'child_first_name', 'child_last_name', 'title', 'tags', 'description', 'record_id', 'child_id', 'template'];
  const rows = [...achievements]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((a: Achievement) => {
      const c = childMap.get(a.childId);
      return [
        a.date,
        c?.firstName ?? '',
        c?.lastName ?? '',
        a.title,
        a.tags.map((id) => tagMap.get(id)?.name ?? '').filter(Boolean).join('; '),
        a.description,
        a.id,
        a.childId,
        // Template name at export time; blank if none or since deleted.
        (a.templateId && templateMap.get(a.templateId)?.name) || '',
      ]
        .map(csvCell)
        .join(',');
    });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export function exportFilename(o: ExportOptions, now = new Date()): string {
  return `achievements-${o.format === 'json' ? 'backup' : 'records'}-${todayIso(now)}.${o.format}`;
}

/* ---------- Parse ---------- */

export type ParsedBackup = { ok: true; data: DataSnapshot; source: BackupFile } | { ok: false; error: string };

export type ParseOptions = {
  /** Builds an avatar for a child that has none. The app passes its DiceBear generator; the default is a plain placeholder. */
  avatarFallback?: (name: string, id: string) => AvatarConfig;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : []);

/** A deterministic placeholder avatar that needs no renderer; only the background (the accent colour) matters to non-visual readers. */
export function placeholderAvatar(name: string, id: string): AvatarConfig {
  const h = hashString(name || id);
  return {
    style: 'lorelei',
    seed: name || id,
    skin: SKIN_COLORS[h % SKIN_COLORS.length],
    hair: '',
    hairColor: '',
    eyes: '',
    mouth: '',
    extras: 'none',
    background: AVATAR_BACKGROUNDS[h % AVATAR_BACKGROUNDS.length],
  };
}

function normChild(raw: unknown, fallback: NonNullable<ParseOptions['avatarFallback']>): Child | null {
  if (!isObj(raw) || typeof raw.id !== 'string') return null;
  const firstName = str(raw.firstName);
  const lastName = str(raw.lastName);
  const avatarRaw = isObj(raw.avatar) ? raw.avatar : null;
  const avatar =
    avatarRaw && typeof avatarRaw.style === 'string'
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
      : fallback(`${firstName} ${lastName}`.trim(), raw.id);
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
  if (raw.source === 'claude') a.source = 'claude';
  return a;
}

function normRevision(raw: unknown): TemplateRevision | null {
  if (!isObj(raw)) return null;
  const version = Number(raw.version);
  if (!Number.isInteger(version) || version < 1) return null;
  return { version, titlePattern: str(raw.titlePattern), body: str(raw.body), changedAt: str(raw.changedAt) || new Date().toISOString() };
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
  const history = (Array.isArray(raw.history) ? raw.history : []).map(normRevision).filter((r): r is TemplateRevision => !!r);
  if (history.length) t.history = history;
  return t;
}

/** Validate and normalise a JSON backup. Tolerates missing optional fields; rejects anything that is not our format. */
export function parseBackup(text: string, opts: ParseOptions = {}): ParsedBackup {
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
  if (typeof json.version === 'number' && json.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app.' };
  }
  const fallback = opts.avatarFallback ?? placeholderAvatar;
  const children = json.children.map((c) => normChild(c, fallback)).filter((c): c is Child => !!c);
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

/* ---------- Merge ---------- */

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
