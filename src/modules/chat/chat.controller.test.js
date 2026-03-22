/**
 * src/modules/chat/chat.controller.test.js
 */
import request from 'supertest';

const { default: app } = await import('../../app.js');

describe('Chat API Endpoints', () => {
    it('POST /api/v1/chat should return 401 without token', async () => {
        const res = await request(app).post('/api/v1/chat').send({ message: "Hello" });
        expect(res.status).toBe(401); 
    });
});
