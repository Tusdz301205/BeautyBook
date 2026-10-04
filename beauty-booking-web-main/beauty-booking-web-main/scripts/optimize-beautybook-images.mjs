import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(frontendRoot, '..', '..');
const originalsRoot = path.join(repoRoot, 'docs', 'generated-images', 'beautybook', 'originals');
const publicRoot = path.join(frontendRoot, 'public', 'images', 'beautybook');
const manifestPath = path.join(repoRoot, 'docs', 'generated-images', 'beautybook', 'manifest.json');

const assets = [
  {
    key: 'hero',
    source: 'beautybook-home-hero.png',
    folder: 'home',
    stem: 'beautybook-home-hero',
    widths: [480, 768, 1024],
    quality: 0.82,
    prompt: 'Photorealistic editorial BeautyBook still life, portrait 4:5, unbranded skincare bottles, blush nail polish, hair scissors and comb, folded spa towel, flower on warm pale stone; warm ivory and dusty rose; no identifiable salon, people, labels, logos, text or watermark; generic conceptual imagery only.',
    usage: ['Trang chủ - hero LCP'],
    alt: 'Bộ sản phẩm chăm sóc sắc đẹp và dụng cụ làm tóc',
  },
  {
    key: 'hair',
    source: 'hair-care-editorial.png',
    folder: 'categories',
    stem: 'hair-care-editorial',
    widths: [320, 640, 960],
    quality: 0.8,
    prompt: '4:3 editorial still life, scissors, comb, round brush, unbranded frosted serum, ribbon of natural dark hair on ivory stone; bright soft window light; no people, salon identity, labels, text or treatment results.',
    usage: ['Trang chủ - danh mục tóc', 'BeautyBook Business - hero', 'Auth đăng ký doanh nghiệp'],
    alt: 'Dụng cụ chăm sóc và tạo kiểu tóc',
  },
  {
    key: 'nails',
    source: 'nail-care-editorial.png',
    folder: 'categories',
    stem: 'nail-care-editorial',
    widths: [320, 640, 960],
    quality: 0.8,
    prompt: '4:3 editorial still life with unbranded dusty rose, nude and deep berry nail polish, glass file, cuticle tool, ceramic dish and delicate flower on warm stone; no hands, people, salon identity, labels, text or treatment results.',
    usage: ['Trang chủ - danh mục móng', 'Auth lời mời'],
    alt: 'Sơn móng và dụng cụ chăm sóc móng',
  },
  {
    key: 'skincare',
    source: 'skincare-editorial.png',
    folder: 'categories',
    stem: 'skincare-editorial',
    widths: [320, 640, 960],
    quality: 0.8,
    prompt: '4:3 editorial still life with frosted serum, minimal cream jar, facial stone, cotton pads and green leaf on ivory travertine; no people, clinic identity, labels, text or treatment results.',
    usage: ['Trang chủ - danh mục chăm sóc da', 'Auth đăng nhập', 'CTA cuối trang'],
    alt: 'Sản phẩm chăm sóc da và dụng cụ massage mặt',
  },
  {
    key: 'spa',
    source: 'spa-wellness-editorial.png',
    folder: 'categories',
    stem: 'spa-wellness-editorial',
    widths: [320, 640, 960],
    quality: 0.8,
    prompt: '4:3 editorial still life with folded cream towels, massage stones, unbranded amber oil bottle, ceramic bowl and eucalyptus; no people, spa identity, labels, text or treatment results.',
    usage: ['Trang chủ - danh mục spa và massage', 'Auth khôi phục', 'Khối lịch trống'],
    alt: 'Khăn spa, đá massage và dầu chăm sóc cơ thể',
  },
  {
    key: 'availability',
    source: 'availability-planning-editorial.png',
    folder: 'home',
    stem: 'availability-planning-editorial',
    widths: [480, 768, 1200],
    quality: 0.8,
    prompt: '16:9 BeautyBook editorial still life about planning an appointment, with a neutral calendar card, clock, folded towel and unbranded beauty objects; no people, hands, readable text, logos, identifiable facilities or treatment results.',
    usage: ['Trang chủ - khối lịch phù hợp'],
    alt: 'Ảnh minh họa lịch hẹn làm đẹp với đồng hồ và vật dụng chăm sóc',
  },
  {
    key: 'finalCta',
    source: 'final-cta-editorial.png',
    folder: 'home',
    stem: 'final-cta-editorial',
    widths: [480, 768, 1200],
    quality: 0.8,
    prompt: '16:9 BeautyBook editorial beauty ritual still life for a final call to action, with unbranded skincare, flower, towel and small grooming tools; no people, hands, readable text, logos, identifiable facilities or treatment results.',
    usage: ['Trang chủ - CTA cuối trang'],
    alt: 'Ảnh minh họa vật dụng cho một buổi chăm sóc sắc đẹp',
  },
  {
    key: 'businessHero',
    source: 'business-hero-editorial.png',
    folder: 'business',
    stem: 'business-hero-editorial',
    widths: [480, 768, 1200],
    quality: 0.8,
    prompt: '16:9 editorial still life for beauty business operations, with appointment planner, tablet-like blank board and professional beauty tools on a clean desk; no people, readable text, logos, identifiable salons or treatment results.',
    usage: ['BeautyBook Business - hero'],
    alt: 'Ảnh minh họa bàn làm việc vận hành cơ sở làm đẹp',
  },
  {
    key: 'authLogin',
    source: 'auth-login-editorial.png',
    folder: 'auth',
    stem: 'auth-login-editorial',
    widths: [360, 720, 1080],
    quality: 0.8,
    prompt: '5:4 editorial beauty still life for a login screen, with calm unbranded skincare and grooming objects; no people, hands, readable text, logos, identifiable facilities or treatment results.',
    usage: ['Auth - đăng nhập'],
    alt: '',
  },
  {
    key: 'authRegister',
    source: 'auth-register-editorial.png',
    folder: 'auth',
    stem: 'auth-register-editorial',
    widths: [360, 720, 1080],
    quality: 0.8,
    prompt: '5:4 editorial beauty still life for account registration, with varied unbranded beauty tools and products arranged as a welcoming collection; no people, hands, readable text, logos, identifiable facilities or treatment results.',
    usage: ['Auth - đăng ký'],
    alt: '',
  },
  {
    key: 'authRecovery',
    source: 'auth-recovery-editorial.png',
    folder: 'auth',
    stem: 'auth-recovery-editorial',
    widths: [360, 720, 1080],
    quality: 0.8,
    prompt: '5:4 calm editorial beauty still life for account recovery, with neutral skincare objects and a small lock-inspired abstract prop; no people, hands, readable text, logos, identifiable facilities or treatment results.',
    usage: ['Auth - khôi phục và xác minh'],
    alt: '',
  },
  {
    key: 'authInvitation',
    source: 'auth-invitation-editorial.png',
    folder: 'auth',
    stem: 'auth-invitation-editorial',
    widths: [360, 720, 1080],
    quality: 0.8,
    prompt: '5:4 editorial beauty still life for a staff invitation flow, with paired unbranded professional tools and a blank invitation card; no people, hands, readable text, logos, identifiable facilities or treatment results.',
    usage: ['Auth - lời mời nhân viên'],
    alt: '',
  },
];

