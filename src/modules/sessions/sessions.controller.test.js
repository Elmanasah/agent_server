/**
 * src/modules/sessions/sessions.controller.test.js
 */
import request from 'supertest';

const { default: app } = await import('../../app.js');

describe('Sessions API Endpoints', () => {
    it('GET /api/v1/sessions should return 401 without token', async () => {
        const res = await request(app).get('/api/v1/sessions');
        expect(res.status).toBe(401);
    });
    it('DELETE /api/v1/sessions/:id should return 401 without token', async () => {
        const res = await request(app).delete('/api/v1/sessions/123');
        expect(res.status).toBe(401);
    });
});
