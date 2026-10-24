import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { relative, sep } from 'node:path';
import { validateProfile } from '../tools/profile.js';
import { getModel } from '../tools/models.js';

const root = new URL('../', import.meta.url);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const text = (value, max, empty = false) => typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
function fields(value, expected, label) {
  ensure(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  ensure(Object.keys(value).length === expected.length && Object.keys(value).every(k => expected.includes(k)), `${label}: unsupported or missing fields`);
}
export function safePath(path) {
  return typeof path === 'string' && /^keymaps\/[a-z0-9][a-z0-9/_-]*\.json$/.test(path) && path.split('/').every(Boolean);
}
export async function validateCatalog(catalog, base = root) {
  fields(catalog, ['format', 'version', 'name', 'updatedAt', 'entries'], 'catalog');
  ensure(catalog.format === 'mini-keyboard-catalog' && catalog.version === 1, 'Unsupported catalog format');
  ensure(text(catalog.name, 120), 'Invalid catalog name');
  ensure(typeof catalog.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(catalog.updatedAt) && Number.isFinite(Date.parse(catalog.updatedAt)) && new Date(catalog.updatedAt).toISOString() === catalog.updatedAt, 'Invalid UTC timestamp');
  ensure(Array.isArray(catalog.entries) && catalog.entries.length > 0 && catalog.entries.length <= 500, 'Invalid entries');
  const ids = new Set(); const paths = new Set(); let actions = 0;
  const basePath = await realpath(fileURLToPath(base));
  for (const entry of catalog.entries) {
    fields(entry, ['id', 'name', 'description', 'path', 'sha256', 'version', 'modelId', 'platform', 'category', 'tags'], 'entry');
    ensure(text(entry.id, 100) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id), 'Invalid id');
    ensure(!ids.has(entry.id) && !paths.has(entry.path), 'Duplicate entry id or path');
    ids.add(entry.id); paths.add(entry.path);
    ensure(text(entry.name, 80) && text(entry.description, 1000, true), 'Invalid metadata');
    ensure(safePath(entry.path), 'Unsafe keymap path');
    ensure(typeof entry.sha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.sha256), 'Invalid SHA256');
    ensure(typeof entry.version === 'string' && /^\d+\.\d+\.\d+$/.test(entry.version), 'Invalid entry version');
    getModel(entry.modelId);
    ensure(['mac', 'windows'].includes(entry.platform), 'Invalid platform');
    ensure(['development', 'assistant', 'game', 'system', 'other'].includes(entry.category), 'Invalid category');
    ensure(Array.isArray(entry.tags) && entry.tags.length <= 8 && entry.tags.every(tag => text(tag, 32)), 'Invalid tags');
    const target = new URL(entry.path, base);
    const actual = await realpath(fileURLToPath(target));
    const inside = relative(basePath, actual);
    ensure(inside && !inside.startsWith(`..${sep}`) && inside !== '..' && !inside.startsWith(sep), 'Keymap escapes repository');
    const bytes = await readFile(actual);
    ensure(bytes.length <= 128 * 1024, 'Keymap too large');
    ensure(sha256(bytes) === entry.sha256, `${entry.id}: SHA256 mismatch`);
    const raw = JSON.parse(bytes.toString('utf8'));
    const profile = validateProfile(raw);
    for (const key of ['id', 'name', 'description', 'modelId']) ensure(raw[key] === entry[key] && profile[key] === entry[key], `${entry.id}: ${key} mismatch`);
    for (const layer of raw.layers) for (const action of layer.actions) {
      ensure(action.type !== 'preserve', `${entry.id}: preserve placeholders are not allowed in catalog samples`);
      actions++;
    }
  }
  return { entries: catalog.entries.length, actions };
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const catalog = JSON.parse(await readFile(new URL('catalog.json', root), 'utf8'));
  const result = await validateCatalog(catalog);
  // All provenance paths are relative to repository root.
  const sources = JSON.parse(await readFile(new URL('sources/index.json', root), 'utf8'));
  for (const dataset of sources.datasets) {
    for (const key of ['datasetPath', 'profilePath']) {
      ensure(typeof dataset[key] === 'string' && !dataset[key].split('/').includes('..'), 'Unsafe source reference');
      const referenced = JSON.parse(await readFile(new URL(dataset[key], root), 'utf8'));
      if (key === 'datasetPath') {
        ensure(referenced.profilePath === dataset.profilePath, 'Source profile reference mismatch');
        await readFile(new URL(referenced.profilePath, root));
      }
    }
  }
  console.log(`Validated ${result.entries} profiles, ${result.actions} actions, ${sources.datasets.length} source datasets.`);
}
