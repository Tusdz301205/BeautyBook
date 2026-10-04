import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(frontendRoot, '..', '..');
const planPath = path.join(repoRoot, 'docs', 'generated-images', 'beautybook', 'entity-plan.json');
const publicRoot = path.join(frontendRoot, 'public');
const groups = ['businesses', 'branches', 'services'];

function mimeType(file) {
  switch (path.extname(file).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.png':
    default:
      return 'image/png';
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
const entries = groups.flatMap((group) => (plan[group] || []).map((entry) => ({ ...entry, group })));
const available = [];

for (const group of groups) {
  const groupRoot = path.join(publicRoot, 'images', 'beautybook', group);
  const activeKeys = new Set((plan[group] || []).map((entry) => entry.entityKey));

  if (!(await exists(groupRoot))) continue;

  for (const dirent of await fs.readdir(groupRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory() || activeKeys.has(dirent.name)) continue;
    await fs.rm(path.join(groupRoot, dirent.name), { recursive: true, force: true });
  }
}

for (const entry of entries) {
  if (!entry.original || !Array.isArray(entry.outputs) || !entry.outputs.length) continue;
  const originalPath = path.resolve(repoRoot, entry.original);
  if (await exists(originalPath)) available.push({ ...entry, originalPath });
}

if (!available.length) {
  console.log(`No entity originals found. Planned entities: ${entries.length}.`);
  process.exit(0);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
let generated = 0;

try {
  for (const entry of available) {
    const sourceBuffer = await fs.readFile(entry.originalPath);
    const source = `data:${mimeType(entry.originalPath)};base64,${sourceBuffer.toString('base64')}`;

    for (const output of entry.outputs) {
      if (!output.path || !output.width || !output.height) continue;

      const encoded = await page.evaluate(async ({ input, width, height }) => {
        const image = new Image();
        image.src = input;
        await image.decode();

        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

        return canvas.toDataURL('image/webp', 0.82);
      }, { input: source, width: output.width, height: output.height });

      const outputPath = path.resolve(publicRoot, output.path.replace(/^\/+/, ''));
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, Buffer.from(encoded.split(',')[1], 'base64'));
      generated += 1;
    }
  }
} finally {
  await browser.close();
}

console.log(`Optimized ${available.length} entity originals into ${generated} WebP files.`);
