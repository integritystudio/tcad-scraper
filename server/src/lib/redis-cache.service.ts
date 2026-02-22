/**
 * Redis Cache Service
 *
 * Provides caching layer for frequently accessed data with:
 * - Automatic TTL management
 * - Cache-aside pattern
 * - Serialization/deserialization
 * - Cache statistics and monitoring
 */

import { createClient, type RedisClientType } from "redis";
import { config } from "../config";
import { getErrorMessage } from "../utils/error-helpers";
import logger from "./logger";

export class RedisCacheService {
	private client: RedisClientType | null = null;
	private isConnected: boolean = false;
	private stats = {
		hits: 0,
		misses: 0,
		sets: 0,
		deletes: 0,
		errors: 0,
	};

	/**
	 * Initialize Redis client connection
	 */
	async connect(): Promise<void> {
		if (this.isConnected) {
			logger.warn("Redis cache already connected");
			return;
		}

		try {
			this.client = config.redis.url
				? createClient({
						url: config.redis.url,
						socket: { connectTimeout: config.redis.connectionTimeout },
					})
				: createClient({
						socket: {
							host: config.redis.host,
							port: config.redis.port,
							connectTimeout: config.redis.connectionTimeout,
						},
						password: config.redis.password,
						database: config.redis.db,
					});

			this.client.on("error", (err) => {
				logger.error("Redis cache error: %s", getErrorMessage(err));
				this.stats.errors++;
			});

			this.client.on("connect", () => {
				logger.info("Redis cache connecting...");
			});

			this.client.on("ready", () => {
				logger.info("Redis cache ready");
				this.isConnected = true;
			});

			this.client.on("end", () => {
				logger.info("Redis cache connection closed");
				this.isConnected = false;
			});

			await this.client.connect();
			logger.info("Redis cache service initialized");
		} catch (error) {
			logger.error(
				"Failed to connect to Redis cache: %s",
				getErrorMessage(error),
			);
			this.stats.errors++;
			throw error;
		}
	}

	/**
	 * Get value from cache
	 */
	async get<T>(key: string): Promise<T | null> {
		if (!this.client || !this.isConnected) {
			logger.warn("Redis cache not connected, skipping get");
			return null;
		}

		try {
			const value = await this.client.get(key);

			if (value === null) {
				this.stats.misses++;
				logger.debug(`Cache MISS: ${key}`);
				return null;
			}

			this.stats.hits++;
			logger.debug(`Cache HIT: ${key}`);
			return JSON.parse(value) as T;
		} catch (error) {
			logger.error(
				`Cache get error for key ${key}: %s`,
				getErrorMessage(error),
			);
			this.stats.errors++;
			return null;
		}
	}

