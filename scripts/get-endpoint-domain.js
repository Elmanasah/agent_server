/**
 * scripts/get-endpoint-domain.js
 *
 * Run once to get your public endpoint domain name.
 * Usage: node scripts/get-endpoint-domain.js
 * 
 * It will print the VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN value
 * to add to your .env file.
 */

import 'dotenv/config';
import { GoogleAuth } from 'google-auth-library';

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const ENDPOINT_ID = process.env.VECTOR_SEARCH_ENDPOINT_ID;

if (!ENDPOINT_ID) {
    console.error('❌ VECTOR_SEARCH_ENDPOINT_ID is not set in .env');
    process.exit(1);
}

const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });

async function main() {
    const client    = await auth.getClient();
    const { token } = await client.getAccessToken();

    const url = `https://${LOCATION}-aiplatform.googleapis.com/v1`
              + `/projects/${PROJECT}/locations/${LOCATION}`
              + `/indexEndpoints/${ENDPOINT_ID}`;

    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();

    if (!res.ok) {
        console.error('❌ Failed to fetch endpoint:', data.error?.message);
        process.exit(1);
    }

    console.log('\n── Endpoint details ──────────────────────────────────');
    console.log('Display name:    ', data.displayName);
    console.log('Public endpoint: ', data.publicEndpointEnabled ? 'YES ✅' : 'NO ❌');
    console.log('Domain name:     ', data.publicEndpointDomainName ?? '(not set)');

    if (data.deployedIndexes?.length > 0) {
        console.log('Deployed indexes:');
        data.deployedIndexes.forEach(d => {
            console.log(`  - id: ${d.id}, index: ${d.index}`);
        });
    }

    if (data.publicEndpointDomainName) {
        console.log('\n══════════════════════════════════════════════════════');
        console.log('  Add this to your .env:');
        console.log('══════════════════════════════════════════════════════\n');
        console.log(`VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN=${data.publicEndpointDomainName}\n`);
    } else {
        console.log('\n⚠️  No public endpoint domain found.');
        console.log('   The endpoint may still be deploying, or public access is not enabled.');
        console.log('   Wait a few minutes and run this script again.\n');
    }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
