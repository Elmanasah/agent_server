/**
 * scripts/setup-rag.js
 *
 * Run ONCE to provision all GCP resources the RAG system needs:
 *   1. Cloud Storage bucket      (stores chunk text + doc metadata)
 *   2. Vertex AI Vector Search Index     (STREAM_UPDATE, 768 dims, DOT_PRODUCT)
 *   3. Vertex AI Index Endpoint          (public endpoint for querying)
 *   4. Deploy the Index to the Endpoint
 *
 * At the end it prints the three IDs you need to add to your .env file.
 *
 * Usage:
 *   node scripts/setup-rag.js
 *
 * Prerequisites:
 *   - GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set in .env
 *   - The service account / ADC credentials must have:
 *       roles/storage.admin
 *       roles/aiplatform.admin
 */

import 'dotenv/config';
import { Storage }    from '@google-cloud/storage';
import { GoogleAuth } from 'google-auth-library';

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

if (!PROJECT) {
    console.error('❌  GOOGLE_CLOUD_PROJECT is not set. Check your .env file.');
    process.exit(1);
}

const BUCKET_NAME    = `${PROJECT}-rag-chunks`;
const INDEX_NAME     = 'learnify-rag-index';
const ENDPOINT_NAME  = 'learnify-rag-endpoint';
const DEPLOYED_ID    = 'learnify_deployed_index'; // alphanumeric + underscores only

const MGMT_BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1`
                + `/projects/${PROJECT}/locations/${LOCATION}`;

const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform',
});

async function getToken() {
    const client    = await auth.getClient();
    const { token } = await client.getAccessToken();
    return token;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiPost(path, body) {
    const token = await getToken();
    const res   = await fetch(`${MGMT_BASE}${path}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`);
    return data;
}

async function apiGet(path) {
    const token = await getToken();
    const res   = await fetch(`${MGMT_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`);
    return data;
}

/**
 * Poll a long-running operation until it completes.
 * Most Vertex AI LROs take 2-15 minutes for indexes.
 */
async function waitForOperation(operationName, label, timeoutMs = 30 * 60 * 1000) {
    console.log(`   ⏳ Waiting for operation: ${label}`);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        await sleep(15_000); // poll every 15 seconds

        const token = await getToken();
        const res   = await fetch(
            `https://${LOCATION}-aiplatform.googleapis.com/v1/${operationName}`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const op = await res.json();

        if (op.error) throw new Error(`Operation failed: ${op.error.message}`);
        if (op.done)  {
            console.log(`   ✅ ${label} — complete`);
            return op.response ?? op.metadata;
        }

        const elapsed = Math.round((Date.now() - start) / 1000);
        console.log(`   ⏳ Still running... (${elapsed}s elapsed)`);
    }

    throw new Error(`Operation timed out after ${timeoutMs / 60_000} minutes`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function extractId(resourceName) {
    return resourceName.split('/').pop();
}

// ─── Steps ────────────────────────────────────────────────────────────────────

async function createBucket() {
    console.log(`\n📦 Step 1 — Create Cloud Storage bucket: ${BUCKET_NAME}`);

    const storage = new Storage({ projectId: PROJECT });

    try {
        const [bucket] = await storage.createBucket(BUCKET_NAME, {
            location:              LOCATION.toUpperCase(),
            uniformBucketLevelAccess: true,
            storageClass:          'STANDARD',
        });
        console.log(`   ✅ Bucket created: gs://${bucket.name}`);
    } catch (err) {
        if (err.code === 409) {
            console.log(`   ℹ️  Bucket already exists — skipping`);
        } else {
            throw err;
        }
    }

    return BUCKET_NAME;
}

async function createIndex() {
    console.log(`\n🔍 Step 2 — Create Vertex AI Vector Search Index: ${INDEX_NAME}`);
    console.log(`   ⚠️  This can take 5-15 minutes for a new empty streaming index...`);

    const body = {
        displayName: INDEX_NAME,
        description: 'Learnify RAG index — text-embedding-004, 768 dims, DOT_PRODUCT',
        metadata: {
            config: {
                dimensions:               768,        // must match text-embedding-004 output
                approximateNeighborsCount: 150,
                distanceMeasureType:      'DOT_PRODUCT_DISTANCE',
                featureNormType:          'UNIT_L2_NORM', // normalize vectors before indexing
                algorithmConfig: {
                    treeAhConfig: {
                        leafNodeEmbeddingCount:     500,
                        leafNodesToSearchPercent:   7,
                    },
                },
            },
        },
        indexUpdateMethod: 'STREAM_UPDATE', // real-time upsert without redeployment
    };

    const operation = await apiPost('/indexes', body);
    const result    = await waitForOperation(operation.name, 'Create Index');

    // The operation response contains the full index resource
    const indexName = result.name ?? operation.metadata?.genericMetadata?.resourceName;
    const indexId   = extractId(indexName);

    console.log(`   ✅ Index ID: ${indexId}`);
    return indexId;
}

async function createEndpoint() {
    console.log(`\n🌐 Step 3 — Create Index Endpoint: ${ENDPOINT_NAME}`);

    const body = {
        displayName: ENDPOINT_NAME,
        description: 'Learnify RAG endpoint — public, no VPC required',
        // publicEndpointEnabled defaults to true for non-VPC deployments
    };

    const operation = await apiPost('/indexEndpoints', body);
    const result    = await waitForOperation(operation.name, 'Create Endpoint');

    const endpointName = result.name ?? operation.metadata?.genericMetadata?.resourceName;
    const endpointId   = extractId(endpointName);

    console.log(`   ✅ Endpoint ID: ${endpointId}`);
    return endpointId;
}

async function deployIndex(indexId, endpointId) {
    console.log(`\n🚀 Step 4 — Deploy Index to Endpoint`);
    console.log(`   ⚠️  This takes 10-20 minutes...`);

    const body = {
        deployedIndex: {
            id:          DEPLOYED_ID,
            indexId:     `projects/${PROJECT}/locations/${LOCATION}/indexes/${indexId}`,
            displayName: 'learnify-deployed',
            dedicatedResources: {
                machineSpec:     { machineType: 'e2-standard-2' },
                minReplicaCount: 1,
                maxReplicaCount: 2, // auto-scales for burst traffic
            },
        },
    };

    const operation = await apiPost(`/indexEndpoints/${endpointId}:deployIndex`, body);
    await waitForOperation(operation.name, 'Deploy Index');

    console.log(`   ✅ Deployed Index ID: ${DEPLOYED_ID}`);
    return DEPLOYED_ID;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('══════════════════════════════════════════════════════');
    console.log('  Learnify RAG — GCP Resource Setup');
    console.log(`  Project:  ${PROJECT}`);
    console.log(`  Location: ${LOCATION}`);
    console.log('══════════════════════════════════════════════════════');

    const bucketName = await createBucket();
    const indexId    = await createIndex();
    const endpointId = await createEndpoint();
    const deployedId = await deployIndex(indexId, endpointId);

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  ✅ All resources created! Add these to your .env:');
    console.log('══════════════════════════════════════════════════════\n');
    console.log(`GCS_BUCKET_NAME=${bucketName}`);
    console.log(`VECTOR_SEARCH_INDEX_ID=${indexId}`);
    console.log(`VECTOR_SEARCH_ENDPOINT_ID=${endpointId}`);
    console.log(`VECTOR_SEARCH_DEPLOYED_INDEX_ID=${deployedId}`);
    console.log('\n══════════════════════════════════════════════════════\n');
}

main().catch(err => {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
});
