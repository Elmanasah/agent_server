/**
 * src/modules/sessions/sessions.controller.js
 */

import { listSessions, getSession, deleteSession } from '../../services/session.service.js';
import { evictAgent } from '../../services/agent.service.js';

/**
 * GET /sessions?userId=default
 */
export async function list(req, res, next) {
    const userId = req.query.userId ?? 'default';
    try {
        const sessions = await listSessions(userId);
        res.json({ sessions });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /sessions/:id?userId=default
 */
export async function get(req, res, next) {
    const userId = req.query.userId ?? 'default';
    try {
        const session = await getSession(userId, req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        res.json({ session });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /sessions/:id?userId=default
 */
export async function remove(req, res, next) {
    try {
        evictAgent(req.params.id);
        await deleteSession(req.params.id);
        res.json({ status: 'ok' });
    } catch (err) {
        next(err);
    }
}
