/**
 * src/modules/documents/documents.controller.test.js
 */
import request from 'supertest';

const { default: app } = await import('../../app.js');

describe('Documents API Endpoints', () => {
    it('POST /api/v1/documents should return 401 without token', async () => {
        const res = await request(app).post('/api/v1/documents').attach('file', Buffer.from('test'), 'test.txt');
        expect(res.status).toBe(401);
    });
});
