import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const outputPath = path.resolve(repoRoot, 'docs', 'generated-images', 'beautybook', 'entity-plan.json');

const palettes = [
  'warm ivory, dusty rose and brushed brass',
  'soft sage, cream and pale stone',
  'pearl white, muted mauve and clear glass',
  'sand, terracotta blush and warm oak',
  'cool porcelain, lavender grey and chrome',
  'champagne beige, cocoa brown and linen white',
  'mist blue, shell pink and light travertine',
  'olive green, warm cream and natural walnut',
];

const lightings = [
  'soft morning window light from the left',
  'bright diffused studio daylight',
  'gentle late-afternoon side light',
  'soft overhead daylight with clean shadows',
  'airy backlight with subtle reflections',
  'neutral daylight with a quiet editorial contrast',
];

const compositions = [
  'asymmetric editorial arrangement with generous negative space',
  'balanced flat-lay with layered objects and a clear focal point',
  'three-quarter tabletop composition with foreground depth',
  'minimal diagonal composition with one hero object',
  'structured grid-like still life with soft organic accents',
  'close editorial crop with foreground and background separation',
];

const accents = [
  'a small ceramic tray',
  'a folded linen towel',
  'a clear glass dish',
  'a smooth river stone',
  'a single botanical stem',
  'a matte metal tool holder',
  'a translucent acrylic block',
  'a pale wood grooming tray',
];

function pick(list, key, offset = 0) {
  const hash = crypto.createHash('sha256').update(`${key}:${offset}`).digest();
  return list[hash.readUInt32BE(0) % list.length];
}

function fileKey(prefix, id) {
  return `${prefix}-${String(id).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12)}`;
}

function mediaSpec(group, key, ratio = '4:3') {
  const [width, height] = ratio === '16:10' ? [1600, 1000] : [1440, 1080];
  const widths = group === 'services' ? [320, 640, 960] : [480, 800, 1200];
  return {
    original: `docs/generated-images/beautybook/originals/${group}/${key}.png`,
    originalWidth: width,
    originalHeight: height,
    outputs: widths.map((item) => ({
      path: `/images/beautybook/${group}/${key}/${key}-${item}.webp`,
      width: item,
      height: Math.round(item * height / width),
    })),
  };
}

function sceneSignature(id) {
  return [
    pick(palettes, id, 1),
    pick(lightings, id, 2),
    pick(compositions, id, 3),
    pick(accents, id, 4),
  ];
}

function businessPrompt(row, categories) {
  const [palette, lighting, composition, accent] = sceneSignature(row.id);
  const serviceMix = categories.length ? categories.join(', ') : 'hair, skincare, nail and spa services';
  return `Photorealistic editorial beauty still life concept for the marketplace listing of ${row.name}. Reflect its service mix: ${serviceMix}. Use ${palette}; ${lighting}; ${composition}; include ${accent}. Unbranded professional beauty tools and products only. No identifiable people, no staff, no customers, no treatment result, no logo, no readable labels, no text, no watermark. This is a conceptual BeautyBook illustration and must not look like a documentary photo of the real business premises.`;
}

function branchPrompt(row) {
  const [palette, lighting, composition, accent] = sceneSignature(row.id);
  return `Photorealistic editorial beauty still life concept for the ${row.business_name} branch named ${row.name}. Build a unique mood using ${palette}; ${lighting}; ${composition}; include ${accent}. Hint at a polished appointment-ready beauty workspace through tools, towels, product vessels and materials, without showing a recognizable real interior. No identifiable people, no staff, no customers, no treatment result, no logo, no readable labels, no text, no watermark. Concept illustration only, not a photo of the actual branch.`;
}

