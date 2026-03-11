import 'dotenv/config';

const config = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    port: process.env.PORT || 3000,
};

export default config;