	/**
	 * Set value in cache with TTL
	 * @param key Cache key
	 * @param value Value to cache (will be JSON stringified)
	 * @param ttlSeconds Time to live in seconds (default: 300 = 5 minutes)
	 */
	async set(
		key: string,
		value: unknown,
		ttlSeconds: number = 300,
	): Promise<boolean> {
		if (!this.client || !this.isConnected) {
			logger.warn("Redis cache not connected, skipping set");
			return false;
		}

		try {
			const serialized = JSON.stringify(value);
			await this.client.setEx(key, ttlSeconds, serialized);

			this.stats.sets++;
			logger.debug(`Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
			return true;
		} catch (error) {
			logger.error(
				`Cache set error for key ${key}: %s`,
				getErrorMessage(error),
			);
			this.stats.errors++;
			return false;
		}
	}

	/**
	 * Delete value from cache
	 */
	async delete(key: string): Promise<boolean> {
		if (!this.client || !this.isConnected) {
			logger.warn("Redis cache not connected, skipping delete");
			return false;
		}

		try {
			const result = await this.client.del(key);

			this.stats.deletes++;
			logger.debug(`Cache DELETE: ${key}`);
			return result > 0;
		} catch (error) {
			logger.error(
				`Cache delete error for key ${key}: %s`,
				getErrorMessage(error),
			);
			this.stats.errors++;
			return false;
		}
	}

	/**
	 * Delete all keys matching a pattern
	 * @param pattern Redis key pattern (e.g., "property:*")
	 */
	async deletePattern(pattern: string): Promise<number> {
		if (!this.client || !this.isConnected) {
			logger.warn("Redis cache not connected, skipping delete pattern");
			return 0;
		}

		try {
			const keys = await this.client.keys(pattern);

			if (keys.length === 0) {
				return 0;
			}

			const result = await this.client.del(keys);

			this.stats.deletes += result;
			logger.info(`Cache DELETE PATTERN: ${pattern} (${result} keys deleted)`);
			return result;
		} catch (error) {
			logger.error(
				`Cache delete pattern error for ${pattern}: %s`,
				getErrorMessage(error),
			);
			this.stats.errors++;
			return 0;
		}
	}

	/**
	 * Check if key exists in cache
	 */
	async exists(key: string): Promise<boolean> {
		if (!this.client || !this.isConnected) {
			return false;
		}

		try {
			const result = await this.client.exists(key);
			return result === 1;
		} catch (error) {
			logger.error(
				`Cache exists error for key ${key}: %s`,
				getErrorMessage(error),
			);
			return false;
		}
	}

	/**
	 * Get time to live for a key
	 */
	async ttl(key: string): Promise<number> {
		if (!this.client || !this.isConnected) {
			return -1;
		}

		try {
			return await this.client.ttl(key);
		} catch (error) {
			logger.error(
				`Cache TTL error for key ${key}: %s`,
				getErrorMessage(error),
			);
			return -1;
		}
	}

	/**
	 * Flush all cache entries
	 */
	async flush(): Promise<boolean> {
		if (!this.client || !this.isConnected) {
			logger.warn("Redis cache not connected, skipping flush");
			return false;
		}

		try {
			await this.client.flushDb();
			logger.info("Cache flushed");
			return true;
		} catch (error) {
			logger.error("Cache flush error: %s", getErrorMessage(error));
			this.stats.errors++;
			return false;
		}
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		const totalRequests = this.stats.hits + this.stats.misses;
		const hitRate =
			totalRequests > 0
				? `${((this.stats.hits / totalRequests) * 100).toFixed(2)}%`
				: "0%";

		return {
			...this.stats,
			totalRequests,
			hitRate,
			isConnected: this.isConnected,
		};
	}

	/**
	 * Reset statistics
	 */
	resetStats(): void {
		this.stats = {
			hits: 0,
			misses: 0,
			sets: 0,
			deletes: 0,
			errors: 0,
		};
		logger.info("Cache statistics reset");
	}

	/**
	 * Close Redis connection
	 */
	async disconnect(): Promise<void> {
		if (this.client && this.isConnected) {
			await this.client.quit();
			this.isConnected = false;
			logger.info("Redis cache disconnected");
		}
	}

	/**
	 * Cache-aside pattern helper
	 * Automatically gets from cache or fetches from source
	 *
	 * @param key Cache key
	 * @param fetchFn Function to fetch data if not in cache
	 * @param ttlSeconds Cache TTL in seconds
	 */
	async getOrSet<T>(
		key: string,
		fetchFn: () => Promise<T>,
		ttlSeconds: number = 300,
	): Promise<T> {
		// Try to get from cache first
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Cache miss - fetch from source
		const data = await fetchFn();

		// Store in cache for next time
		await this.set(key, data, ttlSeconds);

		return data;
	}

	/**
	 * Health check
	 */
	async healthCheck(): Promise<boolean> {
		if (!this.client || !this.isConnected) {
			return false;
		}

		try {
			const result = await this.client.ping();
			return result === "PONG";
		} catch (error) {
			logger.error("Cache health check failed: %s", getErrorMessage(error));
			return false;
		}
	}
}

// Export singleton instance
export const cacheService = new RedisCacheService();

// Initialize on module load
cacheService.connect().catch((error: unknown) => {
	logger.error(
		"Failed to initialize Redis cache on startup: %s",
		getErrorMessage(error),
	);
});

