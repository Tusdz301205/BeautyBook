import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(frontendRoot, '..', '..');
const planPath = path.join(repoRoot, 'docs', 'generated-images', 'beautybook', 'entity-plan.json');
const groups = ['businesses', 'branches', 'services'];

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
const pending = [];

for (const entry of entries) {
  if (!entry.original || !entry.entityId) continue;
  const outputPath = path.resolve(repoRoot, entry.original);
  if (!(await exists(outputPath))) pending.push({ ...entry, outputPath });
}

if (!pending.length) {
  console.log(`All ${entries.length} entity originals already exist.`);
  process.exit(0);
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
let generated = 0;

try {
  for (const entry of pending) {
    const width = Number(entry.originalWidth) || 1440;
    const height = Number(entry.originalHeight) || 1080;
    const dataUrl = await page.evaluate(({ entry, width, height }) => {
      function hashString(value) {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index += 1) {
          hash ^= value.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
      }

      function randomFactory(seedValue) {
        let state = seedValue || 1;
        return () => {
          state ^= state << 13;
          state ^= state >>> 17;
          state ^= state << 5;
          return (state >>> 0) / 4294967296;
        };
      }

      function normalize(value) {
        return String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      }

      function classify() {
        const value = normalize([
          entry.name,
          entry.categoryName,
          entry.businessName,
          entry.branchName,
        ].filter(Boolean).join(' '));
        if (/nail|mong|manicure|pedicure|son gel/.test(value)) return 'nails';
        if (/lash|long mi|noi mi|brow|long may|phun xam|dieu khac/.test(value)) return 'brow';
        if (/trang diem|makeup/.test(value)) return 'makeup';
        if (/toc|hair|cat toc|nhuom|uon|duoi|phuc hoi/.test(value)) return 'hair';
        if (/wax|triet long|tay long/.test(value)) return 'wax';
        if (/spa|massage|body|duong sinh|thu gian/.test(value)) return 'spa';
        if (/da mat|skincare|facial|tri mun|peel|cap am|tre hoa|serum|clinic/.test(value)) return 'skin';
        return 'mixed';
      }

      const palettes = {
        hair: ['#f2e7dc', '#c69f7d', '#5f4334', '#faf6f1', '#9f765d'],
        nails: ['#f7e6ea', '#c76a84', '#7f3f55', '#fff7f8', '#e8b6c2'],
        brow: ['#efe5dc', '#9b6c58', '#3c2d29', '#fbf8f4', '#c8a08d'],
        makeup: ['#f5e4df', '#d9897a', '#714a4a', '#fff8f5', '#c6a38e'],
        wax: ['#f4ead8', '#d3a354', '#7c5a31', '#fffaf0', '#e8c98c'],
        spa: ['#e7eee8', '#819e88', '#4f6857', '#f8fbf7', '#c4d2c6'],
        skin: ['#ece7df', '#b9aa97', '#6f655a', '#fbfaf7', '#cbd6c2'],
        mixed: ['#eee8e3', '#b48b76', '#655047', '#fbf8f5', '#d9c5b7'],
      };

      const seed = hashString(`${entry.group}:${entry.entityId}:${entry.name || ''}`);
      const random = randomFactory(seed);
      const theme = classify();
      const palette = palettes[theme];
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(0.55, palette[3]);
      gradient.addColorStop(1, palette[0]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      for (let index = 0; index < 7; index += 1) {
        const x = width * (0.08 + random() * 0.84);
        const y = height * (0.04 + random() * 0.78);
        const radius = width * (0.04 + random() * 0.12);
        ctx.save();
        ctx.globalAlpha = 0.08 + random() * 0.08;
        ctx.fillStyle = index % 2 ? palette[1] : palette[4];
        ctx.beginPath();
        ctx.ellipse(x, y, radius * (0.8 + random()), radius * (0.45 + random() * 0.7), random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const slabY = height * (0.72 + random() * 0.05);
      ctx.save();
      ctx.shadowColor = 'rgba(65, 45, 35, 0.18)';
      ctx.shadowBlur = width * 0.03;
      ctx.shadowOffsetY = height * 0.025;
      ctx.fillStyle = 'rgba(255,255,255,0.74)';
      ctx.beginPath();
      ctx.roundRect(width * 0.08, slabY, width * 0.84, height * 0.17, width * 0.035);
      ctx.fill();
      ctx.restore();

      function shadow() {
        ctx.shadowColor = 'rgba(59, 42, 34, 0.20)';
        ctx.shadowBlur = width * 0.016;
        ctx.shadowOffsetY = height * 0.015;
      }

      function clearShadow() {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      }

      function roundedBox(x, y, w, h, radius, fill, stroke = null) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = Math.max(2, width * 0.003);
          ctx.stroke();
        }
      }

      function bottle(x, y, scale, body = palette[1], cap = palette[2]) {
        ctx.save();
        shadow();
        roundedBox(x, y, width * 0.12 * scale, height * 0.24 * scale, width * 0.025 * scale, body);
        clearShadow();
        roundedBox(x + width * 0.03 * scale, y - height * 0.055 * scale, width * 0.06 * scale, height * 0.065 * scale, width * 0.009 * scale, cap);
        ctx.globalAlpha = 0.28;
        roundedBox(x + width * 0.018 * scale, y + height * 0.018 * scale, width * 0.018 * scale, height * 0.17 * scale, width * 0.009 * scale, '#ffffff');
        ctx.restore();
      }

      function jar(x, y, scale, body = palette[4], lid = palette[2]) {
        ctx.save();
        shadow();
        roundedBox(x, y, width * 0.16 * scale, height * 0.105 * scale, width * 0.035 * scale, body);
        clearShadow();
        roundedBox(x - width * 0.008 * scale, y - height * 0.028 * scale, width * 0.176 * scale, height * 0.038 * scale, width * 0.014 * scale, lid);
        ctx.restore();
      }

      function comb(x, y, scale, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = palette[2];
        ctx.lineWidth = width * 0.012 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-width * 0.12 * scale, 0);
        ctx.lineTo(width * 0.12 * scale, 0);
        ctx.stroke();
        ctx.lineWidth = width * 0.004 * scale;
        for (let index = -8; index <= 8; index += 1) {
          const tx = index * width * 0.014 * scale;
          ctx.beginPath();
          ctx.moveTo(tx, height * 0.004 * scale);
          ctx.lineTo(tx, height * 0.055 * scale);
          ctx.stroke();
        }
        ctx.restore();
      }

      function scissors(x, y, scale, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = palette[2];
        ctx.lineWidth = width * 0.008 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width * 0.19 * scale, -height * 0.08 * scale);
        ctx.moveTo(0, 0);
        ctx.lineTo(width * 0.2 * scale, height * 0.075 * scale);
        ctx.stroke();
        ctx.lineWidth = width * 0.006 * scale;
        for (const cy of [-height * 0.048 * scale, height * 0.048 * scale]) {
          ctx.beginPath();
          ctx.arc(-width * 0.025 * scale, cy, width * 0.03 * scale, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      function brush(x, y, scale, angle, tip = palette[1]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = palette[2];
        ctx.lineCap = 'round';
        ctx.lineWidth = width * 0.012 * scale;
        ctx.beginPath();
        ctx.moveTo(-width * 0.13 * scale, 0);
        ctx.lineTo(width * 0.08 * scale, 0);
        ctx.stroke();
        ctx.fillStyle = tip;
        ctx.beginPath();
        ctx.ellipse(width * 0.12 * scale, 0, width * 0.055 * scale, height * 0.025 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function polish(x, y, scale, body) {
        ctx.save();
        shadow();
        roundedBox(x, y, width * 0.11 * scale, height * 0.13 * scale, width * 0.018 * scale, body);
        clearShadow();
        roundedBox(x + width * 0.03 * scale, y - height * 0.09 * scale, width * 0.05 * scale, height * 0.10 * scale, width * 0.01 * scale, palette[2]);
        ctx.restore();
      }

      function stones(x, y, scale) {
        ctx.save();
        shadow();
        for (let index = 0; index < 3; index += 1) {
          ctx.fillStyle = index % 2 ? palette[2] : palette[1];
          ctx.beginPath();
          ctx.ellipse(x + index * width * 0.045 * scale, y - index * height * 0.034 * scale, width * 0.085 * scale, height * 0.04 * scale, -0.12 + index * 0.09, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      function towels(x, y, scale) {
        ctx.save();
        shadow();
        for (let index = 0; index < 3; index += 1) {
          roundedBox(x + index * width * 0.018 * scale, y - index * height * 0.05 * scale, width * 0.25 * scale, height * 0.065 * scale, width * 0.015 * scale, index === 1 ? palette[0] : '#fdfbf8');
        }
        ctx.restore();
      }

      function tweezers(x, y, scale, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = palette[2];
        ctx.lineWidth = width * 0.006 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-width * 0.13 * scale, -height * 0.018 * scale);
        ctx.lineTo(width * 0.13 * scale, -height * 0.004 * scale);
        ctx.moveTo(-width * 0.13 * scale, height * 0.018 * scale);
        ctx.lineTo(width * 0.13 * scale, height * 0.004 * scale);
        ctx.stroke();
        ctx.restore();
      }

      function paletteDisk(x, y, scale) {
        ctx.save();
        shadow();
        ctx.fillStyle = '#f8f1ed';
        ctx.beginPath();
        ctx.arc(x, y, width * 0.13 * scale, 0, Math.PI * 2);
        ctx.fill();
        clearShadow();
        const swatches = [palette[1], palette[4], palette[2], '#d7b09d', '#8d655d'];
        for (let index = 0; index < swatches.length; index += 1) {
          const angle = index * Math.PI * 2 / swatches.length;
          ctx.fillStyle = swatches[index];
          ctx.beginPath();
          ctx.arc(x + Math.cos(angle) * width * 0.07 * scale, y + Math.sin(angle) * width * 0.07 * scale, width * 0.026 * scale, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      const drift = () => (random() - 0.5) * width * 0.035;
      const angle = () => (random() - 0.5) * 0.55;
      const leftX = width * 0.17 + drift();
      const centerX = width * 0.48 + drift();
      const rightX = width * 0.71 + drift();
      const propY = height * 0.47 + (random() - 0.5) * height * 0.06;

      if (theme === 'hair') {
        scissors(leftX, propY, 1.2, angle());
        comb(centerX, propY + height * 0.08, 1.15, angle());
        bottle(rightX, propY - height * 0.07, 0.9);
      } else if (theme === 'nails') {
        polish(leftX, propY, 1.2, palette[1]);
        polish(centerX, propY + height * 0.04, 1.0, palette[4]);
        brush(rightX, propY + height * 0.10, 1.0, angle(), palette[1]);
      } else if (theme === 'brow') {
        tweezers(leftX, propY, 1.2, angle());
        brush(centerX, propY + height * 0.04, 0.95, angle(), palette[2]);
        jar(rightX, propY + height * 0.04, 0.85);
      } else if (theme === 'makeup') {
        paletteDisk(leftX + width * 0.08, propY + height * 0.03, 1.0);
        brush(centerX, propY + height * 0.02, 1.1, angle(), palette[1]);
        bottle(rightX, propY - height * 0.08, 0.8, palette[4]);
      } else if (theme === 'wax') {
        jar(leftX, propY + height * 0.04, 1.0, '#ddb769');
        brush(centerX, propY + height * 0.06, 1.1, angle(), '#c69a52');
        bottle(rightX, propY - height * 0.08, 0.82, '#d7b57a');
      } else if (theme === 'spa') {
        towels(leftX - width * 0.05, propY + height * 0.03, 1.0);
        stones(centerX, propY + height * 0.10, 1.0);
        bottle(rightX, propY - height * 0.08, 0.84, '#a77c54');
      } else if (theme === 'skin') {
        bottle(leftX, propY - height * 0.08, 0.86, '#b8c7b2');
        jar(centerX, propY + height * 0.04, 0.96, '#d7d9cc');
        stones(rightX, propY + height * 0.08, 0.75);
      } else {
        scissors(leftX, propY, 0.92, angle());
        jar(centerX, propY + height * 0.04, 0.88);
        polish(rightX, propY, 0.95, palette[1]);
      }

      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = palette[2];
      ctx.lineWidth = Math.max(2, width * 0.0024);
      for (let index = 0; index < 8; index += 1) {
        const x = width * (0.12 + random() * 0.76);
        const y = height * (0.12 + random() * 0.68);
        ctx.beginPath();
        ctx.arc(x, y, width * (0.004 + random() * 0.008), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(2, width * 0.002);
      ctx.strokeRect(width * 0.028, height * 0.038, width * 0.944, height * 0.924);
      ctx.restore();

      return canvas.toDataURL('image/png');
    }, { entry, width, height });

    await fs.mkdir(path.dirname(entry.outputPath), { recursive: true });
    await fs.writeFile(entry.outputPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
    generated += 1;
    if (generated % 50 === 0 || generated === pending.length) {
      console.log(`Generated ${generated}/${pending.length} entity originals.`);
    }
  }
} finally {
  await browser.close();
}

console.log(`Created ${generated} unique BeautyBook entity illustrations. Existing originals kept: ${entries.length - pending.length}.`);
