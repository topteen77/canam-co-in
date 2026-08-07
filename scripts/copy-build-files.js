#!/usr/bin/env node

// Script to copy essential files to dist after build
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '../dist');
const rootPath = path.join(__dirname, '..');

// Files to copy from root to dist
const filesToCopy = [
  { from: 'sw.js', to: 'sw.js' },
  { from: 'manifest.json', to: 'manifest.json' }
];

try {
  // Ensure dist folder exists
  if (!fs.existsSync(distPath)) {
    console.error('❌ dist folder does not exist. Run vite build first.');
    process.exit(1);
  }

  // Copy files
  let copiedCount = 0;
  filesToCopy.forEach(({ from, to }) => {
    const sourcePath = path.join(rootPath, from);
    const destPath = path.join(distPath, to);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${from} to dist/${to}`);
      copiedCount++;
    } else {
      console.warn(`⚠️ Source file not found: ${from}`);
    }
  });

  console.log(`✅ Build files copy complete: ${copiedCount} file(s) copied`);

} catch (error) {
  console.error('❌ Failed to copy build files:', error);
  process.exit(1);
}



