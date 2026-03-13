/**
 * src/modules/documents/documents.controller.js
 */

import {
  ingestDocument,
  listDocuments,
  deleteDocument,
} from "../../services/rag.service.js";
import { model } from "../../services/agent.service.js";
import { User } from "../../models/index.js";

/**
 * POST /ingest
 */
export async function ingest(req, res, next) {
  const { fileName, mimeType, data, userId } = req.body;
  try {
    // Get or create the Sequelize User to associate the Document row
    let user = await User.findOne({ where: { uid: userId } });
    if (!user) {
      user = await User.create({ uid: userId });
    }

    const { docId, chunkCount } = await ingestDocument({
      userId,
      dbUserId: user.id,
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
  const userId = req.query.userId ?? "default";
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
  const userId = req.query.userId ?? "default";
  try {
    const result = await deleteDocument(userId, req.params.docId);
    res.json({ status: "ok", ...result });
  } catch (err) {
    next(err);
  }
}
