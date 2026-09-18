import type { Template } from '../types';
import { tagHex } from '../core/palette';

/**
 * Curated icon set for templates, drawn in the same 24px stroke style as Icons.tsx.
 * Templates store the key; render with <TemplateIcon name=… />.
 */
const ICONS: { key: string; label: string; paths: string[] }[] = [
  { key: 'template', label: 'Template', paths: ['M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 13a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M14 12h6M14 16h6M14 20h6'] },
  { key: 'language', label: 'Language', paths: ['M4 5h7', 'M9 3v2c0 4.418-2.239 8-5 8', 'M5 9c0 2.144 2.952 3.908 6.7 4', 'M12 20l4-9 4 9', 'M19.1 18h-6.2'] },
  { key: 'book', label: 'Book', paths: ['M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0', 'M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0', 'M3 6v13M12 6v13M21 6v13'] },
  { key: 'pencil', label: 'Writing', paths: ['M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4', 'M13.5 6.5l4 4'] },
  { key: 'calculator', label: 'Maths', paths: ['M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 7h6a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z', 'M8 14v.01M12 14v.01M16 14v.01M8 17v.01M12 17v.01M16 17v.01'] },
  { key: 'flask', label: 'Science', paths: ['M9 3h6', 'M10 9h4', 'M10 3v6l-4 11a.7.7 0 0 0 .5 1h11a.7.7 0 0 0 .5-1l-4-11V3'] },
  { key: 'globe', label: 'World', paths: ['M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0', 'M3.6 9h16.8M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'] },
  { key: 'code', label: 'Code', paths: ['M7 8l-4 4 4 4', 'M17 8l4 4-4 4', 'M14 4l-4 16'] },
  { key: 'run', label: 'Running', paths: ['M12 4a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M4 17l5 1 .75-1.5', 'M15 21v-4l-4-3 1-6', 'M7 12V9l5-1 3 3 3 1'] },
  { key: 'ball', label: 'Ball games', paths: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'M12 7l4.76 3.45-1.82 5.6h-5.88l-1.82-5.6z', 'M12 7V3m3 13l2.5 3m-.74-8.55l3.5-1.14m-8.02 1.14l-3.5-1.14m4.5 7.55l-2.5 3'] },
  { key: 'swim', label: 'Swimming', paths: ['M15 9a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M6 11l4-2 3.5 3-1.5 2', 'M3 16.75a2.4 2.4 0 0 0 1 .25 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 2-1 2.4 2.4 0 0 1 2-1 2.4 2.4 0 0 1 2 1 2.4 2.4 0 0 0 2 1 2.4 2.4 0 0 0 1-.25'] },
  { key: 'bike', label: 'Cycling', paths: ['M2 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M16 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M12 19v-4l-3-3 5-4 2 3h3', 'M16 8a1 1 0 1 0 2 0 1 1 0 1 0-2 0'] },
  { key: 'trophy', label: 'Trophy', paths: ['M8 21h8', 'M12 17v4', 'M7 4h10', 'M17 4v8a5 5 0 0 1-10 0V4', 'M3 9a2 2 0 1 0 4 0 2 2 0 1 0-4 0', 'M17 9a2 2 0 1 0 4 0 2 2 0 1 0-4 0'] },
  { key: 'music', label: 'Music', paths: ['M3 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M13 17a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M9 17V4h10v13', 'M9 8h10'] },
  { key: 'palette', label: 'Art', paths: ['M12 21a9 9 0 0 1 0-18c4.97 0 9 3.582 9 8 0 1.06-.474 2.078-1.318 2.828-.844.75-1.989 1.172-3.182 1.172h-2.5a2 2 0 0 0-1 3.75 1.3 1.3 0 0 1-1 2.25', 'M7.5 10.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M11.5 7.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0', 'M15.5 10.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0'] },
  { key: 'camera', label: 'Photos', paths: ['M5 7h1a2 2 0 0 0 2-2 1 1 0 0 1 1-1h6a1 1 0 0 1 1 1 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2', 'M9 13a3 3 0 1 0 6 0 3 3 0 0 0-6 0'] },
  { key: 'smile', label: 'Drama', paths: ['M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0', 'M9 10h.01M15 10h.01', 'M9.5 15a3.5 3.5 0 0 0 5 0'] },
  { key: 'blocks', label: 'Building', paths: ['M4 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M14 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z', 'M4 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M14 15a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z'] },
  { key: 'hammer', label: 'Making', paths: ['M11.414 10l-7.383 7.418a2.091 2.091 0 0 0 0 2.967 2.11 2.11 0 0 0 2.976 0l7.407-7.385', 'M18.121 15.293l2.586-2.586a1 1 0 0 0 0-1.414l-7.586-7.586a1 1 0 0 0-1.414 0l-2.586 2.586a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0z'] },
  { key: 'utensils', label: 'Cooking', paths: ['M19 3v12h-5c-.023-3.681.184-7.406 5-12z', 'M19 15v6h-1v-3', 'M8 4v17', 'M5 4v3a3 3 0 1 0 6 0V4'] },
  { key: 'leaf', label: 'Nature', paths: ['M5 21c.5-4.5 2.5-8 7-10', 'M9 18c6.218 0 10.5-3.288 11-12V4h-4.014c-9 0-11.986 4-12 9 0 1 0 3 2 5h3z'] },
  { key: 'sun', label: 'Outdoors', paths: ['M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0', 'M3 12h1m8-9v1m8 8h1m-9 8v1M5.6 5.6l.7.7m12.1-.7l-.7.7m0 11.4l.7.7m-12.1-.7l-.7.7'] },
  { key: 'heart', label: 'Kindness', paths: ['M19.5 12.572L12 20l-7.5-7.428a5 5 0 1 1 7.5-6.566 5 5 0 1 1 7.5 6.572'] },
  { key: 'star', label: 'Star', paths: ['M12 17.75l-6.172 3.245 1.179-6.873-5-4.867 6.9-1L12 2.002l3.086 6.253 6.9 1-5 4.867 1.179 6.873z'] },
  { key: 'flag', label: 'Milestone', paths: ['M5 5a5 5 0 0 1 7 0 5 5 0 0 0 7 0v9a5 5 0 0 1-7 0 5 5 0 0 0-7 0V5z', 'M5 21v-7'] },
  { key: 'home', label: 'Home', paths: ['M5 12H3l9-9 9 9h-2', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7', 'M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6'] },
];

const BY_KEY = new Map(ICONS.map((i) => [i.key, i]));

export const TEMPLATE_ICONS: { key: string; label: string }[] = ICONS.map(({ key, label }) => ({ key, label }));

export const DEFAULT_TEMPLATE_ICON = 'template';

export function templateIconLabel(name: string): string {
  return BY_KEY.get(name)?.label ?? BY_KEY.get(DEFAULT_TEMPLATE_ICON)!.label;
}

export function TemplateIcon({ name, size = 24 }: { name: string; size?: number }) {
  const icon = BY_KEY.get(name) ?? BY_KEY.get(DEFAULT_TEMPLATE_ICON)!;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={2} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {icon.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** The coloured square tile that identifies a template everywhere. */
export function TemplateTile({ template, size = 44 }: { template: Pick<Template, 'icon' | 'color'>; size?: number }) {
  return (
    <span class="tpl-tile" style={{ '--tag': tagHex(template.color), width: size, height: size } as Record<string, string | number>}>
      <TemplateIcon name={template.icon} size={Math.round(size * 0.55)} />
    </span>
  );
}
