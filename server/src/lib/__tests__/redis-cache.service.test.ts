import { RedisCacheService } from '../redis-cache.service';

jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn(),
    quit: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    flushDb: jest.fn(),
    ping: jest.fn(),
    on: jest.fn(),
  }),
}));

jest.mock('../../config', () => ({
  config: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
      connectionTimeout: 5000,
    },
    logging: {
      level: 'error', // Suppress logs during tests
    },
  },
}));

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let mockRedisClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Get the mocked Redis client
    const { createClient } = require('redis');
    service = new RedisCacheService();

    // Connect and get the client instance
    await service.connect();
    mockRedisClient = createClient.mock.results[createClient.mock.results.length - 1].value;

    // Trigger the 'ready' event to set isConnected = true
    const onReadyHandler = mockRedisClient.on.mock.calls.find(
      (call: any[]) => call[0] === 'ready'
    )?.[1];
    if (onReadyHandler) onReadyHandler();
  });

  afterEach(async () => {
    if (service) {
      await service.disconnect();
    }
  });

  describe('connect', () => {
    it('should initialize Redis connection successfully', async () => {
      const newService = new RedisCacheService();
      mockRedisClient.connect.mockResolvedValue(undefined);

      await newService.connect();

      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      mockRedisClient.connect.mockClear();

      await service.connect();

      expect(mockRedisClient.connect).not.toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      const newService = new RedisCacheService();
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);

      await expect(newService.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('get', () => {
    it('should get value from cache and parse JSON', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(value));

      const result = await service.get(key);

      expect(result).toEqual(value);
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
    });

    it('should return null for cache miss', async () => {
      const key = 'nonexistent';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get(key);

      expect(result).toBeNull();
    });

    it('should handle get errors gracefully', async () => {
      const key = 'error:key';
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get(key);

      expect(result).toBeNull();
    });

    it('should return null when not connected', async () => {
      await service.disconnect();

      const result = await service.get('test:key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value in cache with default TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await service.set(key, value);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        key,
        300, // default TTL
        JSON.stringify(value)
      );
    });

    it('should set value with custom TTL', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const ttl = 600;
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await service.set(key, value, ttl);

      expect(result).toBe(true);
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        key,
        ttl,
        JSON.stringify(value)
      );
    });

    it('should handle set errors', async () => {
      const key = 'error:key';
      mockRedisClient.setEx.mockRejectedValue(new Error('Redis error'));

      const result = await service.set(key, { data: 'test' });

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      await service.disconnect();

      const result = await service.set('test:key', { data: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete key successfully', async () => {
      const key = 'test:key';
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.delete(key);

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
    });

    it('should return false when key does not exist', async () => {
      const key = 'nonexistent';
      mockRedisClient.del.mockResolvedValue(0);

      const result = await service.delete(key);

      expect(result).toBe(false);
    });

    it('should handle delete errors', async () => {
      const key = 'error:key';
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      const result = await service.delete(key);

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      await service.disconnect();

      const result = await service.delete('test:key');

      expect(result).toBe(false);
    });
  });

  describe('deletePattern', () => {
    it('should delete all keys matching pattern', async () => {
      const pattern = 'test:*';
      const keys = ['test:1', 'test:2', 'test:3'];
      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(3);

      const result = await service.deletePattern(pattern);

      expect(result).toBe(3);
      expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
    });

    it('should return 0 when no keys match pattern', async () => {
      const pattern = 'nonexistent:*';
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await service.deletePattern(pattern);

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle delete pattern errors', async () => {
      const pattern = 'error:*';
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      const result = await service.deletePattern(pattern);

      expect(result).toBe(0);
    });

    it('should return 0 when not connected', async () => {
      await service.disconnect();

      const result = await service.deletePattern('test:*');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      const key = 'test:key';
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await service.exists(key);

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith(key);
    });

    it('should return false when key does not exist', async () => {
      const key = 'nonexistent';
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.exists(key);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const key = 'error:key';
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      const result = await service.exists(key);

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      await service.disconnect();

      const result = await service.exists('test:key');

      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return time to live for key', async () => {
      const key = 'test:key';
      const ttl = 300;
      mockRedisClient.ttl.mockResolvedValue(ttl);

      const result = await service.ttl(key);

      expect(result).toBe(ttl);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(key);
    });

    it('should return -1 on error', async () => {
      const key = 'error:key';
      mockRedisClient.ttl.mockRejectedValue(new Error('Redis error'));

      const result = await service.ttl(key);

      expect(result).toBe(-1);
    });

    it('should return -1 when not connected', async () => {
      await service.disconnect();

      const result = await service.ttl('test:key');

      expect(result).toBe(-1);
    });
  });

  describe('flush', () => {
    it('should flush all cache entries', async () => {
      mockRedisClient.flushDb.mockResolvedValue('OK');

      const result = await service.flush();

      expect(result).toBe(true);
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
    });

    it('should handle flush errors', async () => {
      mockRedisClient.flushDb.mockRejectedValue(new Error('Redis error'));

      const result = await service.flush();

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      await service.disconnect();

      const result = await service.flush();

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Generate some cache activity
      mockRedisClient.get.mockResolvedValueOnce(null); // miss
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ data: 'test' })); // hit
      mockRedisClient.setEx.mockResolvedValue('OK');

      await service.get('miss:key');
      await service.get('hit:key');
      await service.set('new:key', { data: 'test' });

      const stats = service.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.totalRequests).toBe(2);
      expect(stats.hitRate).toBe('50.00%');
      expect(stats.isConnected).toBe(true);
    });

    it('should calculate 0% hit rate when no requests', async () => {
      const stats = service.getStats();

      expect(stats.hitRate).toBe('0%');
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics to zero', async () => {
      // Generate some activity
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ data: 'test' }));
      await service.get('test:key');

      service.resetStats();

      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('disconnect', () => {
    it('should close Redis connection', async () => {
      mockRedisClient.quit.mockResolvedValue('OK');

      await service.disconnect();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should not error when disconnecting while not connected', async () => {
      await service.disconnect();

      // Second disconnect should not throw
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'test:key';
      const cachedValue = { data: 'cached' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedValue));

      const fetchFn = jest.fn();
      const result = await service.getOrSet(key, fetchFn);

      expect(result).toEqual(cachedValue);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache value on cache miss', async () => {
      const key = 'test:key';
      const fetchedValue = { data: 'fetched' };
      mockRedisClient.get.mockResolvedValue(null); // cache miss
      mockRedisClient.setEx.mockResolvedValue('OK');

      const fetchFn = jest.fn().mockResolvedValue(fetchedValue);
      const result = await service.getOrSet(key, fetchFn);

      expect(result).toEqual(fetchedValue);
      expect(fetchFn).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        key,
        300,
        JSON.stringify(fetchedValue)
      );
    });

    it('should use custom TTL in getOrSet', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const ttl = 600;
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setEx.mockResolvedValue('OK');

      const fetchFn = jest.fn().mockResolvedValue(value);
      await service.getOrSet(key, fetchFn, ttl);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        key,
        ttl,
        JSON.stringify(value)
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when Redis is healthy', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should return false when ping fails', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection lost'));

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });

    it('should return false when not connected', async () => {
      await service.disconnect();

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });
});
