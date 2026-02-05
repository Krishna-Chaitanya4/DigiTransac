// This script generates PWA icons from the favicon.svg
// Run with: node scripts/generate-icons.js

import { readFileSync, mkdirSync, existsSync } from 'fs';
import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const iconsDir = join(__dirname, '../public/icons');
  
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
  }

  const svgPath = join(__dirname, '../public/favicon.svg');
  const svgContent = readFileSync(svgPath);
  
  for (const size of sizes) {
    try {
      await sharp(svgContent)
        .resize(size, size)
        .png()
        .toFile(join(iconsDir, `icon-${size}x${size}.png`));
      console.log(`Generated: icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`Error generating ${size}x${size}:`, error.message);
    }
  }
  
  // Also generate apple-touch-icon
  await sharp(svgContent)
    .resize(180, 180)
    .png()
    .toFile(join(__dirname, '../public/apple-touch-icon.png'));
  console.log('Generated: apple-touch-icon.png');
  
  console.log('Done!');
}

generateIcons();
