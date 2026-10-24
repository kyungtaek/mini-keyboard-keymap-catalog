import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateCatalog, sha256 } from '../scripts/validate.mjs';
import { validateProfile } from '../tools/profile.js';
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

async function withV3Profile(label, run) {
  const directory = await mkdtemp(join(tmpdir(), 'keymap-catalog-v3-'));
  try {
    const base = pathToFileURL(directory + '/');
    const entry = structuredClone(catalog.entries[0]);
    const profile = JSON.parse(await readFile(new URL(entry.path, root), 'utf8'));
    profile.version = 3;
    profile.applicationId = 'vscode-mac';
    profile.layers[0].actions[0].label = label;
    const bytes = Buffer.from(JSON.stringify(profile));
    entry.sha256 = sha256(bytes);
    await mkdir(join(directory, 'keymaps'));
    await writeFile(new URL(entry.path, base), bytes);
    await run({ ...structuredClone(catalog), entries: [entry] }, base, profile);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('accepts v3 profile with app association and action label', async () => {
  await withV3Profile('줄 위로 이동', async (fixture, base, profile) => {
    assert.deepEqual(await validateCatalog(fixture, base), { entries: 1, actions: 75 });
    const normalized = validateProfile(profile);
    assert.equal(normalized.applicationId, 'vscode-mac');
    assert.equal(normalized.layers[0].actions[0].label, '줄 위로 이동');
  });
});
for (const label of ['x'.repeat(81), { text: 'invalid' }, '   ']) {
  test(`rejects invalid v3 action label ${JSON.stringify(label)}`, async () => {
    await withV3Profile(label, async (fixture, base) => {
      await assert.rejects(validateCatalog(fixture, base));
    });
  });
}

test('legacy profiles normalize to v3 with inferred app association', async () => {
  for (const entry of catalog.entries) {
    const raw = JSON.parse(await readFile(new URL(entry.path, root), 'utf8'));
    const normalized = validateProfile(raw);
    assert.equal(normalized.version, 3);
    assert.equal(normalized.applicationId, entry.category === 'system' ? null : entry.id.replace(/^sample-/, ''));
  }
});
