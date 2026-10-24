import { readFile, writeFile } from 'node:fs/promises';
import { entries } from './entries.mjs';
import { sha256, validateCatalog, safePath } from './validate.mjs';
const root = new URL('../', import.meta.url);
const manifest = { format: 'mini-keyboard-catalog', version: 1, name: 'Mini Keyboard Keymap Catalog', updatedAt: new Date().toISOString(), entries: [] };
for (const metadata of entries) {
  const path = `keymaps/${metadata.file}`;
  if (!safePath(path)) throw new Error('Unsafe keymap path');
  const bytes = await readFile(new URL(path, root));
  const profile = JSON.parse(bytes.toString('utf8'));
  manifest.entries.push({ id: profile.id, name: profile.name, description: profile.description, path, sha256: sha256(bytes), version: metadata.version, modelId: profile.modelId, platform: metadata.platform, category: metadata.category, tags: metadata.tags });
}
await validateCatalog(manifest, root);
await writeFile(new URL('catalog.json', root), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Updated catalog.json (${manifest.entries.length} entries).`);
