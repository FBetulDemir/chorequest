// Builds the source images in /assets that `npx @capacitor/assets generate`
// turns into iOS/Android app icons and splash screens.
// Run with: node scripts/generate-native-assets.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '../assets');

const GRADIENT = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8b5cf6"/>
    <stop offset="0.55" stop-color="#d946ef"/>
    <stop offset="1" stop-color="#ec4899"/>
  </linearGradient>`;

// Tidy, drawn in a 120×120 box (same artwork as src/components/ui/Mascot.tsx)
const MASCOT = `
  <path d="M60 14c3 0 5 1 7 3l34 30c3 3 4 6 4 10v35c0 7-5 12-12 12H27c-7 0-12-5-12-12V57c0-4 1-7 4-10l34-30c2-2 4-3 7-3z" fill="#fff"/>
  <ellipse cx="37" cy="79" rx="6.5" ry="4" fill="#f9a8d4"/>
  <ellipse cx="83" cy="79" rx="6.5" ry="4" fill="#f9a8d4"/>
  <circle cx="46" cy="66" r="5.5" fill="#1f1633"/>
  <circle cx="74" cy="66" r="5.5" fill="#1f1633"/>
  <circle cx="47.8" cy="64" r="1.8" fill="#fff"/>
  <circle cx="75.8" cy="64" r="1.8" fill="#fff"/>
  <path d="M50 79q10 10 20 0" stroke="#1f1633" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M97 14l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#fcd34d"/>`;

/** Mascot centred on a square canvas, `scale` × its 120px box. */
function mascotAt(size, scale) {
  const offset = size / 2 - 60 * scale;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">${MASCOT}</g>`;
}

const svgs = {
  // iOS + fallback: full bleed, no transparency
  'icon-only.png': [1024, `<defs>${GRADIENT}</defs><rect width="1024" height="1024" fill="url(#bg)"/>${mascotAt(1024, 5.4)}`],
  // Android adaptive icon: mascot inside the 66% safe zone on a transparent layer
  'icon-foreground.png': [1024, mascotAt(1024, 4.4)],
  'icon-background.png': [1024, `<defs>${GRADIENT}</defs><rect width="1024" height="1024" fill="url(#bg)"/>`],
  // Splash screens
  'splash.png': [2732, `<defs>${GRADIENT}</defs><rect width="2732" height="2732" fill="url(#bg)"/>${mascotAt(2732, 5)}`],
  'splash-dark.png': [2732, `<rect width="2732" height="2732" fill="#0f0b1a"/>${mascotAt(2732, 5)}`],
};

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  for (const [file, [size, body]] of Object.entries(svgs)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, file));
    console.log(`Created assets/${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
