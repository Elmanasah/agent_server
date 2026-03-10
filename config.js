import 'dotenv/config';

const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT', 'ALLOWED_ORIGINS'];

// Validate environment variables
const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingVars.length > 0) {
    console.error(`❌ Critical Error: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    port: process.env.PORT || 3000,
    allowedOrigins: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : ['http://localhost:5173'] // Fallback just in case
};

export default config;
