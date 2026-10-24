import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/validate.mjs';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
const mutate = change => { const copy = structuredClone(catalog); change(copy); return copy; };

test('catalog validates all six complete profiles', async () => {
  assert.deepEqual(await validateCatalog(catalog, root), { entries: 6, actions: 450 });
});
for (const [label, change] of [
  ['traversal', c => { c.entries[0].path = 'keymaps/../sources/index.json'; }],
  ['empty path segment', c => { c.entries[0].path = 'keymaps//sample-vscode-mac.json'; }],
  ['metadata mismatch', c => { c.entries[0].name = 'wrong'; }],
  ['hash mismatch', c => { c.entries[0].sha256 = '0'.repeat(64); }],
  ['duplicate id', c => { c.entries[1].id = c.entries[0].id; }],
  ['unknown field', c => { c.entries[0].unexpected = true; }],
  ['invalid timestamp', c => { c.updatedAt = '2026-02-30T00:00:00.000Z'; }],
  ['invalid platform', c => { c.entries[0].platform = 'linux'; }],
  ['too many tags', c => { c.entries[0].tags = Array(9).fill('tag'); }],
]) {
  test(`rejects ${label}`, async () => {
    await assert.rejects(validateCatalog(mutate(change), root));
  });
}
