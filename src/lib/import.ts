/** Browser-side import: reads the file and parses it with the app's avatar generator as the fallback. */
import { parseBackup as parseBackupCore, type ParsedBackup } from '../core/backup';
import { DEFAULT_STYLE, randomConfig } from './avatar';

export { mergeSnapshots, type ParsedBackup } from '../core/backup';

export function parseBackup(text: string): ParsedBackup {
  return parseBackupCore(text, { avatarFallback: (name, id) => randomConfig(DEFAULT_STYLE, name || id) });
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ''));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsText(file);
  });
}
