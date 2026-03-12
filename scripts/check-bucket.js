/**
 * scripts/check-bucket.js
 * Lists everything in your GCS bucket so we can see what paths exist.
 * Run: node scripts/check-bucket.js
 */
import 'dotenv/config';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
const bucket  = storage.bucket(process.env.GCS_BUCKET_NAME);

async function main() {
    console.log(`\nBucket: gs://${process.env.GCS_BUCKET_NAME}\n`);

    const [files] = await bucket.getFiles();

    if (files.length === 0) {
        console.log('❌ Bucket is completely empty — nothing was ever saved here.');
        console.log('   This means ingestion is writing to a different bucket or failing silently.');
        return;
    }

    console.log(`Found ${files.length} files:\n`);
    for (const file of files) {
        console.log(' ', file.name);
    }

    // Summarize by prefix
    const prefixes = {};
    for (const file of files) {
        const prefix = file.name.split('/')[0];
        prefixes[prefix] = (prefixes[prefix] || 0) + 1;
    }
    console.log('\nSummary by folder:');
    for (const [prefix, count] of Object.entries(prefixes)) {
        console.log(`  ${prefix}/  →  ${count} files`);
    }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
