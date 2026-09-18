import { createAvatar, type Style } from '@dicebear/core';
import * as lorelei from '@dicebear/lorelei';
import * as notionists from '@dicebear/notionists';
import * as openPeeps from '@dicebear/open-peeps';
import type { AvatarConfig } from '../types';
import { AVATAR_BACKGROUNDS, HAIR_COLORS, SKIN_COLORS } from '../core/palette';
import { seededRandom } from '../core/ids';

export type Slot = 'skin' | 'hair' | 'hairColor' | 'eyes' | 'mouth' | 'extras';
export const SLOT_ORDER: Slot[] = ['skin', 'hair', 'hairColor', 'eyes', 'mouth', 'extras'];

export type SlotDef = {
  /** DiceBear option name this slot writes to. */
  option: string;
  /** Row label shown in the builder. */
  label: string;
  kind: 'color' | 'variant';
  values: string[];
  /** For optional components (extras): the `${option}Probability` key to force on/off. */
  probabilityOption?: string;
};

export type StyleDef = {
  id: string;
  label: string;
  style: Style<Record<string, unknown>>;
  slots: Partial<Record<Slot, SlotDef>>;
  /** Options always applied (e.g. disable random beards for kids). */
  fixed: Record<string, unknown>;
};

const variants = (n: number) => Array.from({ length: n }, (_, i) => `variant${String(i + 1).padStart(2, '0')}`);

