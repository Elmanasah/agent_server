/**
 * scripts/check-auth.js
 * Run: node scripts/check-auth.js
 * Diagnoses exactly why GCP auth is failing.
 */
import 'dotenv/config';
import { execSync } from 'child_process';
import fs from 'fs';

console.log('\n══════════════════════════════════════════');
console.log('  GCP Auth Diagnosis');
console.log('══════════════════════════════════════════\n');

// ── 1. System clock ───────────────────────────────────────────────────────────
// "Invalid JWT Signature" is almost always a clock skew > 5 minutes.
// GCP tokens are time-signed — if your system clock is wrong, the signature
// is invalid even with a perfectly valid key.
console.log('1. System clock:');
const now = new Date();
console.log(`   Local time:  ${now.toISOString()}`);

try {
    // Fetch current UTC time from a public API to compare
    const { execSync } = await import('child_process');
    const ntpTime = execSync('date -u +"%Y-%m-%dT%H:%M:%SZ"', { encoding: 'utf8' }).trim();
    console.log(`   System UTC:  ${ntpTime}`);
} catch {}

// ── 2. Which credentials are active ──────────────────────────────────────────
console.log('\n2. Active credentials:');

const credsFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (credsFile) {
    console.log(`   GOOGLE_APPLICATION_CREDENTIALS = ${credsFile}`);
    if (!fs.existsSync(credsFile)) {
        console.log('   ❌ File does NOT exist at that path!');
    } else {
        try {
            const key = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
            console.log(`   Key type:         ${key.type}`);
            console.log(`   Service account:  ${key.client_email}`);
            console.log(`   Project:          ${key.project_id}`);
            console.log(`   Key created:      ${key.private_key_id}`);
            // Check for common corruption: key should start with -----BEGIN RSA PRIVATE KEY----- or EC
            const keyOk = key.private_key?.includes('BEGIN');
            console.log(`   Private key OK:   ${keyOk ? '✅' : '❌ CORRUPTED — missing BEGIN marker'}`);
        } catch (e) {
            console.log(`   ❌ Could not parse key file: ${e.message}`);
        }
    }
} else {
    console.log('   GOOGLE_APPLICATION_CREDENTIALS not set → using gcloud ADC');
    try {
        const adcPath = execSync('gcloud info --format="value(config.paths.global_config_dir)"', { encoding: 'utf8' }).trim();
        const adcFile = `${process.env.HOME}/.config/gcloud/application_default_credentials.json`;
        if (fs.existsSync(adcFile)) {
            const adc = JSON.parse(fs.readFileSync(adcFile, 'utf8'));
            console.log(`   ADC type:         ${adc.type}`);
            if (adc.client_email) console.log(`   ADC account:      ${adc.client_email}`);
        } else {
            console.log('   ❌ No ADC file found at ' + adcFile);
            console.log('   → Run:  gcloud auth application-default login');
        }
    } catch {
        console.log('   (gcloud not found in PATH — that is fine if using a key file)');
    }
}

// ── 3. Project env var ────────────────────────────────────────────────────────
console.log('\n3. Environment:');
console.log(`   GOOGLE_CLOUD_PROJECT  = ${process.env.GOOGLE_CLOUD_PROJECT ?? '❌ NOT SET'}`);
console.log(`   GOOGLE_CLOUD_LOCATION = ${process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1 (default)'}`);

// ── 4. Quick token test ───────────────────────────────────────────────────────
console.log('\n4. Token generation test:');
try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (token) {
        console.log('   ✅ Token obtained successfully!');
        console.log('   → Auth is working. Re-run setup-rag.js');
    } else {
        console.log('   ❌ No token returned');
    }
} catch (err) {
    console.log(`   ❌ Token error: ${err.message}`);

    if (err.message.includes('invalid_grant')) {
        console.log('\n══════════════════════════════════════════');
        console.log('  ROOT CAUSE: invalid_grant');
        console.log('══════════════════════════════════════════');
        console.log('\n  Most likely cause: SYSTEM CLOCK OUT OF SYNC');
        console.log('  GCP JWT tokens expire in 60 seconds of creation.');
        console.log('  If your clock is off by > 5 minutes, tokens are');
        console.log('  rejected before they even arrive at Google servers.\n');
        console.log('  Fix 1 — sync your clock right now:');
        console.log('    sudo timedatectl set-ntp true');
        console.log('    sudo systemctl restart systemd-timesyncd');
        console.log('    timedatectl status\n');
        console.log('  Fix 2 — if clock is fine, re-login to gcloud:');
        console.log('    gcloud auth revoke --all');
        console.log('    gcloud auth application-default login');
        console.log('    gcloud auth application-default set-quota-project YOUR_PROJECT_ID\n');
        console.log('  Fix 3 — if using a service account key file:');
        console.log('    1. Go to GCP Console → IAM → Service Accounts');
        console.log('    2. Delete the old key');
        console.log('    3. Create a new JSON key');
        console.log('    4. Set GOOGLE_APPLICATION_CREDENTIALS=/path/to/new-key.json in .env');
    }
}

console.log('\n══════════════════════════════════════════\n');
