/** Fixed tag palette. Tag.color stores the id; hex values are used everywhere for consistency. */
export const TAG_PALETTE: { id: string; name: string; hex: string }[] = [
  { id: 'red', name: 'Red', hex: '#d6455d' },
  { id: 'orange', name: 'Orange', hex: '#e07b2a' },
  { id: 'amber', name: 'Amber', hex: '#c9961a' },
  { id: 'lime', name: 'Lime', hex: '#7aa823' },
  { id: 'green', name: 'Green', hex: '#2e9a5c' },
  { id: 'teal', name: 'Teal', hex: '#1f9e9a' },
  { id: 'cyan', name: 'Cyan', hex: '#2593c9' },
  { id: 'blue', name: 'Blue', hex: '#2f6fed' },
  { id: 'indigo', name: 'Indigo', hex: '#5a5ce0' },
  { id: 'purple', name: 'Purple', hex: '#8e4fd1' },
  { id: 'pink', name: 'Pink', hex: '#d64a9c' },
  { id: 'slate', name: 'Slate', hex: '#6b7280' },
];

export function tagHex(colorId: string): string {
  return TAG_PALETTE.find((p) => p.id === colorId)?.hex ?? TAG_PALETTE[TAG_PALETTE.length - 1].hex;
}

/** Suggest a palette color for a new tag: the least-used color, ties broken by palette order. */
export function nextTagColor(usedColorIds: string[]): string {
  const counts = new Map<string, number>();
  for (const id of usedColorIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best = TAG_PALETTE[0].id;
  let bestCount = Infinity;
  for (const p of TAG_PALETTE) {
    const c = counts.get(p.id) ?? 0;
    if (c < bestCount) {
      best = p.id;
      bestCount = c;
    }
  }
  return best;
}

/** Avatar colors are hex strings without "#" (DiceBear convention). */
export const SKIN_COLORS = ['f8d9c6', 'f1c9a5', 'e0ac69', 'c68642', 'a1613b', '8d5524', '6f4a2f', '4a3121'];

export const HAIR_COLORS = ['0e0e0e', '2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'e8c88a', 'b7b7b7', 'e8e1e1', 'c93305', '7b3fa0', '2e6fd6', '2e9a5c'];

/** Background doubles as the child's accent color; mid-tone so it works behind dark text. */
export const AVATAR_BACKGROUNDS = ['ffb3a7', 'ffd166', 'b5e48c', '8fd3c6', '9ad0f5', 'a8b8ff', 'cdb4ff', 'f7a6d1', 'f4c58f', 'b8e0d2', 'd4c4a8', 'c7cfdc'];

export function cssHex(hexNoHash: string): string {
  if (!hexNoHash) return 'transparent';
  return hexNoHash.startsWith('#') ? hexNoHash : `#${hexNoHash}`;
}
