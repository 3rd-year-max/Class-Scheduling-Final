/**
 * Quick script to check Google Calendar configuration
 * Run with: node scripts/check-google-calendar-config.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n🔍 Checking Google Calendar Configuration...\n');

const hasClientEmail = !!process.env.GOOGLE_CLIENT_EMAIL;
const hasPrivateKey = !!process.env.GOOGLE_PRIVATE_KEY;
const hasProjectId = !!process.env.GOOGLE_PROJECT_ID;

console.log('Environment Variables:');
console.log(`  GOOGLE_CLIENT_EMAIL: ${hasClientEmail ? '✅ SET' : '❌ MISSING'}`);
if (hasClientEmail) {
  console.log(`    Value: ${process.env.GOOGLE_CLIENT_EMAIL.substring(0, 50)}...`);
}

console.log(`  GOOGLE_PRIVATE_KEY: ${hasPrivateKey ? '✅ SET' : '❌ MISSING'}`);
if (hasPrivateKey) {
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const hasBegin = key.includes('BEGIN PRIVATE KEY');
  const hasEnd = key.includes('END PRIVATE KEY');
  const hasNewlines = key.includes('\\n') || key.includes('\n');
  console.log(`    Format Check:`);
  console.log(`      - Has BEGIN PRIVATE KEY: ${hasBegin ? '✅' : '❌'}`);
  console.log(`      - Has END PRIVATE KEY: ${hasEnd ? '✅' : '❌'}`);
  console.log(`      - Has newlines: ${hasNewlines ? '✅' : '❌'}`);
  if (!hasBegin || !hasEnd) {
    console.log(`    ⚠️  WARNING: Private key format may be invalid!`);
  }
}

console.log(`  GOOGLE_PROJECT_ID: ${hasProjectId ? '✅ SET' : '❌ MISSING'}`);
if (hasProjectId) {
  console.log(`    Value: ${process.env.GOOGLE_PROJECT_ID}`);
}

console.log('\n' + '='.repeat(50));
if (hasClientEmail && hasPrivateKey && hasProjectId) {
  console.log('✅ All required variables are SET');
  console.log('\n💡 Next steps:');
  console.log('   1. Make sure your backend server is restarted');
  console.log('   2. Test the endpoint: http://localhost:5000/api/schedule/test/google-calendar');
  console.log('   3. Make sure each instructor\'s calendar is shared with the service account');
} else {
  console.log('❌ Configuration is INCOMPLETE');
  console.log('\n💡 To fix:');
  console.log('   1. Open backend/.env file');
  console.log('   2. Add the missing variables (see backend/env.example for format)');
  console.log('   3. Restart your backend server');
}
console.log('='.repeat(50) + '\n');

