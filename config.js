import 'dotenv/config';

const requiredEnvVars = ['GOOGLE_CLOUD_PROJECT'];

// Validate environment variables
const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
if (missingVars.length > 0) {
    console.error(`❌ Critical Error: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    port: process.env.PORT || 3000
};

export default config;
