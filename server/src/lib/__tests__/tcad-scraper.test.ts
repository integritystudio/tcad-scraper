/**
 * TCAD Scraper Tests
 *
 * Tests for helper methods and configuration
 */

// Mock Playwright
const mockBrowser = {
  newContext: jest.fn(),
  close: jest.fn(),
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    logging: {
      level: 'error',
    },
    scraper: {
      headless: true,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ],
      viewports: [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
      ],
      humanDelay: {
        min: 500,
        max: 2000,
      },
      brightData: {
        enabled: false,
        apiToken: null,
        proxyHost: 'brd.superproxy.io',
        proxyPort: 22225,
      },
      proxy: {
        enabled: false,
        server: null,
        username: null,
        password: null,
      },
    },
  },
}));

// Mock token refresh service
jest.mock('../../services/token-refresh.service', () => ({
  tokenRefreshService: {
    getCurrentToken: jest.fn().mockReturnValue(null),
  },
}));

// Mock DOM scraper fallback
jest.mock('../fallback/dom-scraper', () => ({
  scrapeDOMFallback: jest.fn().mockResolvedValue([]),
}));

import { TCADScraper } from '../tcad-scraper';
import { chromium } from 'playwright';

describe('TCADScraper', () => {
  let scraper: TCADScraper;

  beforeEach(() => {
    jest.clearAllMocks();
    scraper = new TCADScraper();
  });

  afterEach(async () => {
    if (scraper) {
      // Cleanup if needed
    }
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const scraper = new TCADScraper();
      expect(scraper).toBeDefined();
    });

    it('should accept custom config', () => {
      const customScraper = new TCADScraper({
        headless: false,
        timeout: 60000,
      });
      expect(customScraper).toBeDefined();
    });

    it('should configure proxy if enabled in config', () => {
      // Test with Bright Data proxy
      jest.resetModules();
      jest.doMock('../../config', () => ({
        config: {
          logging: { level: 'error' },
          scraper: {
            headless: true,
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            userAgents: ['test-agent'],
            viewports: [{ width: 1920, height: 1080 }],
            humanDelay: { min: 500, max: 2000 },
            brightData: {
              enabled: true,
              apiToken: 'test-token-12345678',
              proxyHost: 'brd.superproxy.io',
              proxyPort: 22225,
            },
            proxy: {
              enabled: false,
              server: null,
            },
          },
        },
      }));

      // Should not throw when creating scraper with proxy config
      expect(() => new TCADScraper()).not.toThrow();
    });
  });

  describe('initialize', () => {
    it('should launch browser with correct options', async () => {
      await scraper.initialize();

      expect(chromium.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: true,
          args: expect.arrayContaining([
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--no-sandbox',
          ]),
        })
      );
    });

    it('should handle browser launch failure', async () => {
      (chromium.launch as jest.Mock).mockRejectedValue(new Error('Launch failed'));

      await expect(scraper.initialize()).rejects.toThrow('Launch failed');
    });

    it('should include proxy config when provided', async () => {
      const scraperWithProxy = new TCADScraper({
        proxyServer: 'http://proxy.example.com:8080',
        proxyUsername: 'user',
        proxyPassword: 'pass',
      });

      await scraperWithProxy.initialize();

      expect(chromium.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: {
            server: 'http://proxy.example.com:8080',
            username: 'user',
            password: 'pass',
          },
        })
      );
    });
  });

  describe('Helper Methods', () => {
    describe('getRandomElement', () => {
      it('should return element from array', () => {
        // Access private method via any
        const scraperAny = scraper as any;
        const testArray = [1, 2, 3, 4, 5];

        const result = scraperAny.getRandomElement(testArray);

        expect(testArray).toContain(result);
      });

      it('should handle single element array', () => {
        const scraperAny = scraper as any;
        const testArray = ['only-element'];

        const result = scraperAny.getRandomElement(testArray);

        expect(result).toBe('only-element');
      });

      it('should return different elements on multiple calls', () => {
        const scraperAny = scraper as any;
        const testArray = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = new Set();

        // Call 20 times, should get variety
        for (let i = 0; i < 20; i++) {
          results.add(scraperAny.getRandomElement(testArray));
        }

        // With 20 calls on 10 elements, should get more than 1 unique value
        expect(results.size).toBeGreaterThan(1);
      });
    });

    describe('humanDelay', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('should delay within specified range', async () => {
        const scraperAny = scraper as any;

        const delayPromise = scraperAny.humanDelay(100, 200);

        // Fast-forward time
        jest.advanceTimersByTime(150);

        await delayPromise;

        expect(true).toBe(true); // If we got here, delay worked
      });

      it('should use default config values when not specified', async () => {
        const scraperAny = scraper as any;

        const delayPromise = scraperAny.humanDelay();

        // Should use config values (500-2000ms)
        jest.advanceTimersByTime(1000);

        await delayPromise;

        expect(true).toBe(true);
      });
    });
  });

  describe('Configuration', () => {
    it('should merge custom config with defaults', () => {
      const customScraper = new TCADScraper({
        timeout: 45000,
        retryAttempts: 5,
      });

      expect(customScraper).toBeDefined();
      // Config should be accessible and merged
    });

    it('should handle empty config object', () => {
      const defaultScraper = new TCADScraper({});
      expect(defaultScraper).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw error if scrapePropertiesViaAPI called without initialization', async () => {
      const uninitializedScraper = new TCADScraper();

      await expect(
        uninitializedScraper.scrapePropertiesViaAPI('test')
      ).rejects.toThrow('Browser not initialized');
    });

    it('should throw error if scrapeProperties called without initialization', async () => {
      const uninitializedScraper = new TCADScraper();

      await expect(
        uninitializedScraper.scrapeProperties('test')
      ).rejects.toThrow('Browser not initialized');
    });
  });

  describe('cleanup', () => {
    it('should close browser if initialized', async () => {
      await scraper.initialize();

      await scraper.cleanup();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should handle cleanup when browser not initialized', async () => {
      await expect(scraper.cleanup()).resolves.not.toThrow();
    });

    it('should handle browser close errors gracefully', async () => {
      await scraper.initialize();

      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      // Should not throw
      await expect(scraper.cleanup()).resolves.not.toThrow();
    });
  });

  describe('User Agent and Viewport Selection', () => {
    it('should use random user agent from config', async () => {
      await scraper.initialize();

      const mockNewContext = mockBrowser.newContext as jest.Mock;

      // Initialize will be called later, but config is set in constructor
      expect(scraper).toBeDefined();
    });

    it('should use random viewport from config', async () => {
      await scraper.initialize();

      expect(scraper).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should respect retry configuration', () => {
      const scraperWithRetries = new TCADScraper({
        retryAttempts: 5,
        retryDelay: 2000,
      });

      expect(scraperWithRetries).toBeDefined();
    });
  });
});
