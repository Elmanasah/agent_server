import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { User } from '../../models/index.js';
import config from '../../config/index.js';

await jest.unstable_mockModule('../rag/rag.service.js', () => ({
    retrieveContext: jest.fn(async () => 'Mocked Context')
}));

await jest.unstable_mockModule('../image/image.service.js', () => ({
    generateImage: jest.fn(async () => ({ imageUrl: 'http://image.url' }))
}));

await jest.unstable_mockModule('../sessions/sessionSearch.service.js', () => ({
    searchSessions: jest.fn(async () => 'Mocked Session Search')
}));

const { LiveAgentSession } = await import('./liveAgent.service.js');

describe('LiveAgentSession', () => {
    let session, mockClientWs, mockGcpWs, user;

    beforeAll(async () => {
        user = await User.create({ name: 'Live Agent User', email: `liveagent_${Date.now()}@example.com` });
    });
    
    afterAll(async () => {
        await User.destroy({ where: { id: user.id }, truncate: { cascade: true } });
    });

    beforeEach(() => {
        mockClientWs = { readyState: 1, send: jest.fn() };
        mockGcpWs = { readyState: 1, send: jest.fn() };
        session = new LiveAgentSession(mockClientWs);
        jest.spyOn(jwt, 'verify').mockReturnValue({ id: user.id });
        jest.spyOn(jwt, 'sign').mockReturnValue('mock-token');
        jest.spyOn(User, 'findOne').mockResolvedValue(user);
    });
    
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('authenticate validates JWT and sets user', async () => {
        const res = await session.authenticate({ jwt_token: 'mock-token', service_url: 'ws://test' });
        expect(res.userId).toBe(user.id);
        expect(session.isAuthenticated).toBe(true);
    });

    it('authenticate throws on missing token', async () => {
        await expect(session.authenticate({})).rejects.toThrow('jwt_token is required');
    });

    it('handleGcpMessage handles inline functionCall parts safely', async () => {
        session.userId = user.id;
        const message = {
            serverContent: {
                modelTurn: {
                    parts: [{ functionCall: { name: 'search_knowledge_base', args: { query: 'test' } } }]
                }
            }
        };

        const handled = await session.handleGcpMessage(JSON.stringify(message), mockGcpWs);
        expect(handled).toBe(true);
    });
});
