import { VertexAI } from '@google-cloud/vertexai';
import config from './config.js';

const vertexAI = new VertexAI({
    project: config.projectId,
    location: config.location,
});

export const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