function servicePrompt(row) {
  const [palette, lighting, composition, accent] = sceneSignature(row.id);
  return `Photorealistic close editorial still life illustrating the beauty service “${row.name}” in category “${row.category_name}”, offered by ${row.business_name}. Show only relevant professional tools, textures or unbranded products that clearly communicate this service. Use ${palette}; ${lighting}; ${composition}; include ${accent}. No identifiable people, no body parts, no staff, no customers, no before-and-after result, no medical claim, no logo, no readable labels, no text, no watermark. Concept illustration only.`;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const [businessesResult, branchesResult, servicesResult, mixResult] = await Promise.all([
    client.query(`
      select id, name, slug, description
      from businesses
      where deleted_at is null
      order by name, id
    `),
    client.query(`
      select br.id, br.name, br.public_name, br.address_line, br.ward,
             br.business_id, b.name as business_name, b.slug as business_slug
      from branches br
      join businesses b on b.id = br.business_id
      where br.deleted_at is null and b.deleted_at is null
      order by b.name, br.name, br.id
    `),
    client.query(`
      select s.id, s.name, s.description, s.branch_id, s.category_id,
             br.name as branch_name, b.id as business_id, b.name as business_name,
             sc.name as category_name
      from services s
      join branches br on br.id = s.branch_id
      join businesses b on b.id = br.business_id
      join service_categories sc on sc.id = s.category_id
      where s.deleted_at is null and br.deleted_at is null and b.deleted_at is null
      order by b.name, br.name, s.name, s.id
    `),
    client.query(`
      select b.id as business_id, sc.name as category_name, count(*)::int as total
      from services s
      join branches br on br.id = s.branch_id
      join businesses b on b.id = br.business_id
      join service_categories sc on sc.id = s.category_id
      where s.deleted_at is null and br.deleted_at is null and b.deleted_at is null
      group by b.id, sc.name
      order by b.id, total desc, sc.name
    `),
  ]);

  const mixByBusiness = new Map();
  for (const row of mixResult.rows) {
    const list = mixByBusiness.get(row.business_id) || [];
    if (list.length < 4) list.push(row.category_name);
    mixByBusiness.set(row.business_id, list);
  }

  const businesses = businessesResult.rows.map((row) => {
    const key = fileKey('business', row.id);
    return {
      entityType: 'business',
      entityId: row.id,
      entityKey: key,
      name: row.name,
      slug: row.slug,
      alt: `Ảnh minh họa phong cách dịch vụ của ${row.name}`,
      prompt: businessPrompt(row, mixByBusiness.get(row.id) || []),
      usage: [`Marketplace - thương hiệu ${row.name}`],
      ...mediaSpec('businesses', key, '16:10'),
    };
  });

  const branches = branchesResult.rows.map((row) => {
    const key = fileKey('branch', row.id);
    return {
      entityType: 'branch',
      entityId: row.id,
      entityKey: key,
      businessId: row.business_id,
      businessName: row.business_name,
      name: row.public_name || row.name,
      address: [row.address_line, row.ward].filter(Boolean).join(', '),
      alt: `Ảnh minh họa cho ${row.public_name || row.name} của ${row.business_name}`,
      prompt: branchPrompt({ ...row, name: row.public_name || row.name }),
      usage: [
        `Marketplace - thẻ cơ sở ${row.public_name || row.name}`,
        `Chi tiết cơ sở ${row.public_name || row.name} - hero fallback`,
      ],
      ...mediaSpec('branches', key, '16:10'),
    };
  });

  const services = servicesResult.rows.map((row) => {
    const key = fileKey('service', row.id);
    return {
      entityType: 'service',
      entityId: row.id,
      entityKey: key,
      businessId: row.business_id,
      businessName: row.business_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      categoryId: row.category_id,
      categoryName: row.category_name,
      name: row.name,
      alt: `Ảnh minh họa dịch vụ ${row.name}`,
      prompt: servicePrompt(row),
      usage: [
        `Marketplace - thẻ dịch vụ ${row.name}`,
        `Chi tiết dịch vụ ${row.name} - hero fallback`,
      ],
      ...mediaSpec('services', key, '4:3'),
    };
  });

  const plan = {
    generatedAt: new Date().toISOString(),
    source: 'BeautyBook local seeded database',
    policy: {
      entityImagesMustBeUnique: true,
      generatedImagesAreConceptIllustrations: true,
      noSyntheticStaffOrCustomers: true,
      noSyntheticTreatmentResults: true,
    },
    counts: {
      businesses: businesses.length,
      branches: branches.length,
      services: services.length,
      total: businesses.length + branches.length + services.length,
    },
    businesses,
    branches,
    services,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  await client.end();
  console.log(`Wrote ${plan.counts.total} entity image plans to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
