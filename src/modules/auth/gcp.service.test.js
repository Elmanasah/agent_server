import { jest } from '@jest/globals';

const { getAccessToken, getGcpConfig } = await import('./gcp.service.js');

describe('GCP Service', () => {
    it('should export getAccessToken and getGcpConfig functions', () => {
        expect(typeof getAccessToken).toBe('function');
        expect(typeof getGcpConfig).toBe('function');
    });

    it('getGcpConfig should return a configuration object safely', () => {
        const config = getGcpConfig();
        expect(config).toBeDefined();
    });
});
