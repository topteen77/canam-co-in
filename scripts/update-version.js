#!/usr/bin/env node

// Script to update version.json with current build information
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionJsonPath = path.join(__dirname, '../public/version.json');
const packageJsonPath = path.join(__dirname, '../package.json');
const distPath = path.join(__dirname, '../dist');

try {
  // Read current package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  // Generate version info
  const now = new Date();
  const buildTime = now.toISOString();
  const buildNumber = now.toISOString().replace(/[-:T]/g, '').split('.')[0];
  
  const versionInfo = {
    version: packageJson.version || '2.2.6',
    buildTime: buildTime,
    buildNumber: buildNumber,
    features: [
      "Auto-update system",
      "Mobile cache button", 
      "Enhanced PWA support",
      "Improved mobile responsiveness",
      "Automatic version management",
      "Fixed pagination visibility",
      "Enhanced authentication error handling",
      "Improved Service Worker stability",
      "PWA notification support for scheduled meetings"
    ],
    changelog: [
      "PWA notifications: Users receive notifications 5 minutes before scheduled meetings",
      "Notifications work on Android and web browsers when app is installed as PWA",
      "Notification permission is requested automatically when user logs in",
      "Notifications include meeting details and actions (View, Snooze)",
      "Notifications work even when app is closed (via service worker)",
      "Real-time monitoring of scheduled meetings",
      "Automatic notification cleanup when meetings are cancelled or completed"
    ]
  };
  
  // Write version.json to public folder
  fs.writeFileSync(versionJsonPath, JSON.stringify(versionInfo, null, 2));
  
  // Ensure dist folder exists
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }
  
  // Copy essential files to dist after build
  // Note: This runs before vite build, so files will be copied by vite from public folder
  // But we ensure sw.js and manifest.json are available
  
  console.log('✅ Version updated successfully:');
  console.log(`   Version: ${versionInfo.version}`);
  console.log(`   Build: ${buildNumber}`);
  console.log(`   Time: ${buildTime}`);
  
} catch (error) {
  console.error('❌ Failed to update version:', error);
  process.exit(1);
}
