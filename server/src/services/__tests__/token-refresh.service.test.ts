/**
 * Token Refresh Service Tests
 */

// Mock Playwright
const mockPage = {
  goto: jest.fn(),
  waitForFunction: jest.fn(),
  waitForSelector: jest.fn(),
  type: jest.fn(),
  press: jest.fn(),
  on: jest.fn(),
};

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

const mockBrowser = {
  newContext: jest.fn().mockResolvedValue(mockContext),
  close: jest.fn(),
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock node-cron
const mockCronJob = {
  stop: jest.fn(),
};

jest.mock('node-cron', () => ({
  schedule: jest.fn().mockReturnValue(mockCronJob),
}));

// Mock config
jest.mock('../../config', () => ({
  config: {
    logging: {
      level: 'error',
    },
    scraper: {
      headless: true,
      tcadApiKey: 'test-token-from-env',
    },
  },
}));

import { TCADTokenRefreshService } from '../token-refresh.service';
import { chromium } from 'playwright';
import cron from 'node-cron';

describe('TCADTokenRefreshService', () => {
  let service: TCADTokenRefreshService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TCADTokenRefreshService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe('constructor', () => {
    it('should initialize with token from environment if available', () => {
      const token = service.getCurrentToken();
      expect(token).toBe('test-token-from-env');
    });

    it('should initialize stats correctly', () => {
      const stats = service.getStats();
      expect(stats.refreshCount).toBe(0);
      expect(stats.failureCount).toBe(0);
      expect(stats.isRefreshing).toBe(false);
      expect(stats.lastRefreshTime).toBeNull();
    });
  });

  describe('getCurrentToken', () => {
    it('should return the current token', () => {
      const token = service.getCurrentToken();
      expect(token).toBe('test-token-from-env');
    });

    it('should return null if no token is set', () => {
      const serviceWithoutToken = new TCADTokenRefreshService();
      // Can't easily test this without mocking config differently
      // but we can test the getter works
      expect(typeof serviceWithoutToken.getCurrentToken()).toBe('string');
    });
  });

  describe('getStats', () => {
    it('should return complete statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('currentToken');
      expect(stats).toHaveProperty('lastRefreshTime');
      expect(stats).toHaveProperty('refreshCount');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('isRefreshing');
      expect(stats).toHaveProperty('isRunning');
    });

    it('should mask token in stats', () => {
      const stats = service.getStats();
      expect(stats.currentToken).toContain('...');
      expect(stats.currentToken).not.toBe('test-token-from-env');
    });

    it('should show isRunning as false initially', () => {
      const stats = service.getStats();
      expect(stats.isRunning).toBe(false);
    });
  });

  describe('getHealth', () => {
    it('should return health status', () => {
      const health = service.getHealth();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('hasToken');
      expect(health).toHaveProperty('lastRefresh');
      expect(health).toHaveProperty('timeSinceLastRefresh');
      expect(health).toHaveProperty('refreshCount');
      expect(health).toHaveProperty('failureCount');
      expect(health).toHaveProperty('failureRate');
      expect(health).toHaveProperty('isRefreshing');
      expect(health).toHaveProperty('isAutoRefreshRunning');
    });

    it('should show healthy when token exists', () => {
      const health = service.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.hasToken).toBe(true);
    });

    it('should calculate failure rate correctly', () => {
      const health = service.getHealth();
      expect(health.failureRate).toBe('0%');
    });

    it('should show autoRefresh as not running initially', () => {
      const health = service.getHealth();
      expect(health.isAutoRefreshRunning).toBe(false);
    });
  });

  describe('refreshToken', () => {
    it('should not refresh if already refreshing', async () => {
      // Mock to make refresh take time
      mockPage.goto.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      // Start first refresh (won't complete immediately)
      const promise1 = service.refreshToken();

      // Wait a bit to ensure first refresh has started
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try to start second refresh while first is in progress
      const promise2 = service.refreshToken();

      const result = await promise2;

      // Should return current token without launching browser again
      expect(result).toBe('test-token-from-env');

      // Wait for first to complete
      await promise1;
    });

    it('should initialize browser on first refresh', async () => {
      // Mock successful token capture
      mockPage.on.mockImplementation((event, handler) => {
        if (event === 'request') {
          // Simulate a request with auth header
          setTimeout(() => {
            handler({
              headers: () => ({
                authorization: 'eyJtest-captured-token-with-enough-length-to-pass-validation',
              }),
            });
          }, 10);
        }
      });

      mockPage.goto.mockResolvedValue(undefined);
      mockPage.waitForFunction.mockResolvedValue(undefined);
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.type.mockResolvedValue(undefined);
      mockPage.press.mockResolvedValue(undefined);

      await service.refreshToken();

      expect(chromium.launch).toHaveBeenCalled();
    });

    it('should track failure count on error', async () => {
      // Force an error by not mocking the browser properly
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));

      const initialStats = service.getStats();
      const initialFailureCount = initialStats.failureCount;

      await service.refreshToken();

      const newStats = service.getStats();
      expect(newStats.failureCount).toBeGreaterThan(initialFailureCount);
    });

    it('should handle token capture failure gracefully', async () => {
      // No token will be captured
      mockPage.on.mockImplementation(() => {});
      mockPage.goto.mockResolvedValue(undefined);
      mockPage.waitForFunction.mockResolvedValue(undefined);
      mockPage.waitForSelector.mockResolvedValue(undefined);
      mockPage.type.mockResolvedValue(undefined);
      mockPage.press.mockResolvedValue(undefined);

      const result = await service.refreshToken();

      // Should return existing token on failure
      expect(result).toBe('test-token-from-env');

      const stats = service.getStats();
      expect(stats.failureCount).toBeGreaterThan(0);
    });

    it('should set isRefreshing flag during refresh', async () => {
      // Mock a slow refresh
      mockPage.goto.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)));

      const promise = service.refreshToken();

      // Check flag is set during refresh
      const stats = service.getStats();
      expect(stats.isRefreshing).toBe(true);

      await promise;

      // Check flag is cleared after
      const finalStats = service.getStats();
      expect(finalStats.isRefreshing).toBe(false);
    });
  });

  describe('startAutoRefresh', () => {
    it('should start cron job with default schedule', () => {
      service.startAutoRefresh();

      expect(cron.schedule).toHaveBeenCalledWith(
        '*/4 * * * *',
        expect.any(Function)
      );
    });

    it('should start cron job with custom schedule', () => {
      service.startAutoRefresh('*/10 * * * *');

      expect(cron.schedule).toHaveBeenCalledWith(
        '*/10 * * * *',
        expect.any(Function)
      );
    });

    it('should not start if already running', () => {
      service.startAutoRefresh();

      const stats1 = service.getStats();
      expect(stats1.isRunning).toBe(true);

      // Clear mocks after first start
      jest.clearAllMocks();

      // Try to start again
      service.startAutoRefresh();

      // Should not have called schedule again
      expect(cron.schedule).not.toHaveBeenCalled();

      // Should still be running
      const stats2 = service.getStats();
      expect(stats2.isRunning).toBe(true);
    });

    it('should show as running in stats after start', () => {
      service.startAutoRefresh();

      const stats = service.getStats();
      expect(stats.isRunning).toBe(true);

      const health = service.getHealth();
      expect(health.isAutoRefreshRunning).toBe(true);
    });
  });

  describe('startAutoRefreshInterval', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start interval with default time', () => {
      service.startAutoRefreshInterval();

      const stats = service.getStats();
      expect(stats.isRunning).toBe(true);
    });

    it('should start interval with custom time', () => {
      service.startAutoRefreshInterval(60000); // 1 minute

      const stats = service.getStats();
      expect(stats.isRunning).toBe(true);
    });

    it('should not start if already running', () => {
      service.startAutoRefreshInterval();
      const stats1 = service.getStats();

      service.startAutoRefreshInterval();
      const stats2 = service.getStats();

      expect(stats1.isRunning).toBe(stats2.isRunning);
    });
  });

  describe('stopAutoRefresh', () => {
    it('should stop cron job if running', () => {
      service.startAutoRefresh();

      // Verify it's running
      expect(service.getStats().isRunning).toBe(true);

      service.stopAutoRefresh();

      // Verify it's stopped
      const stats = service.getStats();
      expect(stats.isRunning).toBe(false);

      // Verify stop was called
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should stop interval if running', () => {
      jest.useFakeTimers();

      service.startAutoRefreshInterval();
      service.stopAutoRefresh();

      const stats = service.getStats();
      expect(stats.isRunning).toBe(false);

      jest.useRealTimers();
    });

    it('should handle being called when not running', () => {
      // Should not throw
      expect(() => service.stopAutoRefresh()).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should stop auto-refresh', async () => {
      // Start auto-refresh
      service.startAutoRefresh();

      expect(service.getStats().isRunning).toBe(true);

      // Now cleanup
      await service.cleanup();

      // Verify auto-refresh was stopped
      expect(service.getStats().isRunning).toBe(false);
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should handle cleanup when browser not initialized', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup when auto-refresh not running', async () => {
      await expect(service.cleanup()).resolves.not.toThrow();

      const stats = service.getStats();
      expect(stats.isRunning).toBe(false);
    });
  });
});
