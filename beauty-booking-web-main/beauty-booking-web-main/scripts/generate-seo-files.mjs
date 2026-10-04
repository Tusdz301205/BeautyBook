import fs from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const planPath = path.resolve(root, '..', '..', 'docs', 'generated-images', 'beautybook', 'entity-plan.json');
const env = loadEnv('production', root, '');
const rawSiteUrl = String(process.env.VITE_SITE_URL || env.VITE_SITE_URL || '').trim();

function productionSiteUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return '';
    return url.href.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function xmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function readPlan() {
  try {
    return JSON.parse(await fs.readFile(planPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

const siteUrl = productionSiteUrl(rawSiteUrl);
const plan = await readPlan();
const routes = new Set(['/', '/explore', '/for-business']);

for (const branch of plan.branches || []) {
  if (branch.entityId) routes.add(`/explore/branches/${encodeURIComponent(branch.entityId)}`);
}

for (const service of plan.services || []) {
  if (service.entityId) routes.add(`/explore/services/${encodeURIComponent(service.entityId)}`);
}

const robots = [
  'User-agent: *',
  'Allow: /',
  'Disallow: /admin/',
  'Disallow: /customer/',
  'Disallow: /salon/',
  'Disallow: /book',
  siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml` : '',
  '',
].filter((line, index, rows) => line || index === rows.length - 1).join('\n');

await fs.mkdir(publicDir, { recursive: true });
await fs.writeFile(path.join(publicDir, 'robots.txt'), robots, 'utf8');

const sitemapPath = path.join(publicDir, 'sitemap.xml');
if (!siteUrl) {
  await fs.rm(sitemapPath, { force: true });
  console.log('SEO files generated without sitemap. Set VITE_SITE_URL to a real production origin to enable canonical sitemap URLs.');
  process.exit(0);
}

const urls = [...routes]
  .map((route) => `  <url><loc>${xmlEscape(new URL(route, `${siteUrl}/`).href)}</loc></url>`)
  .join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

await fs.writeFile(sitemapPath, sitemap, 'utf8');
console.log(`SEO files generated for ${routes.size} indexable routes at ${siteUrl}.`);
