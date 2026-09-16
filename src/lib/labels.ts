/** User-configurable words for the people being tracked ("kid"/"kids", "student"/"students", ...). */
export type LabelConfig = { singular: string; plural: string };

/** Hard cap so the tab bar, headers and buttons keep fitting on a phone. */
export const LABEL_MAX = 12;

export const DEFAULT_LABELS: LabelConfig = { singular: 'kid', plural: 'kids' };

export const LABEL_PRESETS: LabelConfig[] = [
  { singular: 'kid', plural: 'kids' },
  { singular: 'child', plural: 'children' },
  { singular: 'student', plural: 'students' },
  { singular: 'pupil', plural: 'pupils' },
  { singular: 'player', plural: 'players' },
  { singular: 'pet', plural: 'pets' },
];

export function cleanLabel(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, LABEL_MAX) : '';
  return s || fallback;
}

export function normaliseLabels(input: Partial<LabelConfig> | undefined | null): LabelConfig {
  return {
    singular: cleanLabel(input?.singular, DEFAULT_LABELS.singular),
    plural: cleanLabel(input?.plural, DEFAULT_LABELS.plural),
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Labels = {
  /** lowercase, mid-sentence: "add a kid" */
  one: string;
  many: string;
  /** capitalised, sentence start or standalone: "Kid" */
  One: string;
  Many: string;
  /** "3 kids" / "1 kid" */
  count: (n: number) => string;
};

export function makeLabels(cfg: LabelConfig | undefined): Labels {
  const c = normaliseLabels(cfg);
  const one = c.singular.toLowerCase();
  const many = c.plural.toLowerCase();
  return {
    one,
    many,
    One: cap(one),
    Many: cap(many),
    count: (n) => `${n} ${n === 1 ? one : many}`,
  };
}
