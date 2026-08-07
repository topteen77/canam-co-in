import fs from 'fs';
import path from 'path';

console.log('🔧 Setting up environment configuration...\n');

// Get Firebase Admin SDK credentials from user
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupEnvironment() {
  try {
    console.log('📋 Please provide your Firebase Admin SDK credentials:');
    console.log('   (Get these from Firebase Console → Project Settings → Service Accounts)\n');

    const projectId = await question('Firebase Project ID (agent-follow-up-crm): ') || 'agent-follow-up-crm';
    const privateKeyId = await question('Private Key ID: ');
    const privateKey = await question('Private Key (paste the entire key): ');
    const clientEmail = await question('Client Email: ');
    const clientId = await question('Client ID: ');

    console.log('\n📧 Email Configuration (optional):');
    const smtpUser = await question('SMTP User (email): ');
    const smtpPass = await question('SMTP Password (app password): ');

    console.log('\n🔐 Security Configuration:');
    const jwtSecret = await question('JWT Secret (press Enter for auto-generated): ') || 
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    // Create .env content
    const envContent = `# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID=${projectId}
FIREBASE_PRIVATE_KEY_ID=${privateKeyId}
FIREBASE_PRIVATE_KEY="${privateKey.replace(/\n/g, '\\n')}"
FIREBASE_CLIENT_EMAIL=${clientEmail}
FIREBASE_CLIENT_ID=${clientId}
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Server Configuration
PORT=3001
NODE_ENV=production

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=${smtpUser}
SMTP_PASS=${smtpPass}

# Admin Configuration
ADMIN_EMAIL=canamrakesh@gmail.com
ADMIN_PASSWORD=@16Agentcrm

# Security
JWT_SECRET=${jwtSecret}
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100`;

    // Write .env file
    fs.writeFileSync('.env', envContent);
    console.log('\n✅ Environment configuration saved to .env file');
    console.log('🚀 You can now run: npm start');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

setupEnvironment();






















































