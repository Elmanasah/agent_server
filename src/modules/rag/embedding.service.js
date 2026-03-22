/**
 * src/services/embedding.service.js
 */

import { PredictionServiceClient } from "@google-cloud/aiplatform";
import { helpers } from "@google-cloud/aiplatform";
import config from "../../config/index.js";

const client = new PredictionServiceClient({
  apiEndpoint: `${config.location}-aiplatform.googleapis.com`,
});

const endpoint = `projects/${config.projectId}/locations/${config.location}/publishers/google/models/text-embedding-004`;

const BATCH_SIZE = 250;

async function batchEmbed(texts, taskType) {
  const vectors = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const instances = batch.map((t) =>
      helpers.toValue({ task_type: taskType, content: t }),
    );

    const [response] = await client.predict({
      endpoint,
      instances,
    });

    if (!response?.predictions)
      throw new Error("No embedding predictions returned");

    for (const pred of response.predictions) {
      const json = helpers.fromValue(pred);
      vectors.push(json.embeddings.values);
    }
  }

  return vectors;
}

export async function embed(texts) {
  return batchEmbed(texts, "RETRIEVAL_DOCUMENT");
}

export async function embedQuery(queryText) {
  const [vector] = await batchEmbed([queryText], "RETRIEVAL_QUERY");
  return vector;
}
