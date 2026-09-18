export type Child = {
  id: string;
  firstName: string;
  lastName: string;
  avatar: AvatarConfig;
  createdAt: string;
};

export type AvatarConfig = {
  style: string;
  seed?: string;
  skin: string;
  hair: string;
  hairColor: string;
  eyes: string;
  mouth: string;
  extras?: string;
  /** Hex without "#". Also used as the child's accent color across the app. */
  background: string;
};

export type Achievement = {
  id: string;
  childId: string;
  title: string;
  description: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  tags: string[];
  /** Template used at creation; may point to a template that has since been deleted. */
  templateId?: string;
  /** Template version at creation. Records are never rewritten when a template changes. */
  templateVersion?: number;
  /** Shared by every record saved together in class mode. */
  batchId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  /** Palette color id, see lib/palette.ts */
  color: string;
};

export type Template = {
  id: string;
  /** Unique, case-insensitive. */
  name: string;
  /** Key into the curated template icon set, see components/TemplateIcons.tsx */
  icon: string;
  /** Palette color id, same palette as tags. */
  color: string;
  /** Linked tags; applied when the template is used. */
  tagIds: string[];
  /** e.g. "Chinese: {topic}". Empty means a plain title field. */
  titlePattern: string;
  /** Markdown with [[hints]]. */
  body: string;
  /** Offer this template when a linked tag is added to a record. */
  suggestOnTag: boolean;
  /** Starts at 1; bumps only when titlePattern or body changes. */
  version: number;
  /** Set when created from a starter template. */
  starterKey?: string;
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SortKey = 'date' | 'child' | 'tag';
export type SortDirection = 'asc' | 'desc';
export type GroupBy = 'date' | 'child' | 'tag' | 'none';
export type Appearance = 'system' | 'light' | 'dark';

export type TermDate = { name: string; start: string; end: string };

export type Settings = {
  defaultRecordView: { sort: SortKey; direction: SortDirection };
  groupBy: GroupBy;
  appearance: Appearance;
  backupReminderDays: number;
  lastExportAt?: string;
  termDates?: TermDate[];
  /** What to call the people being tracked. */
  labels?: { singular: string; plural: string };
};

export const DEFAULT_SETTINGS: Settings = {
  defaultRecordView: { sort: 'date', direction: 'desc' },
  groupBy: 'date',
  appearance: 'system',
  backupReminderDays: 14,
  termDates: [],
  labels: { singular: 'kid', plural: 'kids' },
};

/** Shape of a full JSON backup. */
export type BackupFile = {
  app: 'achieve-it';
  /** 1: original format. 2: adds templates and template fields on achievements. */
  version: 1 | 2;
  exportedAt: string;
  children: Child[];
  achievements: Achievement[];
  tags: Tag[];
  templates?: Template[];
  settings?: Settings;
};

export type DataSnapshot = {
  children: Child[];
  achievements: Achievement[];
  tags: Tag[];
  templates: Template[];
  settings: Settings;
};