function readPngSize(buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

await fs.mkdir(path.dirname(manifestPath), { recursive: true });
await Promise.all([
  fs.mkdir(path.join(publicRoot, 'home'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'categories'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'business'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'auth'), { recursive: true }),
  fs.mkdir(path.join(publicRoot, 'services'), { recursive: true }),
]);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
const manifest = [];

try {
  for (const asset of assets) {
    const sourcePath = path.join(originalsRoot, asset.source);
    const sourceBuffer = await fs.readFile(sourcePath);
    const dimensions = readPngSize(sourceBuffer);
    const dataUrl = `data:image/png;base64,${sourceBuffer.toString('base64')}`;
    const outputs = [];

    for (const requestedWidth of asset.widths) {
      const width = Math.min(requestedWidth, dimensions.width);
      const encoded = await page.evaluate(async ({ input, width: targetWidth, quality }) => {
        const image = new Image();
        image.src = input;
        await image.decode();
        const height = Math.round((image.naturalHeight / image.naturalWidth) * targetWidth);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, targetWidth, height);
        return {
          dataUrl: canvas.toDataURL('image/webp', quality),
          height,
        };
      }, { input: dataUrl, width, quality: asset.quality });

      const outputName = `${asset.stem}-${width}.webp`;
      const outputPath = path.join(publicRoot, asset.folder, outputName);
      const outputBuffer = Buffer.from(encoded.dataUrl.split(',')[1], 'base64');
      await fs.writeFile(outputPath, outputBuffer);
      outputs.push({
        path: `/images/beautybook/${asset.folder}/${outputName}`,
        width,
        height: encoded.height,
        bytes: outputBuffer.length,
      });
    }

    manifest.push({
      key: asset.key,
      tier: asset.key === 'hero' ? 'global' : 'reusable',
      entitySpecific: false,
      original: `docs/generated-images/beautybook/originals/${asset.source}`,
      originalWidth: dimensions.width,
      originalHeight: dimensions.height,
      originalBytes: sourceBuffer.length,
      prompt: asset.prompt,
      usage: asset.usage,
      alt: asset.alt,
      outputs,
    });
  }
} finally {
  await browser.close();
}

await fs.writeFile(manifestPath, `${JSON.stringify({ generatedAt: '2026-09-24', assets: manifest }, null, 2)}\n`);
console.log(`Generated ${manifest.reduce((total, asset) => total + asset.outputs.length, 0)} WebP files.`);
console.log(`Manifest: ${manifestPath}`);
