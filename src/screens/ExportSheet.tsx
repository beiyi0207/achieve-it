import { useMemo, useState } from 'preact/hooks';
import { Dialog } from '../components/Dialog';
import { SegmentedControl } from '../components/SegmentedControl';
import { Avatar } from '../components/Avatar';
import { IconDownload, IconShare } from '../components/Icons';
import { settings, snapshot, sortedChildren, toast, updateSettings } from '../store';
import { buildBackup, buildCsv, canShareFiles, DEFAULT_EXPORT, downloadFile, exportFilename, shareFile, type ExportOptions } from '../lib/export';
import type { RangePreset } from '../lib/dates';

type Props = { open: boolean; onClose: () => void };

const RANGE_LABELS: Record<RangePreset, string> = {
  all: 'All dates',
  week: 'This week',
  month: 'This month',
  term: 'This term',
  year: 'This year',
  custom: 'Custom',
};

export function ExportSheet({ open, onClose }: Props) {
  const [o, setO] = useState<ExportOptions>(DEFAULT_EXPORT);
  const [busy, setBusy] = useState(false);
  const kids = sortedChildren.value;
  const s = settings.value;
  const hasTerm = !!s.termDates?.length;
  const shareable = useMemo(() => canShareFiles(), []);

  const patch = (p: Partial<ExportOptions>) => setO((prev) => ({ ...prev, ...p }));

  const preview = useMemo(() => {
    if (!open) return { count: 0 };
    const data = snapshot();
    const b = buildBackup(data, o, { terms: s.termDates });
    return { count: b.achievements.length, kids: b.children.length };
  }, [open, o, s.termDates]);

  function produce(): { name: string; content: string; type: string } {
    const data = snapshot();
    if (o.format === 'json') {
      return { name: exportFilename(o), content: JSON.stringify(buildBackup(data, o, { terms: s.termDates }), null, 2), type: 'application/json' };
    }
    return { name: exportFilename(o), content: buildCsv(data, o, { terms: s.termDates }), type: 'text/csv' };
  }

  async function finish(how: 'share' | 'download') {
    if (busy) return;
    setBusy(true);
    try {
      const file = produce();
      let done = false;
      if (how === 'share') done = await shareFile(file.name, file.content, file.type);
      if (!done) downloadFile(file.name, file.content, file.type);
      await updateSettings({ lastExportAt: new Date().toISOString() });
      toast(o.format === 'json' ? 'Backup exported' : 'Spreadsheet exported');
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} variant="sheet" label="Export data">
      <h2>Export data</h2>
      <SegmentedControl<'json' | 'csv'>
        value={o.format}
        onChange={(format) => patch({ format })}
        options={[
          { value: 'json', label: 'Full backup (JSON)' },
          { value: 'csv', label: 'Spreadsheet (CSV)' },
        ]}
      />
      <p class="muted small">
        {o.format === 'json'
          ? 'Everything, including kids, tags and settings. Use this to restore or move to another device.'
          : 'Records only, one row per achievement. Good for spreadsheets; cannot be imported back.'}
      </p>

      <h3>Kids</h3>
      <div class="chip-row">
        <button type="button" class={`chip ${o.childIds.length === 0 ? 'chip--active' : ''}`} aria-pressed={o.childIds.length === 0} onClick={() => patch({ childIds: [] })}>
          All kids
        </button>
        {kids.map((k) => {
          const on = o.childIds.includes(k.id);
          return (
            <button
              key={k.id}
              type="button"
              class={`chip ${on ? 'chip--active' : ''}`}
              aria-pressed={on}
              onClick={() => patch({ childIds: on ? o.childIds.filter((x) => x !== k.id) : [...o.childIds, k.id] })}
            >
              <Avatar config={k.avatar} firstName={k.firstName} lastName={k.lastName} size={22} />
              {k.firstName}
            </button>
          );
        })}
      </div>

      <h3>Dates</h3>
      <div class="chip-row">
        {(['all', 'week', 'month', 'term', 'year', 'custom'] as RangePreset[]).map((r) => (
          <button
            key={r}
            type="button"
            class={`chip ${o.range === r ? 'chip--active' : ''}`}
            aria-pressed={o.range === r}
            disabled={r === 'term' && !hasTerm}
            onClick={() => patch({ range: r })}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      {o.range === 'custom' && (
        <div class="row">
          <div class="field grow">
            <label for="exp-from">From</label>
            <input id="exp-from" class="input" type="date" value={o.from ?? ''} onInput={(e) => patch({ from: (e.target as HTMLInputElement).value || undefined })} />
          </div>
          <div class="field grow">
            <label for="exp-to">To</label>
            <input id="exp-to" class="input" type="date" value={o.to ?? ''} onInput={(e) => patch({ to: (e.target as HTMLInputElement).value || undefined })} />
          </div>
        </div>
      )}

      {o.format === 'json' && (
        <label class="row" style={{ justifyContent: 'space-between' }}>
          <span>Include avatars</span>
          <button type="button" role="switch" class="toggle" aria-checked={o.includeAvatars} onClick={() => patch({ includeAvatars: !o.includeAvatars })} aria-label="Include avatars" />
        </label>
      )}

      <p class="muted small">
        {preview.count} {preview.count === 1 ? 'record' : 'records'}
        {o.format === 'json' && preview.kids !== undefined && <> · {preview.kids} {preview.kids === 1 ? 'kid' : 'kids'}</>}
      </p>

      <div class="row">
        {shareable && (
          <button type="button" class="btn" onClick={() => finish('share')} disabled={busy}>
            <IconShare /> Share
          </button>
        )}
        <button type="button" class="btn btn--primary" onClick={() => finish('download')} disabled={busy}>
          <IconDownload /> Download
        </button>
      </div>
    </Dialog>
  );
}
