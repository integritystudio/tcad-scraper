import { createClient } from "redis";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted for stable mock state across test lifecycle
const { mockClient } = vi.hoisted(() => {
	const mockClient = {
		connect: vi.fn().mockResolvedValue(undefined),
		quit: vi.fn().mockResolvedValue(undefined),
		get: vi.fn(),
		set: vi.fn(),
		setEx: vi.fn(),
		del: vi.fn(),
		keys: vi.fn(),
		exists: vi.fn(),
		ttl: vi.fn(),
		flushDb: vi.fn(),
		ping: vi.fn(),
		on: vi.fn(),
	};
	return { mockClient };
});

// Mock redis BEFORE importing the service
vi.mock("redis", () => ({
	createClient: vi.fn(() => mockClient),
}));

// Mock logger to suppress output during tests
vi.mock("../logger", () => ({
	default: {
		info: () => {},
		warn: () => {},
		error: () => {},
		debug: () => {},
	},
}));

import { RedisCacheService } from "../redis-cache.service";

describe("RedisCacheService", () => {
	let service: RedisCacheService;

	beforeEach(async () => {
		// Reset all mocks INCLUDING implementations (not just call history)
		vi.resetAllMocks();

		// Re-apply default resolved values after reset
		mockClient.connect.mockResolvedValue(undefined);
		mockClient.quit.mockResolvedValue(undefined);

		// Create service and connect
		service = new RedisCacheService();

		// Connect to Redis (this will call createClient)
		await service.connect();

		// Trigger the 'ready' event to set isConnected = true
		const onReadyHandler = mockClient.on.mock.calls.find(
			(call: unknown[]) => call[0] === "ready",
		)?.[1] as (() => void) | undefined;
		if (onReadyHandler) onReadyHandler();
	});

	afterEach(async () => {
		if (service) {
			await service.disconnect();
		}
	});

	describe("connect", () => {
		it("should initialize Redis connection successfully", async () => {
			const newService = new RedisCacheService();
			mockClient.connect.mockResolvedValue(undefined);

			await newService.connect();

			expect(mockClient.connect).toHaveBeenCalled();
		});

		it("should not reconnect if already connected", async () => {
			mockClient.connect.mockClear();

			await service.connect();

			expect(mockClient.connect).not.toHaveBeenCalled();
		});

		it("should handle connection errors", async () => {
			const newService = new RedisCacheService();
			const error = new Error("Connection failed");
			mockClient.connect.mockRejectedValue(error);

			await expect(newService.connect()).rejects.toThrow("Connection failed");
		});
	});

	describe("get", () => {
		it("should get value from cache and parse JSON", async () => {
			const key = "test:key";
			const value = { data: "test" };
			mockClient.get.mockResolvedValue(JSON.stringify(value));

			const result = await service.get(key);

			expect(result).toEqual(value);
			expect(mockClient.get).toHaveBeenCalledWith(key);
		});

		it("should return null for cache miss", async () => {
			const key = "nonexistent";
			mockClient.get.mockResolvedValue(null);

			const result = await service.get(key);

			expect(result).toBeNull();
		});

		it("should handle get errors gracefully", async () => {
			const key = "error:key";
			mockClient.get.mockRejectedValue(new Error("Redis error"));

			const result = await service.get(key);

			expect(result).toBeNull();
		});

		it("should return null when not connected", async () => {
			await service.disconnect();

			const result = await service.get("test:key");

			expect(result).toBeNull();
		});
	});

	describe("set", () => {
		it("should set value in cache with default TTL", async () => {
			const key = "test:key";
			const value = { data: "test" };
			mockClient.setEx.mockResolvedValue("OK");

			const result = await service.set(key, value);

			expect(result).toBe(true);
			expect(mockClient.setEx).toHaveBeenCalledWith(
				key,
				300, // default TTL
				JSON.stringify(value),
			);
		});

		it("should set value with custom TTL", async () => {
			const key = "test:key";
			const value = { data: "test" };
			const ttl = 600;
			mockClient.setEx.mockResolvedValue("OK");

			const result = await service.set(key, value, ttl);

			expect(result).toBe(true);
			expect(mockClient.setEx).toHaveBeenCalledWith(
				key,
				ttl,
				JSON.stringify(value),
			);
		});

		it("should handle set errors", async () => {
			const key = "error:key";
			mockClient.setEx.mockRejectedValue(new Error("Redis error"));

			const result = await service.set(key, { data: "test" });

			expect(result).toBe(false);
		});

		it("should return false when not connected", async () => {
			await service.disconnect();

			const result = await service.set("test:key", { data: "test" });

			expect(result).toBe(false);
		});
	});

	describe("delete", () => {
		it("should delete key successfully", async () => {
			const key = "test:key";
			mockClient.del.mockResolvedValue(1);

			const result = await service.delete(key);

			expect(result).toBe(true);
			expect(mockClient.del).toHaveBeenCalledWith(key);
		});

		it("should return false when key does not exist", async () => {
			const key = "nonexistent";
			mockClient.del.mockResolvedValue(0);

			const result = await service.delete(key);

			expect(result).toBe(false);
		});

		it("should handle delete errors", async () => {
			const key = "error:key";
			mockClient.del.mockRejectedValue(new Error("Redis error"));

			const result = await service.delete(key);

			expect(result).toBe(false);
		});

		it("should return false when not connected", async () => {
			await service.disconnect();

			const result = await service.delete("test:key");

			expect(result).toBe(false);
		});
	});

	describe("deletePattern", () => {
		it("should delete all keys matching pattern", async () => {
			const pattern = "test:*";
			const keys = ["test:1", "test:2", "test:3"];
			mockClient.keys.mockResolvedValue(keys);
			mockClient.del.mockResolvedValue(3);

			const result = await service.deletePattern(pattern);

			expect(result).toBe(3);
			expect(mockClient.keys).toHaveBeenCalledWith(pattern);
			expect(mockClient.del).toHaveBeenCalledWith(keys);
		});

		it("should return 0 when no keys match pattern", async () => {
			const pattern = "nonexistent:*";
			mockClient.keys.mockResolvedValue([]);

			const result = await service.deletePattern(pattern);

			expect(result).toBe(0);
			expect(mockClient.del).not.toHaveBeenCalled();
		});

		it("should handle delete pattern errors", async () => {
			const pattern = "error:*";
			mockClient.keys.mockRejectedValue(new Error("Redis error"));

			const result = await service.deletePattern(pattern);

			expect(result).toBe(0);
		});

		it("should return 0 when not connected", async () => {
			await service.disconnect();

			const result = await service.deletePattern("test:*");

			expect(result).toBe(0);
		});
	});

	describe("exists", () => {
		it("should return true when key exists", async () => {
			const key = "test:key";
			mockClient.exists.mockResolvedValue(1);

			const result = await service.exists(key);

			expect(result).toBe(true);
			expect(mockClient.exists).toHaveBeenCalledWith(key);
		});

		it("should return false when key does not exist", async () => {
			const key = "nonexistent";
			mockClient.exists.mockResolvedValue(0);

			const result = await service.exists(key);

			expect(result).toBe(false);
		});

		it("should return false on error", async () => {
			const key = "error:key";
			mockClient.exists.mockRejectedValue(new Error("Redis error"));

			const result = await service.exists(key);

			expect(result).toBe(false);
		});

		it("should return false when not connected", async () => {
			await service.disconnect();

			const result = await service.exists("test:key");

			expect(result).toBe(false);
		});
	});

	describe("ttl", () => {
		it("should return time to live for key", async () => {
			const key = "test:key";
			const ttl = 300;
			mockClient.ttl.mockResolvedValue(ttl);

			const result = await service.ttl(key);

			expect(result).toBe(ttl);
			expect(mockClient.ttl).toHaveBeenCalledWith(key);
		});

		it("should return -1 on error", async () => {
			const key = "error:key";
			mockClient.ttl.mockRejectedValue(new Error("Redis error"));

			const result = await service.ttl(key);

			expect(result).toBe(-1);
		});

		it("should return -1 when not connected", async () => {
			await service.disconnect();

			const result = await service.ttl("test:key");

			expect(result).toBe(-1);
		});
	});

	describe("flush", () => {
		it("should flush all cache entries", async () => {
			mockClient.flushDb.mockResolvedValue("OK");

			const result = await service.flush();

			expect(result).toBe(true);
			expect(mockClient.flushDb).toHaveBeenCalled();
		});

		it("should handle flush errors", async () => {
			mockClient.flushDb.mockRejectedValue(new Error("Redis error"));

			const result = await service.flush();

			expect(result).toBe(false);
		});

		it("should return false when not connected", async () => {
			await service.disconnect();

			const result = await service.flush();

			expect(result).toBe(false);
		});
	});

	describe("getStats", () => {
		it("should return cache statistics", async () => {
			// Generate some cache activity
			mockClient.get.mockResolvedValueOnce(null); // miss
			mockClient.get.mockResolvedValueOnce(
				JSON.stringify({ data: "test" }),
			); // hit
			mockClient.setEx.mockResolvedValue("OK");

			await service.get("miss:key");
			await service.get("hit:key");
			await service.set("new:key", { data: "test" });

			const stats = service.getStats();

			expect(stats.hits).toBe(1);
			expect(stats.misses).toBe(1);
			expect(stats.sets).toBe(1);
			expect(stats.totalRequests).toBe(2);
			expect(stats.hitRate).toBe("50.00%");
			expect(stats.isConnected).toBe(true);
		});

		it("should calculate 0% hit rate when no requests", async () => {
			const stats = service.getStats();

			expect(stats.hitRate).toBe("0%");
			expect(stats.totalRequests).toBe(0);
		});
	});

	describe("resetStats", () => {
		it("should reset statistics to zero", async () => {
			// Generate some activity
			mockClient.get.mockResolvedValue(JSON.stringify({ data: "test" }));
			await service.get("test:key");

			service.resetStats();

			const stats = service.getStats();
			expect(stats.hits).toBe(0);
			expect(stats.misses).toBe(0);
			expect(stats.sets).toBe(0);
			expect(stats.deletes).toBe(0);
			expect(stats.errors).toBe(0);
		});
	});

	describe("disconnect", () => {
		it("should close Redis connection", async () => {
			mockClient.quit.mockResolvedValue("OK");

			await service.disconnect();

			expect(mockClient.quit).toHaveBeenCalled();
		});

		it("should not error when disconnecting while not connected", async () => {
			await service.disconnect();

			// Second disconnect should not throw
			await expect(service.disconnect()).resolves.not.toThrow();
		});
	});

	describe("getOrSet", () => {
		it("should return cached value if exists", async () => {
			const key = "test:key";
			const cachedValue = { data: "cached" };
			mockClient.get.mockResolvedValue(JSON.stringify(cachedValue));

			const fetchFn = vi.fn();
			const result = await service.getOrSet(key, fetchFn);

			expect(result).toEqual(cachedValue);
			expect(fetchFn).not.toHaveBeenCalled();
		});

		it("should fetch and cache value on cache miss", async () => {
			const key = "test:key";
			const fetchedValue = { data: "fetched" };
			mockClient.get.mockResolvedValue(null); // cache miss
			mockClient.setEx.mockResolvedValue("OK");

			const fetchFn = vi.fn().mockResolvedValue(fetchedValue);
			const result = await service.getOrSet(key, fetchFn);

			expect(result).toEqual(fetchedValue);
			expect(fetchFn).toHaveBeenCalled();
			expect(mockClient.setEx).toHaveBeenCalledWith(
				key,
				300,
				JSON.stringify(fetchedValue),
			);
		});

		it("should use custom TTL in getOrSet", async () => {
			const key = "test:key";
			const value = { data: "test" };
			const ttl = 600;
			mockClient.get.mockResolvedValue(null);
			mockClient.setEx.mockResolvedValue("OK");

			const fetchFn = vi.fn().mockResolvedValue(value);
			await service.getOrSet(key, fetchFn, ttl);

			expect(mockClient.setEx).toHaveBeenCalledWith(
				key,
				ttl,
				JSON.stringify(value),
			);
		});
	});

	describe("healthCheck", () => {
		it("should return true when Redis is healthy", async () => {
			mockClient.ping.mockResolvedValue("PONG");

			const result = await service.healthCheck();

			expect(result).toBe(true);
			expect(mockClient.ping).toHaveBeenCalled();
		});

		it("should return false when ping fails", async () => {
			mockClient.ping.mockRejectedValue(new Error("Connection lost"));

			const result = await service.healthCheck();

			expect(result).toBe(false);
		});

		it("should return false when not connected", async () => {
			await service.disconnect();

			const result = await service.healthCheck();

			expect(result).toBe(false);
		});
	});
});
