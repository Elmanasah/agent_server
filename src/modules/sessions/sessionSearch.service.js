/**
 * src/services/sessionSearch.service.js
 *
 * Full-text search across a user's past session messages in CockroachDB.
 * Called as a Gemini function-calling tool: search_sessions(query).
 */

import { Op } from 'sequelize';
import { User, Session, Message } from '../../models/index.js';

const MAX_RESULTS = 5;
const SNIPPET_LEN = 300;

/**
 * Search past conversation messages for a given user.
 *
 * @param {string} userId   - The authenticated user's ID
 * @param {string} query    - Natural language search query
 * @returns {Promise<string|null>} Formatted context string, or null if nothing found
 */
export async function searchSessions(userId, query) {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) return null;

    // Find sessions belonging to this user
    const sessions = await Session.findAll({
        where: { userId: user.id },
        attributes: ['id', 'title'],
    });

    if (!sessions.length) return null;

    const sessionIds = sessions.map(s => s.id);
    const sessionTitleMap = Object.fromEntries(sessions.map(s => [s.id, s.title]));

    // Build keyword list from the query (min 2 chars to avoid noise)
    const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2)
        .slice(0, 5);

    if (!keywords.length) return null;

    // Fetch recent model messages from the user's sessions
    const messages = await Message.findAll({
        where: {
            sessionId: { [Op.in]: sessionIds },
            role: 'model',
        },
        order: [['createdAt', 'DESC']],
        limit: 100,
    });

    // Score client-side by keyword presence in text parts
    const scored = messages
        .map(msg => {
            const text = (msg.parts || []).map(p => p.text || '').join(' ');
            const lower = text.toLowerCase();
            const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
            return { msg, text, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS);

    if (!scored.length) return null;

    const results = scored.map(({ msg, text }, i) => {
        const title = sessionTitleMap[msg.sessionId] || 'Conversation';
        const snippet = text.slice(0, SNIPPET_LEN).trim() + (text.length > SNIPPET_LEN ? '...' : '');
        return `[Result ${i + 1} — from "${title}"]\n${snippet}`;
    });

    return [
        '== PAST CONVERSATION SEARCH RESULTS ==',
        `Query: "${query}"`,
        '',
        ...results.flatMap((r, i) => (i < results.length - 1 ? [r, '---'] : [r])),
        '',
    ].join('\n');
}