const LORELEI_MOUTHS = [
  ...Array.from({ length: 18 }, (_, i) => `happy${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 9 }, (_, i) => `sad${String(i + 1).padStart(2, '0')}`),
];

const OPEN_PEEPS_HEADS = [
  'afro', 'bangs', 'bangs2', 'bantuKnots', 'bear', 'bun', 'bun2', 'buns', 'cornrows', 'cornrows2', 'dreads1', 'dreads2',
  'flatTop', 'flatTopLong', 'grayBun', 'grayMedium', 'grayShort', 'hatBeanie', 'hatHip', 'hijab', 'long', 'longAfro',
  'longBangs', 'longCurly', 'medium1', 'medium2', 'medium3', 'mediumBangs', 'mediumBangs2', 'mediumBangs3',
  'mediumStraight', 'mohawk', 'mohawk2', 'noHair1', 'noHair2', 'noHair3', 'pomp', 'shaved1', 'shaved2', 'shaved3',
  'short1', 'short2', 'short3', 'short4', 'short5', 'turban', 'twists', 'twists2',
];

const OPEN_PEEPS_FACES = [
  'awe', 'calm', 'cheeky', 'cute', 'driven', 'eatingHappy', 'explaining', 'eyesClosed', 'lovingGrin1', 'lovingGrin2',
  'smile', 'smileBig', 'smileLOL', 'smileTeethGap', 'solemn', 'blank', 'concerned', 'contempt', 'serious', 'suspicious', 'tired',
];

const OPEN_PEEPS_ACCESSORIES = ['glasses', 'glasses2', 'glasses3', 'glasses4', 'glasses5', 'sunglasses', 'sunglasses2', 'eyepatch'];

export const STYLES: StyleDef[] = [
  {
    id: 'lorelei',
    label: 'Lorelei',
    style: lorelei as unknown as Style<Record<string, unknown>>,
    slots: {
      skin: { option: 'skinColor', label: 'Skin', kind: 'color', values: SKIN_COLORS },
      hair: { option: 'hair', label: 'Hair', kind: 'variant', values: variants(48) },
      hairColor: { option: 'hairColor', label: 'Hair color', kind: 'color', values: HAIR_COLORS },
      eyes: { option: 'eyes', label: 'Eyes', kind: 'variant', values: variants(24) },
      mouth: { option: 'mouth', label: 'Mouth', kind: 'variant', values: LORELEI_MOUTHS },
      extras: { option: 'glasses', label: 'Extras', kind: 'variant', values: variants(5), probabilityOption: 'glassesProbability' },
    },
    fixed: { beardProbability: 0, frecklesProbability: 0, earringsProbability: 0, hairAccessoriesProbability: 0 },
  },
  {
    id: 'openPeeps',
    label: 'Peeps',
    style: openPeeps as unknown as Style<Record<string, unknown>>,
    slots: {
      skin: { option: 'skinColor', label: 'Skin', kind: 'color', values: SKIN_COLORS },
      hair: { option: 'head', label: 'Hair', kind: 'variant', values: OPEN_PEEPS_HEADS },
      hairColor: { option: 'headContrastColor', label: 'Hair color', kind: 'color', values: HAIR_COLORS },
      eyes: { option: 'face', label: 'Face', kind: 'variant', values: OPEN_PEEPS_FACES },
      extras: { option: 'accessories', label: 'Extras', kind: 'variant', values: OPEN_PEEPS_ACCESSORIES, probabilityOption: 'accessoriesProbability' },
    },
    fixed: { facialHairProbability: 0, maskProbability: 0 },
  },
  {
    id: 'notionists',
    label: 'Notionists',
    style: notionists as unknown as Style<Record<string, unknown>>,
    slots: {
      hair: { option: 'hair', label: 'Hair', kind: 'variant', values: [...variants(63), 'hat'] },
      eyes: { option: 'eyes', label: 'Eyes', kind: 'variant', values: variants(5) },
      mouth: { option: 'lips', label: 'Mouth', kind: 'variant', values: variants(30) },
      extras: { option: 'glasses', label: 'Extras', kind: 'variant', values: variants(11), probabilityOption: 'glassesProbability' },
    },
    fixed: { beardProbability: 0, gestureProbability: 0, bodyIconProbability: 0 },
  },
];

export const DEFAULT_STYLE = STYLES[0].id;

export function getStyle(id: string): StyleDef {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}

export const NONE = 'none';

/** Translate an AvatarConfig into DiceBear options for its style. */
export function toDicebearOptions(config: AvatarConfig, size?: number): Record<string, unknown> {
  const def = getStyle(config.style);
  const opts: Record<string, unknown> = {
    ...def.fixed,
    seed: config.seed || 'achieve-it',
    backgroundColor: [config.background || AVATAR_BACKGROUNDS[0]],
  };
  if (size) opts.size = size;
  for (const slot of SLOT_ORDER) {
    const s = def.slots[slot];
    if (!s) continue;
    const value = config[slot] ?? '';
    if (s.probabilityOption) {
      if (!value || value === NONE) {
        opts[s.probabilityOption] = 0;
      } else {
        opts[s.probabilityOption] = 100;
        opts[s.option] = [value];
      }
    } else if (value) {
      opts[s.option] = [value];
    }
  }
  return opts;
}

/** Render SVG markup for a config. Never cache the result; it is cheap to regenerate. */
export function renderAvatarSvg(config: AvatarConfig, size?: number): string {
  const def = getStyle(config.style);
  return createAvatar(def.style, toDicebearOptions(config, size)).toString();
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Deterministic random config for a style, seeded from a string (e.g. the child's name). */
export function randomConfig(styleId: string, seed: string): AvatarConfig {
  const def = getStyle(styleId);
  const rand = seededRandom(`${def.id}:${seed}`);
  const cfg: AvatarConfig = {
    style: def.id,
    seed,
    skin: '',
    hair: '',
    hairColor: '',
    eyes: '',
    mouth: '',
    extras: NONE,
    background: pick(rand, AVATAR_BACKGROUNDS),
  };
  for (const slot of SLOT_ORDER) {
    const s = def.slots[slot];
    if (!s) continue;
    if (slot === 'extras') {
      cfg.extras = rand() < 0.25 ? pick(rand, s.values) : NONE;
    } else {
      cfg[slot] = pick(rand, s.values);
    }
  }
  return cfg;
}

/** A fresh random config within the same style (new seed, new choices). */
export function shuffleConfig(config: AvatarConfig): AvatarConfig {
  const seed = Math.random().toString(36).slice(2, 10);
  return randomConfig(config.style, seed);
}

/** Switch style, keeping seed and background but re-rolling style-specific slots. */
export function switchStyle(config: AvatarConfig, styleId: string): AvatarConfig {
  const next = randomConfig(styleId, config.seed || 'achieve-it');
  return { ...next, background: config.background };
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase() || '?';
}
