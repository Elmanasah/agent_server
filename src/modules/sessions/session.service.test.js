import { jest } from '@jest/globals';

const { createSession, getSession, appendTurn, listSessions, deleteSession } = await import('./session.service.js');

describe('Session Service', () => {
    it('should properly export core session CRUD operations', () => {
        expect(typeof createSession).toBe('function');
        expect(typeof getSession).toBe('function');
        expect(typeof appendTurn).toBe('function');
        expect(typeof listSessions).toBe('function');
        expect(typeof deleteSession).toBe('function');
    });
});
