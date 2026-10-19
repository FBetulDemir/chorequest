// Generates the PWA / app icons from the SVG sources in public/icons.
// Run with: node scripts/generate-icons.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const iconDir = path.join(__dirname, '../public/icons');
const roundedSvg = path.join(iconDir, 'icon.svg'); // "any" purpose, rounded corners
const maskableSvg = path.join(iconDir, 'icon-maskable.svg'); // full bleed, OS crops it

const anySizes = [72, 96, 128, 144, 152, 192, 384, 512];
const maskableSizes = [192, 512];

async function render(input, size, file) {
  await sharp(input, { density: 384 }).resize(size, size).png().toFile(path.join(iconDir, file));
  console.log(`Created: ${file}`);
}

async function generateIcons() {
  if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });

  for (const size of anySizes) await render(roundedSvg, size, `icon-${size}x${size}.png`);
  for (const size of maskableSizes) await render(maskableSvg, size, `maskable-${size}x${size}.png`);

  // iOS rounds the corners itself and doesn't allow transparency
  await render(maskableSvg, 180, 'apple-touch-icon.png');

  await render(roundedSvg, 32, 'favicon-32x32.png');
  await render(roundedSvg, 16, 'favicon-16x16.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
