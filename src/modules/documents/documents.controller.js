/**
 * src/modules/documents/documents.controller.js
 */

import {
  ingestDocument,
  listDocuments,
  deleteDocument,
} from '../rag/rag.service.js';
import { model } from '../agents/agent.service.js';
import { User } from "../../models/index.js";

/**
 * POST /ingest
 */
export async function ingest(req, res, next) {
  const { fileName, mimeType, data } = req.body;
  const userId = req.user.id;
  try {
    const { docId, chunkCount } = await ingestDocument({
      userId,
      dbUserId: userId,
      fileName,
      base64Data: data,
      mimeType,
      geminiModel: model,
    });

    res.json({ status: "ok", docId, fileName, chunkCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /documents?userId=default
 */
export async function list(req, res, next) {
  const userId = req.user.id;
  try {
    const documents = await listDocuments(userId);
    res.json({ documents });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /documents/:docId?userId=default
 */
export async function remove(req, res, next) {
  const userId = req.user.id;
  try {
    const result = await deleteDocument(userId, req.params.docId);
    res.json({ status: "ok", ...result });
  } catch (err) {
    next(err);
  }
}
