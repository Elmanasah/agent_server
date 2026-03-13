/**
 * src/services/session.service.js
 *
 * Session and Message CRUD using Sequelize → CockroachDB.
 */

import { User, Session, Message } from "../models/index.js";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function upsertUser(uid) {
  let user = await User.findOne({ where: { uid } });
  if (!user) {
    user = await User.create({ uid });
  }
  return user;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new session.
 * @param {string} uid
 * @param {string} firstMessage
 * @returns {Promise<Session>}
 */
export async function createSession(uid, firstMessage = "New conversation") {
  const user = await upsertUser(uid);
  const title = firstMessage.slice(0, 60).trim() || "New conversation";

  const session = await Session.create({ title, userId: user.id });
  // Attach empty messages array so caller doesn't need to re-fetch
  session.dataValues.messages = [];
  console.log(`[session] Created "${title}" (${session.id})`);
  return session;
}

/**
 * Load a session with its messages. Returns null if not found.
 * @param {string} uid
 * @param {string} sessionId
 * @returns {Promise<Session|null>}
 */
export async function getSession(uid, sessionId) {
  const user = await User.findOne({ where: { uid } });
  if (!user) return null;

  return Session.findOne({
    where: { id: sessionId, userId: user.id },
    include: [
      {
        model: Message,
        as: "messages",
        order: [["createdAt", "ASC"]],
      },
    ],
  });
}

/**
 * Append a user turn + model reply to a session.
 * @param {string}   sessionId
 * @param {object[]} userParts
 * @param {string}   modelReply
 */
export async function appendTurn(sessionId, userParts, modelReply) {
  // Store only text parts — skip base64 blobs
  const textOnlyParts = userParts.filter((p) => p.text);

  await Message.create({ sessionId, role: "user", parts: textOnlyParts });
  await Message.create({
    sessionId,
    role: "model",
    parts: [{ text: modelReply }],
  });

  await Session.update({ updatedAt: new Date() }, { where: { id: sessionId } });
}

/**
 * List all sessions for a user, newest first (metadata only).
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function listSessions(uid) {
  const user = await User.findOne({ where: { uid } });
  if (!user) return [];

  const sessions = await Session.findAll({
    where: { userId: user.id },
    order: [["updatedAt", "DESC"]],
    include: [
      {
        model: Message,
        as: "messages",
        attributes: ["id"], // only count, not full content
      },
    ],
  });

  return sessions.map((s) => ({
    sessionId: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s.messages?.length ?? 0,
  }));
}

/**
 * Delete a session (messages cascade via DB FK constraints).
 * @param {string} sessionId
 */
export async function deleteSession(sessionId) {
  // Delete messages first (CockroachDB respects FK constraints)
  await Message.destroy({ where: { sessionId } });
  await Session.destroy({ where: { id: sessionId } });
  console.log(`[session] Deleted session ${sessionId}`);
}
