/**
 * API Configuration Tests
 * Tests the API URL resolution fallback chain to prevent production errors
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { getApiBaseUrl } from '../api-config';
import { DataController } from '../xcontroller.client';

// Mock the xcontroller module
jest.mock('../xcontroller.client', () => ({
  dataController: {
    loadData: jest.fn(),
  },
}));

describe('API Configuration', () => {
  let mockLoadData: jest.MockedFunction<typeof DataController.prototype.loadData>;
  let originalEnv: any;

  beforeEach(() => {
    // Store original import.meta.env
    originalEnv = { ...import.meta.env };

    // Get mocked loadData
    mockLoadData = (require('../xcontroller.client').dataController.loadData as jest.MockedFunction<typeof DataController.prototype.loadData>);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    Object.assign(import.meta.env, originalEnv);
  });

  describe('getApiBaseUrl', () => {
    test('should prioritize VITE_API_URL (for static deployments)', () => {
      // Mock VITE_API_URL environment variable
      (import.meta.env as any).VITE_API_URL = 'https://api.alephatx.info';

      // Mock xcontroller returning server config (should be ignored)
      mockLoadData.mockReturnValue({
        apiUrl: 'https://api.example.com',
        environment: 'production',
        features: { search: true, analytics: true, monitoring: true },
        version: '1.0.0',
      });

      const apiUrl = getApiBaseUrl();

      // Should use VITE_API_URL, not xcontroller
      expect(apiUrl).toBe('https://api.alephatx.info');
      // Should NOT call loadData when VITE_API_URL is available
      expect(mockLoadData).not.toHaveBeenCalled();
    });

    test('should fall back to server-passed config when VITE_API_URL is unavailable', () => {
      // Ensure VITE_API_URL is not set
      delete (import.meta.env as any).VITE_API_URL;

      // Mock xcontroller returning server config
      mockLoadData.mockReturnValue({
        apiUrl: 'https://api.example.com',
        environment: 'production',
        features: { search: true, analytics: true, monitoring: true },
        version: '1.0.0',
      });

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('https://api.example.com');
      expect(mockLoadData).toHaveBeenCalledWith('initial-data');
    });

    test('should fall back to /api for local development when both sources are unavailable', () => {
      // Mock xcontroller returning null
      mockLoadData.mockReturnValue(null);

      // Ensure VITE_API_URL is not set
      delete (import.meta.env as any).VITE_API_URL;

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('/api');
      expect(mockLoadData).toHaveBeenCalledWith('initial-data');
    });

    test('should handle empty string from xcontroller when VITE_API_URL is not set', () => {
      // Ensure VITE_API_URL is not set
      delete (import.meta.env as any).VITE_API_URL;

      // Mock xcontroller returning data with empty apiUrl
      mockLoadData.mockReturnValue({
        apiUrl: '',
        environment: 'production',
        features: { search: true, analytics: true, monitoring: true },
        version: '1.0.0',
      });

      const apiUrl = getApiBaseUrl();

      // Empty string is falsy, should fall back to /api
      expect(apiUrl).toBe('/api');
    });

    test('should handle undefined apiUrl from xcontroller when VITE_API_URL is not set', () => {
      // Ensure VITE_API_URL is not set
      delete (import.meta.env as any).VITE_API_URL;

      // Mock xcontroller returning data without apiUrl property
      mockLoadData.mockReturnValue({
        environment: 'production',
        features: { search: true, analytics: true, monitoring: true },
        version: '1.0.0',
      } as any);

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('/api');
    });

    test('should use production API URL from environment variable', () => {
      // This test simulates GitHub Pages deployment
      mockLoadData.mockReturnValue(null);
      (import.meta.env as any).VITE_API_URL = 'https://api.alephatx.info';

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('https://api.alephatx.info');
    });

    test('should preserve URL format from xcontroller', () => {
      // Test with various URL formats
      const testUrls = [
        'https://api.example.com',
        'https://api.example.com:8080',
        'https://api.example.com/v1',
        'http://localhost:3001',
        '/api',
      ];

      testUrls.forEach(url => {
        mockLoadData.mockReturnValue({
          apiUrl: url,
          environment: 'test',
          features: { search: true, analytics: true, monitoring: true },
          version: '1.0.0',
        });

        const apiUrl = getApiBaseUrl();
        expect(apiUrl).toBe(url);
      });
    });

    test('should preserve URL format from VITE_API_URL', () => {
      mockLoadData.mockReturnValue(null);

      const testUrls = [
        'https://api.example.com',
        'http://localhost:3001/api',
        '/api',
      ];

      testUrls.forEach(url => {
        (import.meta.env as any).VITE_API_URL = url;
        const apiUrl = getApiBaseUrl();
        expect(apiUrl).toBe(url);
      });
    });
  });

  describe('Error Prevention', () => {
    test('REGRESSION: should not return relative /api when VITE_API_URL is set', () => {
      // This is the bug that caused the production issue
      // The component was falling back to '/api' instead of using VITE_API_URL

      (import.meta.env as any).VITE_API_URL = 'https://api.alephatx.info';

      const apiUrl = getApiBaseUrl();

      // Must NOT be '/api' when VITE_API_URL is available
      expect(apiUrl).not.toBe('/api');
      expect(apiUrl).toBe('https://api.alephatx.info');
      // Should not even call loadData when VITE_API_URL is set
      expect(mockLoadData).not.toHaveBeenCalled();
    });

    test('REGRESSION: should work in GitHub Pages deployment scenario', () => {
      // Simulates exact production environment:
      // - No xcontroller data (static HTML)
      // - VITE_API_URL set during build

      (import.meta.env as any).VITE_API_URL = 'https://api.alephatx.info';

      const apiUrl = getApiBaseUrl();

      // Should resolve to production API, not relative path
      expect(apiUrl).toBe('https://api.alephatx.info');
      expect(apiUrl).toMatch(/^https:\/\//);
      // Should not call loadData to avoid console errors
      expect(mockLoadData).not.toHaveBeenCalled();
    });

    test('REGRESSION: should not log console errors in static builds', () => {
      // This test ensures we don't call loadData when VITE_API_URL is available
      // Previously caused "[DataController] Script tag with id 'initial-data' not found" error

      (import.meta.env as any).VITE_API_URL = 'https://api.alephatx.info';

      const apiUrl = getApiBaseUrl();

      // Verify the xcontroller was never called (preventing console.error)
      expect(mockLoadData).not.toHaveBeenCalled();
      expect(apiUrl).toBe('https://api.alephatx.info');
    });
  });

  describe('Integration Scenarios', () => {
    test('should work in server-side rendered scenario (no VITE_API_URL)', () => {
      // SSR scenarios don't set VITE_API_URL
      delete (import.meta.env as any).VITE_API_URL;

      mockLoadData.mockReturnValue({
        apiUrl: 'https://ssr-api.example.com',
        environment: 'production',
        features: { search: true, analytics: true, monitoring: true },
        version: '1.0.0',
      });

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('https://ssr-api.example.com');
      expect(mockLoadData).toHaveBeenCalledWith('initial-data');
    });

    test('should work in static site scenario (GitHub Pages)', () => {
      (import.meta.env as any).VITE_API_URL = 'https://api.alephatx.info';

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('https://api.alephatx.info');
      // Should not call loadData in static builds
      expect(mockLoadData).not.toHaveBeenCalled();
    });

    test('should work in local development scenario', () => {
      delete (import.meta.env as any).VITE_API_URL;
      mockLoadData.mockReturnValue(null);

      const apiUrl = getApiBaseUrl();

      expect(apiUrl).toBe('/api');
      expect(mockLoadData).toHaveBeenCalledWith('initial-data');
    });
  });
});
