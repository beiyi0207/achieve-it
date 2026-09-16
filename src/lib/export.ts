import type { Achievement, BackupFile, Child, DataSnapshot } from '../types';
import { todayIso, type RangePreset } from './dates';
import { filterAchievements, type FilterContext } from './filters';

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
    { q: '', childIds: o.childIds, tagIds: [], range: o.range, from: o.from, to: o.to },
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
    version: 1,
    exportedAt: new Date().toISOString(),
    children: outChildren as Child[],
    achievements,
    // A partial export only carries the tags it references; a full one carries all.
    tags: partial ? s.tags.filter((t) => usedTags.has(t.id)) : s.tags,
    settings: partial ? undefined : s.settings,
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
  const header = ['date', 'child_first_name', 'child_last_name', 'child_age', 'title', 'tags', 'description', 'record_id', 'child_id'];
  const rows = [...achievements]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((a: Achievement) => {
      const c = childMap.get(a.childId);
      return [
        a.date,
        c?.firstName ?? '',
        c?.lastName ?? '',
        c?.age ?? '',
        a.title,
        a.tags.map((id) => tagMap.get(id)?.name ?? '').filter(Boolean).join('; '),
        a.description,
        a.id,
        a.childId,
      ]
        .map(csvCell)
        .join(',');
    });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

export function exportFilename(o: ExportOptions, now = new Date()): string {
  return `achievements-${o.format === 'json' ? 'backup' : 'records'}-${todayIso(now)}.${o.format}`;
}

export function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

/** Returns true if the share sheet was shown, false if the user should fall back to download. */
export async function shareFile(name: string, content: string, type: string): Promise<boolean> {
  const file = new File([content], name, { type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file], title: name });
    return true;
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return true; // user cancelled; nothing else to do
    return false;
  }
}
