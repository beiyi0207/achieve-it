import { DEFAULT_SETTINGS, type Settings } from '../types';
import { normaliseLabels } from './labels';

/** Fill in any missing settings keys and drop ones we no longer use (forward-compatible with older stores and backups). */
export function normaliseSettings(input: Partial<Settings> | undefined | null): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(input ?? {}) } as Settings & { key?: string; showAges?: boolean };
  delete s.key; // IndexedDB row key
  delete s.showAges; // age was removed from the data model
  if (!s.defaultRecordView || !s.defaultRecordView.sort) s.defaultRecordView = { ...DEFAULT_SETTINGS.defaultRecordView };
  if (!Array.isArray(s.termDates)) s.termDates = [];
  s.labels = normaliseLabels(s.labels);
  if (typeof s.backupReminderDays !== 'number' || s.backupReminderDays < 1) s.backupReminderDays = DEFAULT_SETTINGS.backupReminderDays;
  return s;
}
