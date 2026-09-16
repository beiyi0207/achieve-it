import { useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ConfirmDialog } from '../components/Dialog';
import { IconChevron } from '../components/Icons';
import { achievements, children, replaceAllData, settings, snapshot, toast, updateSettings } from '../store';
import { daysSince } from '../lib/dates';
import { mergeSnapshots, parseBackup, readFileText } from '../lib/import';
import { ExportSheet } from './ExportSheet';
import type { DataSnapshot } from '../types';

export function SettingsScreen() {
  const s = settings.value;
  const kidCount = children.value.length;
  const recordCount = achievements.value.length;
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<DataSnapshot | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const days = s.lastExportAt ? daysSince(s.lastExportAt) : null;
  const needsBackup = (recordCount > 0 || kidCount > 0) && (days === null || days >= s.backupReminderDays);

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const parsed = parseBackup(await readFileText(file));
      if (!parsed.ok) {
        toast(parsed.error, 4000);
        return;
      }
      setPendingImport(parsed.data);
    } catch {
      toast('Could not read that file.', 4000);
    }
  }

  return (
    <>
      <Header title="Settings" />
      <div class="container stack">
        {needsBackup && (
          <div class="banner" role="status">
            <div class="banner__title">{days === null ? 'No backup yet' : `Last backup was ${days} ${days === 1 ? 'day' : 'days'} ago`}</div>
            <div class="small">Your data only lives in this browser. Back up now.</div>
            <button type="button" class="btn btn--primary" onClick={() => setExportOpen(true)}>
              Back up now
            </button>
          </div>
        )}

        <h2 class="section-title">Your data</h2>
        <div class="list">
          <button type="button" class="list-row" onClick={() => setExportOpen(true)}>
            <div class="grow">
              <div class="list-row__title">Export data</div>
              <div class="list-row__sub">{s.lastExportAt ? `Last export ${days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} ago`}` : 'Never exported'}</div>
            </div>
            <IconChevron class="chevron" />
          </button>
          <button type="button" class="list-row" onClick={() => fileRef.current?.click()}>
            <div class="grow">
              <div class="list-row__title">Import backup</div>
              <div class="list-row__sub">JSON backups only. CSV files cannot be imported.</div>
            </div>
            <IconChevron class="chevron" />
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" class="visually-hidden" onChange={onFile} tabIndex={-1} />
          <label class="list-row" style={{ cursor: 'default' }}>
            <div class="grow">
              <div class="list-row__title">Backup reminder</div>
              <div class="list-row__sub">Remind me when the last export is older than</div>
            </div>
            <select
              class="select"
              style={{ width: 'auto', minHeight: 40 }}
              value={String(s.backupReminderDays)}
              onChange={(e) => updateSettings({ backupReminderDays: Number((e.target as HTMLSelectElement).value) })}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={String(d)}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>

        <p class="muted small" style={{ textAlign: 'center' }}>
          Version {__APP_VERSION__} · {kidCount} {kidCount === 1 ? 'kid' : 'kids'} · {recordCount} {recordCount === 1 ? 'record' : 'records'}
        </p>
      </div>

      <ExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />

      <ConfirmDialog
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        title="Import backup"
        message={
          pendingImport && (
            <>
              The file contains {pendingImport.children.length} {pendingImport.children.length === 1 ? 'kid' : 'kids'}, {pendingImport.achievements.length}{' '}
              {pendingImport.achievements.length === 1 ? 'record' : 'records'} and {pendingImport.tags.length} {pendingImport.tags.length === 1 ? 'tag' : 'tags'}.
              <br />
              <br />
              <strong>Replace</strong> deletes everything currently in the app first. <strong>Merge</strong> adds what is missing and keeps the newer version of any record
              that exists in both.
            </>
          )
        }
        actions={[
          {
            label: 'Replace everything',
            kind: 'danger',
            onClick: async () => {
              await replaceAllData(pendingImport!);
              toast('Backup restored');
            },
          },
          {
            label: 'Merge into existing data',
            kind: 'primary',
            onClick: async () => {
              await replaceAllData(mergeSnapshots(snapshot(), pendingImport!));
              toast('Backup merged');
            },
          },
        ]}
      />
    </>
  );
}
