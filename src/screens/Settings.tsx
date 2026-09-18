import { useEffect, useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconChevron } from '../components/Icons';
import { L, achievements, children, eraseAllData, replaceAllData, settings, snapshot, tags, templates, toast, updateSettings } from '../store';
import { daysSince } from '../core/dates';
import { mergeSnapshots, parseBackup, readFileText } from '../lib/import';
import { installAvailable, installed, isIosSafari, promptInstall } from '../lib/install';
import { LABEL_MAX, LABEL_PRESETS, normaliseLabels } from '../core/labels';
import { ExportSheet } from './ExportSheet';
import type { Appearance, DataSnapshot, GroupBy, SortDirection, SortKey } from '../types';

export function SettingsScreen() {
  const s = settings.value;
  const kidCount = children.value.length;
  const recordCount = achievements.value.length;
  const tagCount = tags.value.length;
  const templateCount = templates.value.length;
  const [exportOpen, setExportOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<DataSnapshot | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseText, setEraseText] = useState('');
  const [iosHintOpen, setIosHintOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Label inputs are edited locally and saved on blur/Enter so we do not write to the database per keystroke.
  const savedLabels = normaliseLabels(s.labels);
  const [labelDraft, setLabelDraft] = useState(savedLabels);
  useEffect(() => setLabelDraft(savedLabels), [savedLabels.singular, savedLabels.plural]);
  const labelPreview = normaliseLabels(labelDraft);

  async function commitLabels(next = labelDraft) {
    const clean = normaliseLabels(next);
    setLabelDraft(clean);
    if (clean.singular !== savedLabels.singular || clean.plural !== savedLabels.plural) {
      await updateSettings({ labels: clean });
      toast('Labels updated');
    }
  }

  const days = s.lastExportAt ? daysSince(s.lastExportAt) : null;
  const needsBackup = (recordCount > 0 || kidCount > 0) && (days === null || days >= s.backupReminderDays);
  const showInstall = !installed.value && installAvailable.value;
  const showIosHint = !installed.value && !installAvailable.value && isIosSafari();

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

  async function install() {
    const r = await promptInstall();
    if (r === 'accepted') toast('App installed');
    else if (r === 'unavailable') toast('Install is not available in this browser.');
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

        <h2 class="section-title">Tags</h2>
        <div class="list">
          <a class="list-row" href="#/settings/tags">
            <div class="grow">
              <div class="list-row__title">Manage tags</div>
              <div class="list-row__sub">
                {tagCount} {tagCount === 1 ? 'tag' : 'tags'} · rename, recolour, merge or delete
              </div>
            </div>
            <IconChevron class="chevron" />
          </a>
          <a class="list-row" href="#/settings/templates">
            <div class="grow">
              <div class="list-row__title">Templates</div>
              <div class="list-row__sub">
                {templateCount} {templateCount === 1 ? 'template' : 'templates'} · the same shape for every record of a kind
              </div>
            </div>
            <IconChevron class="chevron" />
          </a>
        </div>

        <h2 class="section-title">Labels</h2>
        <div class="list">
          <div class="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div>
              <div class="list-row__title">What do you call them?</div>
              <div class="list-row__sub">Used everywhere in the app, for example “Your {labelPreview.plural.toLowerCase()}” and “Add {labelPreview.singular.toLowerCase()}”.</div>
            </div>
            <div class="chip-row">
              {LABEL_PRESETS.map((p) => {
                const on = p.singular === savedLabels.singular.toLowerCase() && p.plural === savedLabels.plural.toLowerCase();
                return (
                  <button key={p.plural} type="button" class={`chip ${on ? 'chip--active' : ''}`} aria-pressed={on} onClick={() => commitLabels(p)}>
                    {p.plural.charAt(0).toUpperCase() + p.plural.slice(1)}
                  </button>
                );
              })}
            </div>
            <div class="row">
              <label class="field grow">
                <span class="field__label">One</span>
                <input
                  class="input"
                  value={labelDraft.singular}
                  maxLength={LABEL_MAX}
                  placeholder="kid"
                  autocomplete="off"
                  onInput={(e) => setLabelDraft({ ...labelDraft, singular: (e.target as HTMLInputElement).value })}
                  onBlur={() => commitLabels()}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </label>
              <label class="field grow">
                <span class="field__label">Several</span>
                <input
                  class="input"
                  value={labelDraft.plural}
                  maxLength={LABEL_MAX}
                  placeholder="kids"
                  autocomplete="off"
                  onInput={(e) => setLabelDraft({ ...labelDraft, plural: (e.target as HTMLInputElement).value })}
                  onBlur={() => commitLabels()}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
              </label>
            </div>
            <div class="list-row__sub">Up to {LABEL_MAX} characters each, so labels keep fitting on small screens.</div>
          </div>
        </div>

        <h2 class="section-title">App</h2>
        <div class="list">
          {showInstall && (
            <button type="button" class="list-row" onClick={install}>
              <div class="grow">
                <div class="list-row__title">Install app</div>
                <div class="list-row__sub">Add to your home screen and use it offline.</div>
              </div>
              <IconChevron class="chevron" />
            </button>
          )}
          {showIosHint && (
            <button type="button" class="list-row" onClick={() => setIosHintOpen(true)}>
              <div class="grow">
                <div class="list-row__title">Install app</div>
                <div class="list-row__sub">Add to your home screen and use it offline.</div>
              </div>
              <IconChevron class="chevron" />
            </button>
          )}
          <div class="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div class="list-row__title">Appearance</div>
            <SegmentedControl<Appearance>
              value={s.appearance}
              onChange={(appearance) => updateSettings({ appearance })}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              label="Appearance"
            />
          </div>
          <div class="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <div class="list-row__title">Default record view</div>
            <div class="row">
              <label class="field grow">
                <span class="field__label">Sort by</span>
                <select
                  class="select"
                  value={s.defaultRecordView.sort}
                  onChange={(e) => updateSettings({ defaultRecordView: { ...s.defaultRecordView, sort: (e.target as HTMLSelectElement).value as SortKey } })}
                >
                  <option value="date">Date</option>
                  <option value="child">{L.value.One}</option>
                  <option value="tag">Tag</option>
                </select>
              </label>
              <label class="field grow">
                <span class="field__label">Direction</span>
                <select
                  class="select"
                  value={s.defaultRecordView.direction}
                  onChange={(e) =>
                    updateSettings({ defaultRecordView: { ...s.defaultRecordView, direction: (e.target as HTMLSelectElement).value as SortDirection } })
                  }
                >
                  <option value="desc">{s.defaultRecordView.sort === 'date' ? 'Newest first' : 'Z to A'}</option>
                  <option value="asc">{s.defaultRecordView.sort === 'date' ? 'Oldest first' : 'A to Z'}</option>
                </select>
              </label>
            </div>
            <label class="field">
              <span class="field__label">Group by</span>
              <select class="select" value={s.groupBy} onChange={(e) => updateSettings({ groupBy: (e.target as HTMLSelectElement).value as GroupBy })}>
                <option value="date">Date</option>
                <option value="child">{L.value.One}</option>
                <option value="tag">Tag</option>
                <option value="none">None</option>
              </select>
            </label>
          </div>
          <a class="list-row" href="#/settings/terms">
            <div class="grow">
              <div class="list-row__title">Term dates</div>
              <div class="list-row__sub">
                {s.termDates?.length ? `${s.termDates.length} ${s.termDates.length === 1 ? 'term' : 'terms'} set` : 'For teachers. Enables the “This term” range.'}
              </div>
            </div>
            <IconChevron class="chevron" />
          </a>
        </div>

        <h2 class="section-title" style={{ color: 'var(--danger)' }}>
          Danger zone
        </h2>
        <div class="list">
          <button
            type="button"
            class="list-row"
            onClick={() => {
              setEraseText('');
              setEraseOpen(true);
            }}
          >
            <div class="grow">
              <div class="list-row__title" style={{ color: 'var(--danger)' }}>
                Erase all data
              </div>
              <div class="list-row__sub">Deletes every {L.value.one}, record, tag, template and setting from this browser.</div>
            </div>
            <IconChevron class="chevron" />
          </button>
        </div>

        <p class="muted small" style={{ textAlign: 'center' }}>
          Version {__APP_VERSION__} · {L.value.count(kidCount)} · {recordCount} {recordCount === 1 ? 'record' : 'records'}
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
              The file contains {L.value.count(pendingImport.children.length)}, {pendingImport.achievements.length}{' '}
              {pendingImport.achievements.length === 1 ? 'record' : 'records'}, {pendingImport.tags.length} {pendingImport.tags.length === 1 ? 'tag' : 'tags'} and{' '}
              {pendingImport.templates.length} {pendingImport.templates.length === 1 ? 'template' : 'templates'}.
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

      <Dialog open={iosHintOpen} onClose={() => setIosHintOpen(false)} label="Install on iPhone or iPad">
        <h2>Install on iPhone or iPad</h2>
        <ol class="steps">
          <li>Tap the Share button at the bottom of Safari.</li>
          <li>Scroll down and tap “Add to Home Screen”.</li>
          <li>Tap “Add”. The app opens full screen and works offline.</li>
        </ol>
        <p class="muted small">Your data stays in Safari on this device. Keep exporting backups from Settings.</p>
        <div class="dialog__actions">
          <button type="button" class="btn btn--primary" onClick={() => setIosHintOpen(false)}>
            Got it
          </button>
        </div>
      </Dialog>

      <Dialog open={eraseOpen} onClose={() => setEraseOpen(false)} label="Erase all data">
        <h2>Erase all data?</h2>
        <p class="muted small">
          This deletes {L.value.count(kidCount)} and {recordCount} {recordCount === 1 ? 'record' : 'records'} from this browser. It cannot be undone.
          Export a backup first if you might want them back.
        </p>
        <div class="field">
          <label for="erase-confirm">Type “erase” to confirm</label>
          <input id="erase-confirm" class="input" value={eraseText} onInput={(e) => setEraseText((e.target as HTMLInputElement).value)} autocomplete="off" autoCapitalize="off" />
        </div>
        <div class="dialog__actions">
          <button
            type="button"
            class="btn btn--danger"
            disabled={eraseText.trim().toLowerCase() !== 'erase'}
            onClick={async () => {
              await eraseAllData();
              setEraseOpen(false);
              toast('All data erased');
            }}
          >
            Erase everything
          </button>
          <button type="button" class="btn btn--ghost" onClick={() => setEraseOpen(false)}>
            Cancel
          </button>
        </div>
      </Dialog>
    </>
  );
}
