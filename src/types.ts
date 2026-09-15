export type Child = {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
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
  createdAt: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  /** Palette color id, see lib/palette.ts */
  color: string;
};

export type SortKey = 'date' | 'child' | 'tag';
export type SortDirection = 'asc' | 'desc';
export type GroupBy = 'date' | 'child' | 'tag' | 'none';
export type Appearance = 'system' | 'light' | 'dark';

export type TermDate = { name: string; start: string; end: string };

export type Settings = {
  defaultRecordView: { sort: SortKey; direction: SortDirection };
  groupBy: GroupBy;
  showAges: boolean;
  appearance: Appearance;
  backupReminderDays: number;
  lastExportAt?: string;
  termDates?: TermDate[];
};

export const DEFAULT_SETTINGS: Settings = {
  defaultRecordView: { sort: 'date', direction: 'desc' },
  groupBy: 'date',
  showAges: true,
  appearance: 'system',
  backupReminderDays: 14,
  termDates: [],
};

/** Shape of a full JSON backup. */
export type BackupFile = {
  app: 'achieve-it';
  version: 1;
  exportedAt: string;
  children: Child[];
  achievements: Achievement[];
  tags: Tag[];
  settings?: Settings;
};

export type DataSnapshot = {
  children: Child[];
  achievements: Achievement[];
  tags: Tag[];
  settings: Settings;
};
