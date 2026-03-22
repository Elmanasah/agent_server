/**
 * src/modules/auth/auth.controller.test.js
 */
import request from 'supertest';
import { jest } from '@jest/globals';

await jest.unstable_mockModule('../mail/mail.service.js', () => ({
  default: {
    sendOTP: jest.fn().mockResolvedValue(true),
    sendVerificationOTP: jest.fn().mockResolvedValue(true),
  }
}));

const { default: app } = await import('../../app.js');
const { User } = await import('../../models/index.js');

describe('Auth API Endpoints', () => {
    beforeEach(async () => {
        await User.destroy({ where: {}, truncate: { cascade: true } });
    });

    it('POST /api/v1/auth/register should fail without verificationToken', async () => {
        const res = await request(app).post('/api/v1/auth/register').send({ email: 'api@example.com', password: 'p' });
        expect(res.status).toBeGreaterThanOrEqual(400); 
    });

    it('POST /api/v1/auth/login should fail for non-existent user', async () => {
        const res = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@example.com', password: 'p' });
        expect(res.status).toBe(401);
    });
});
