import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const iconsDir = path.join(root, 'public', 'icons');
const splashDir = path.join(root, 'public', 'splash');

const INK = '#070d0b';
const INK_850 = '#0f1b16';
const IVORY = '#f4eddd';
const CINNABAR = '#e4573f';

function tallyMark(size, stroke, accent, opacity = 1) {
  const s = size;
  const barWidth = s * 0.055;
  const gap = s * 0.115;
  const startX = s / 2 - gap * 1.5;
  const top = s * 0.24;
  const bottom = s * 0.76;
  const bars = [0, 1, 2, 3]
    .map(
      (index) =>
        `<rect x="${startX + index * gap - barWidth / 2}" y="${top}" width="${barWidth}" height="${bottom - top}" rx="${barWidth / 2}" fill="${stroke}" />`,
    )
    .join('');
  const strike = `<rect x="${startX - gap * 0.55}" y="${s / 2 - barWidth / 2}" width="${gap * 3 + gap * 1.1}" height="${barWidth}" rx="${barWidth / 2}" fill="${accent}" transform="rotate(-24 ${s / 2} ${s / 2})" />`;
  return `<g opacity="${opacity}">${bars}${strike}</g>`;
}

function iconSvg(size, { maskable = false } = {}) {
  const inset = maskable ? size * 0.16 : size * 0.08;
  const markSize = size - inset * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="glow" cx="30%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#1c3a2c" />
      <stop offset="100%" stop-color="${INK}" />
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#glow)" />
  <rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${size * 0.18}" fill="none" stroke="${CINNABAR}" stroke-opacity="0.35" stroke-width="${size * 0.008}" />
  <g transform="translate(${inset} ${inset})">${tallyMark(markSize, IVORY, CINNABAR)}</g>
</svg>`;
}

function splashSvg(width, height) {
  const mark = Math.min(width, height) * 0.22;
  const cx = width / 2;
  const cy = height * 0.44;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="a" cx="28%" cy="18%" r="85%">
      <stop offset="0%" stop-color="#1b3a2b" />
      <stop offset="55%" stop-color="${INK_850}" />
      <stop offset="100%" stop-color="${INK}" />
    </radialGradient>
    <radialGradient id="b" cx="80%" cy="88%" r="60%">
      <stop offset="0%" stop-color="${CINNABAR}" stop-opacity="0.16" />
      <stop offset="100%" stop-color="${CINNABAR}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#a)" />
  <rect width="${width}" height="${height}" fill="url(#b)" />
  <g transform="translate(${cx - mark / 2} ${cy - mark / 2})">${tallyMark(mark, IVORY, CINNABAR)}</g>
  <text x="${cx}" y="${cy + mark * 0.95}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${Math.round(width * 0.075)}" font-weight="700" letter-spacing="${Math.round(width * 0.004)}" fill="${IVORY}">Tally</text>
  <text x="${cx}" y="${cy + mark * 1.28}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="${Math.round(width * 0.022)}" font-weight="500" letter-spacing="${Math.round(width * 0.006)}" fill="${CINNABAR}">MAHJONG LEDGER</text>
</svg>`;
}

const splashSizes = [
  [1170, 2532],
  [1179, 2556],
  [1206, 2622],
  [1284, 2778],
  [1290, 2796],
  [1320, 2868],
  [1125, 2436],
  [1242, 2688],
  [828, 1792],
  [750, 1334],
];

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(splashDir, { recursive: true });

  const iconJobs = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-192.png', 192, true],
    ['icon-maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, false],
  ];
  for (const [name, size, maskable] of iconJobs) {
    const pipeline = sharp(Buffer.from(iconSvg(size, { maskable })));
    const flattened =
      name === 'apple-touch-icon.png' ? pipeline.flatten({ background: INK }) : pipeline;
    await flattened.png({ compressionLevel: 9 }).toFile(path.join(iconsDir, name));
  }

  for (const [width, height] of splashSizes) {
    await sharp(Buffer.from(splashSvg(width, height)))
      .png({ compressionLevel: 9 })
      .toFile(path.join(splashDir, `apple-splash-${width}x${height}.png`));
  }

  await writeFile(
    path.join(root, 'public', 'favicon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${INK}" />
  <g transform="translate(8 8)">${tallyMark(48, IVORY, CINNABAR)}</g>
</svg>
`,
  );

  process.stdout.write(
    `Generated ${iconJobs.length} icons and ${splashSizes.length} splash images.\n`,
  );
}

await main();
