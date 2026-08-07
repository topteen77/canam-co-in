#!/usr/bin/env node

// Script to copy essential files to dist after build
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.join(__dirname, '../dist');
const rootPath = path.join(__dirname, '..');
const appEnv = (process.env.VITE_APP_ENV || process.env.APP_ENV || '').toLowerCase();
const isStaging = process.env.VITE_NOINDEX === 'true' || appEnv === 'staging' || appEnv === 'dev';

const filesToCopy = [
  { from: 'sw.js', to: 'sw.js' },
  { from: 'manifest.json', to: 'manifest.json' },
];

try {
  if (!fs.existsSync(distPath)) {
    console.error('❌ dist folder does not exist. Run vite build first.');
    process.exit(1);
  }

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

  // robots.txt: staging never indexed
  const robotsSrc = path.join(
    rootPath,
    'public',
    isStaging ? 'robots.staging.txt' : 'robots.txt'
  );
  const robotsDest = path.join(distPath, 'robots.txt');
  if (fs.existsSync(robotsSrc)) {
    fs.copyFileSync(robotsSrc, robotsDest);
    console.log(`✅ Copied ${isStaging ? 'robots.staging.txt' : 'robots.txt'} → dist/robots.txt`);
    copiedCount++;
  }

  console.log(`✅ Build files copy complete: ${copiedCount} file(s) copied (env=${appEnv || 'unset'}, staging=${isStaging})`);
} catch (error) {
  console.error('❌ Failed to copy build files:', error);
  process.exit(1);
}
