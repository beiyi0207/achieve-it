import { useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { IconBack, IconTrash } from '../components/Icons';
import { settings, toast, updateSettings } from '../store';
import type { TermDate } from '../types';

export function TermDatesScreen() {
  const s = settings.value;
  const [terms, setTerms] = useState<TermDate[]>(() => (s.termDates ?? []).map((t) => ({ ...t })));
  const [dirty, setDirty] = useState(false);

  function patch(i: number, p: Partial<TermDate>) {
    setTerms((list) => list.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
    setDirty(true);
  }

  function add() {
    setTerms((list) => [...list, { name: `Term ${list.length + 1}`, start: '', end: '' }]);
    setDirty(true);
  }

  function remove(i: number) {
    setTerms((list) => list.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  const problems = terms.map((t) => {
    if (!t.name.trim()) return 'Name is required.';
    if (!t.start || !t.end) return 'Set both dates.';
    if (t.start > t.end) return 'Start must be before end.';
    return '';
  });
  const valid = problems.every((p) => !p);

  async function save() {
    if (!valid) return;
    const cleaned = terms.map((t) => ({ name: t.name.trim(), start: t.start, end: t.end })).sort((a, b) => a.start.localeCompare(b.start));
    await updateSettings({ termDates: cleaned });
    setTerms(cleaned);
    setDirty(false);
    toast('Term dates saved');
  }

  return (
    <>
      <Header
        variant="centered"
        title="Term dates"
        left={
          <a class="icon-btn" href="#/settings" aria-label="Back to settings">
            <IconBack />
          </a>
        }
        right={
          <button type="button" class="text-btn" onClick={save} disabled={!dirty || !valid}>
            Save
          </button>
        }
      />
      <div class="container stack">
        <p class="muted small">Used by the “This term” filter in Records, Stats and Export. Terms should not overlap.</p>
        {terms.map((t, i) => (
          <div key={i} class="card stack">
            <div class="row">
              <div class="field grow">
                <label for={`term-name-${i}`}>Name</label>
                <input id={`term-name-${i}`} class="input" value={t.name} onInput={(e) => patch(i, { name: (e.target as HTMLInputElement).value })} />
              </div>
              <button type="button" class="icon-btn" aria-label={`Remove ${t.name || 'term'}`} onClick={() => remove(i)} style={{ color: 'var(--danger)', alignSelf: 'flex-end' }}>
                <IconTrash />
              </button>
            </div>
            <div class="row">
              <div class="field grow">
                <label for={`term-start-${i}`}>Start</label>
                <input id={`term-start-${i}`} class="input" type="date" value={t.start} onInput={(e) => patch(i, { start: (e.target as HTMLInputElement).value })} />
              </div>
              <div class="field grow">
                <label for={`term-end-${i}`}>End</label>
                <input id={`term-end-${i}`} class="input" type="date" value={t.end} onInput={(e) => patch(i, { end: (e.target as HTMLInputElement).value })} />
              </div>
            </div>
            {problems[i] && <div class="field__error">{problems[i]}</div>}
          </div>
        ))}
        <button type="button" class="btn" onClick={add}>
          Add term
        </button>
        {dirty && (
          <button type="button" class="btn btn--primary" onClick={save} disabled={!valid}>
            Save term dates
          </button>
        )}
      </div>
    </>
  );
}
