import { jest } from '@jest/globals';

const { upsertDatapoints, findNeighbors, removeDatapoints } = await import('./vectorSearch.service.js');

describe('Vector Search Service', () => {
    it('should properly structure and export the necessary vector operations', () => {
        expect(typeof upsertDatapoints).toBe('function');
        expect(typeof findNeighbors).toBe('function');
        expect(typeof removeDatapoints).toBe('function');
    });
});
