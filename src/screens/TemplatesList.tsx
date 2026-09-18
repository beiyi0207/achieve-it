import { useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { ConfirmDialog } from '../components/Dialog';
import { EmptyState } from '../components/EmptyState';
import { SwipeRow } from '../components/SwipeRow';
import { TagChip } from '../components/TagChip';
import { TemplateTile } from '../components/TemplateIcons';
import { IconBack, IconChevron, IconPlus } from '../components/Icons';
import { addTag, addTemplate, removeTemplate, sortedTemplates, tagById, templates, toast } from '../store';
import { STARTER_TEMPLATES, bodyOutline, type StarterTemplate } from '../lib/starterTemplates';
import type { Template } from '../types';

export function TemplatesListScreen() {
  const mine = sortedTemplates.value;
  const added = new Set(templates.value.map((t) => t.starterKey).filter(Boolean));
  const starters = STARTER_TEMPLATES.filter((s) => !added.has(s.key));
  const [pending, setPending] = useState<Template | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  async function addStarter(s: StarterTemplate) {
    if (adding) return;
    setAdding(s.key);
    try {
      const tagIds: string[] = [];
      for (const name of s.tagNames) tagIds.push((await addTag(name)).id);
      await addTemplate({ name: s.name, icon: s.icon, color: s.color, tagIds, titlePattern: s.titlePattern, body: s.body, suggestOnTag: true, starterKey: s.key });
      toast(`Added ${s.name}`);
    } finally {
      setAdding(null);
    }
  }

  const outline = (body: string) => bodyOutline(body).join(' · ');

  return (
    <>
      <Header
        variant="centered"
        title="Templates"
        left={
          <a class="icon-btn" href="#/settings" aria-label="Back to settings">
            <IconBack />
          </a>
        }
        right={
          <a class="icon-btn" href="#/settings/templates/new" aria-label="New template">
            <IconPlus />
          </a>
        }
      />
      <div class="container stack">
        {mine.length === 0 ? (
          <EmptyState title="No templates yet" message="Templates give records the same shape every time. Add a starter below or create your own." />
        ) : (
          <>
            <h2 class="section-title">Your templates</h2>
            <div class="list">
              {mine.map((t) => {
                const tags = t.tagIds.map((id) => tagById.value.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
                const sections = outline(t.body);
                return (
                  <SwipeRow key={t.id} onAction={() => setPending(t)}>
                    <a class="list-row" href={`#/settings/templates/${t.id}`}>
                      <TemplateTile template={t} />
                      <div class="grow" style={{ minWidth: 0 }}>
                        <div class="list-row__title truncate">{t.name}</div>
                        <div class="list-row__sub truncate">{sections || 'No sections'}</div>
                        <div class="list-row__sub record-row__meta">
                          <span>Used {t.usageCount === 1 ? 'once' : `${t.usageCount} times`}</span>
                          {tags.map((tag) => (
                            <TagChip key={tag.id} tag={tag} size="sm" />
                          ))}
                        </div>
                      </div>
                      <IconChevron class="chevron" />
                    </a>
                  </SwipeRow>
                );
              })}
            </div>
            <p class="muted small" style={{ textAlign: 'center' }}>
              Swipe left on a template to delete it.
            </p>
          </>
        )}

        {starters.length > 0 && (
          <>
            <h2 class="section-title">Starter templates</h2>
            <div class="list">
              {starters.map((s) => (
                <div key={s.key} class="list-row">
                  <TemplateTile template={s} />
                  <div class="grow" style={{ minWidth: 0 }}>
                    <div class="list-row__title truncate">{s.name}</div>
                    <div class="list-row__sub truncate">{outline(s.body)}</div>
                  </div>
                  <button type="button" class="btn btn--primary tpl-add" onClick={() => addStarter(s)} disabled={adding !== null} aria-label={`Add ${s.name}`}>
                    Add
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Delete ${pending.name}?` : ''}
        message="Records made with it keep their content."
        actions={[
          {
            label: 'Delete template',
            kind: 'danger',
            onClick: async () => {
              await removeTemplate(pending!.id);
              toast('Template deleted');
            },
          },
        ]}
      />
    </>
  );
}
