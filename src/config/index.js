/**
 * src/config/index.js
 *
 * Single source of truth for all environment variables.
 * Import this instead of reading process.env directly anywhere else.
 */

import "dotenv/config";

const config = Object.freeze({
  // ── Server ──────────────────────────────────────────────────────────────
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: (process.env.NODE_ENV || "development") === "development",

  // ── CORS ────────────────────────────────────────────────────────────────
  // Comma-separated list of origins → array
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // ── Google Cloud ────────────────────────────────────────────────────────
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  gcpApiHost:
    process.env.GCP_API_HOST || "us-central1-aiplatform.googleapis.com",

  // ── CockroachDB ─────────────────────────────────────────────────────────
  databaseUrl: process.env.DATABASE_URL,
  testDatabaseUrl: process.env.TEST_DATABASE_URL,
  // ── Cloud Storage (RAG chunks) ──────────────────────────────────────────
  gcsBucketName: process.env.GCS_BUCKET_NAME,

  // ── Vertex AI Vector Search ─────────────────────────────────────────────
  vectorSearchIndexId: process.env.VECTOR_SEARCH_INDEX_ID,
  vectorSearchEndpointId: process.env.VECTOR_SEARCH_ENDPOINT_ID,
  vectorSearchDeployedIndexId: process.env.VECTOR_SEARCH_DEPLOYED_INDEX_ID,
  vectorSearchPublicEndpointDomain:
    process.env.VECTOR_SEARCH_PUBLIC_ENDPOINT_DOMAIN,

  // ── Feature flags ──────────────────────────────────────────────────────
  ragEnabled: Boolean(process.env.VECTOR_SEARCH_INDEX_ID),

  // ── Auth ─────────────────────────────────────────────────────────────────
  jwtSecret: process.env.SECRET_KEY,
});

export default config;
