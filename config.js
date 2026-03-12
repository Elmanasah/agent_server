import 'dotenv/config';

const config = {
    // ── Existing ────────────────────────────────────────────────────────────
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location:  process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    port:      process.env.PORT || 3000,

    // ── RAG — Vertex AI Vector Search ────────────────────────────────────────
    // Run `node scripts/setup-rag.js` once to create these resources and get
    // the IDs to paste here. Nothing else changes when you go multi-user.
    vectorSearchIndexId:        process.env.VECTOR_SEARCH_INDEX_ID,
    vectorSearchEndpointId:     process.env.VECTOR_SEARCH_ENDPOINT_ID,
    vectorSearchDeployedIndexId:    process.env.VECTOR_SEARCH_DEPLOYED_INDEX_ID,
    // The public domain for findNeighbors queries — get it by running:
    // node scripts/get-endpoint-domain.js
    vectorSearchPublicEndpointDomain: process.env.VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN,

    // ── RAG — Cloud Storage (chunk text) ─────────────────────────────────────
    // Bucket name must be globally unique — the setup script creates it for you
    gcsBucketName: process.env.GCS_BUCKET_NAME,
};

export default config;
