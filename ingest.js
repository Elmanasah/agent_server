import { helpers, PredictionServiceClient } from '@google-cloud/aiplatform';
import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';
import config from './config.js';
const client = new PredictionServiceClient({
    project: config.projectId,
    location: config.location,
});
const storage = new Storage();
const BUCKET_NAME = `agent-knowledge-base-${config.projectId}`;
const FILES_TO_INDEX = ['./agent.js', './index.js', './vertex.js', './config.js'];
async function generateEmbeddings() {
    const endpoint = `projects/${config.projectId}/locations/${config.location}/publishers/google/models/text-embedding-004`;
    let jsonlData = '';
    for (const filePath of FILES_TO_INDEX) {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');           
            try {
                const instance = helpers.toValue({ content: content });
                const instances = [instance];
                const [response] = await client.predict({
                    endpoint,
                    instances,
                });
                const embeddingValues = response.predictions[0].structValue.fields.embeddings.structValue.fields.values.listValue.values.map(v => v.numberValue);
                const record = {
                    id: path.basename(filePath),
                    embedding: embeddingValues,
                };
                jsonlData += JSON.stringify(record) + '\n';
                console.log(`✅ تم معالجة ملف: ${filePath}`);
            } catch (err) {
                console.error(`❌ فشل معالجة ملف ${filePath}:`, err.message);
            }
        }
    }
    if (jsonlData) {
        fs.writeFileSync('data.json', jsonlData);
        await storage.bucket(BUCKET_NAME).upload('data.json', { destination: 'embeddings/data.json' });
        console.log(`🚀 أخيراً! الملف اترفع هنا: gs://${BUCKET_NAME}/embeddings/data.json`);
    }
}
generateEmbeddings().catch(console.error);