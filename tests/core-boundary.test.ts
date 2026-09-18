import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * src/core is shared with the MCP connector, which runs in Node. Nothing in it may
 * reach for the browser, Preact, IndexedDB, DiceBear or the markdown renderer.
 */
const CORE = join(__dirname, '..', 'src', 'core');
const files = readdirSync(CORE).filter((f) => f.endsWith('.ts'));

describe('src/core stays dependency-free', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const f of files) {
    it(`${f} only imports other core modules or ../types`, () => {
      const src = readFileSync(join(CORE, f), 'utf8');
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may say "document"
      const specifiers = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const s of specifiers) expect(s, `${f} imports ${s}`).toMatch(/^(\.\/[a-zA-Z]+|\.\.\/types)$/);
      expect(code, `${f} touches the DOM`).not.toMatch(/\b(document|window|navigator|localStorage|indexedDB)\b/);
    });
  }
});
