import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('public', 'images', 'beautybook');
const groups = ['businesses', 'branches', 'services'];
const extensions = new Set(['.webp', '.avif', '.png', '.jpg', '.jpeg']);

async function walk(directory) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(target);
  }
  return files;
}

function getEntityKey(file) {
  const parts = path.relative(root, file).split(path.sep);
  if (parts.length < 3) return null;
  return `${parts[0]}/${parts[1]}`;
}

const files = (await Promise.all(groups.map((group) => walk(path.join(root, group))))).flat();

if (!files.length) {
  throw new Error('Chưa có ảnh entity riêng trong businesses/, branches/ hoặc services/.');
}

const hashes = new Map();
const entities = new Map();

for (const file of files) {
  const entity = getEntityKey(file);
  if (!entity) throw new Error(`Ảnh entity phải nằm trong thư mục riêng theo entity: ${path.relative(root, file)}`);

  const hash = crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
  const previous = hashes.get(hash);
  if (previous && previous.entity !== entity) {
    throw new Error(`Ảnh bị trùng giữa ${previous.entity} và ${entity}: ${path.relative(root, previous.file)} <> ${path.relative(root, file)}`);
  }

  hashes.set(hash, { entity, file });
  entities.set(entity, (entities.get(entity) || 0) + 1);
}

console.log(`Entity image QA passed: ${entities.size} entity, ${files.length} file, không có SHA-256 trùng giữa các entity.`);
