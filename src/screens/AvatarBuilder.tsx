import { useMemo, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { Avatar } from '../components/Avatar';
import { SegmentedControl } from '../components/SegmentedControl';
import { IconShuffle, IconUndo } from '../components/Icons';
import { childById, toast, updateChild } from '../store';
import { navigate } from '../router';
import { getStyle, NONE, renderAvatarSvg, shuffleConfig, SLOT_ORDER, STYLES, switchStyle, type Slot, type SlotDef } from '../lib/avatar';
import { AVATAR_BACKGROUNDS, cssHex } from '../lib/palette';
import type { AvatarConfig } from '../types';

type Props = { childId: string };

export function AvatarBuilderScreen({ childId }: Props) {
  const child = childById.value.get(childId);
  const [config, setConfig] = useState<AvatarConfig | null>(child?.avatar ?? null);
  const [history, setHistory] = useState<AvatarConfig[]>([]);
  const [saving, setSaving] = useState(false);

  if (!child || !config) {
    return (
      <>
        <Header variant="centered" title="Avatar" left={<a class="text-btn" href="#/kids">Back</a>} />
        <div class="container">
          <p class="muted">This kid no longer exists.</p>
        </div>
      </>
    );
  }

  const def = getStyle(config.style);

  function apply(next: AvatarConfig) {
    setHistory((h) => [...h.slice(-30), config!]);
    setConfig(next);
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setConfig(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  async function done() {
    if (saving) return;
    setSaving(true);
    try {
      await updateChild({ ...child!, avatar: config! });
      toast('Avatar saved');
      navigate(`/kids/${child!.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header
        variant="centered"
        title={`${child.firstName}'s avatar`}
        left={
          <a class="text-btn" href={`#/kids/${child.id}`}>
            Cancel
          </a>
        }
        right={
          <button type="button" class="text-btn" onClick={done} disabled={saving}>
            Done
          </button>
        }
      />
      <div class="builder">
        <div class="builder__preview">
          <Avatar config={config} firstName={child.firstName} lastName={child.lastName} size={150} />
          <div class="row">
            <button type="button" class="chip" onClick={() => apply(shuffleConfig(config))}>
              <IconShuffle size={16} /> Shuffle
            </button>
            <button type="button" class="chip" onClick={undo} disabled={history.length === 0}>
              <IconUndo size={16} /> Undo
            </button>
          </div>
        </div>

        <div class="container stack builder__options">
          <div class="field">
            <span class="field__label">Style</span>
            <SegmentedControl
              value={config.style}
              onChange={(id) => apply(switchStyle(config, id))}
              options={STYLES.map((s) => ({ value: s.id, label: s.label }))}
              label="Avatar style"
            />
          </div>

          {SLOT_ORDER.map((slot) => {
            const sd = def.slots[slot];
            if (!sd) return null;
            return <OptionRow key={`${def.id}-${slot}`} slot={slot} def={sd} config={config} onPick={(v) => apply({ ...config, [slot]: v })} />;
          })}

          <div class="field">
            <span class="field__label">Background</span>
            <div class="option-row">
              {AVATAR_BACKGROUNDS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  class={`swatch ${config.background === hex ? 'swatch--on' : ''}`}
                  style={{ background: cssHex(hex) }}
                  aria-label={`Background ${hex}`}
                  aria-pressed={config.background === hex}
                  onClick={() => apply({ ...config, background: hex })}
                />
              ))}
            </div>
            <p class="muted small">The background is also {child.firstName}'s accent colour across the app.</p>
          </div>
        </div>
      </div>
    </>
  );
}

type RowProps = { slot: Slot; def: SlotDef; config: AvatarConfig; onPick: (value: string) => void };

function OptionRow({ slot, def, config, onPick }: RowProps) {
  const current = config[slot] ?? '';
  const values = slot === 'extras' ? [NONE, ...def.values] : def.values;

  // Mini previews depend on everything except this slot's own value.
  const depKey = JSON.stringify({ ...config, [slot]: '' });
  const previews = useMemo(() => {
    if (def.kind === 'color') return null;
    return values.map((v) => {
      try {
        return renderAvatarSvg({ ...config, [slot]: v }, 56);
      } catch {
        return '';
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depKey, def]);

  return (
    <div class="field">
      <span class="field__label">{def.label}</span>
      <div class="option-row">
        {def.kind === 'color'
          ? values.map((hex) => (
              <button
                key={hex}
                type="button"
                class={`swatch ${current === hex ? 'swatch--on' : ''}`}
                style={{ background: cssHex(hex) }}
                aria-label={`${def.label} ${hex}`}
                aria-pressed={current === hex}
                onClick={() => onPick(hex)}
              />
            ))
          : values.map((v, i) => (
              <button
                key={v}
                type="button"
                class={`option ${current === v || (v === NONE && (!current || current === NONE)) ? 'option--on' : ''}`}
                aria-label={v === NONE ? `No ${def.label.toLowerCase()}` : `${def.label} ${i}`}
                aria-pressed={current === v}
                onClick={() => onPick(v)}
                dangerouslySetInnerHTML={{ __html: previews?.[i] ?? '' }}
              />
            ))}
      </div>
    </div>
  );
}
