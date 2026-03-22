import { jest } from '@jest/globals';

const { ingestDocument, retrieveContext, deleteDocument } = await import('./rag.service.js');

describe('RAG Service', () => {
    it('should export orchestrator functions cleanly and resolve all deep module relationships', () => {
        expect(typeof ingestDocument).toBe('function');
        expect(typeof retrieveContext).toBe('function');
        expect(typeof deleteDocument).toBe('function');
    });
});
