/**
 * Authentication middleware for Hono on Cloudflare Workers.
 * Ported from server/src/middleware/auth.ts — uses `jose` instead of `jsonwebtoken`.
 */

import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../bindings";
import { getErrorMessage } from "../utils/error-helpers";

/**
 * API key authentication middleware.
 * Checks `x-api-key` header against `env.API_KEY`.
 */
export const apiKeyAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
	const apiKey = c.req.header("x-api-key");

	if (!apiKey || apiKey !== c.env.API_KEY) {
		return c.json({ error: "Unauthorized - Invalid API key" }, 401);
	}

	return next();
};

/**
 * Zod body validation middleware factory.
 */
export function validateBody<T>(schema: {
	parse: (data: unknown) => T;
}): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		try {
			const body = await c.req.json();
			const parsed = schema.parse(body);
			c.set("validatedBody", parsed);
			return next();
		} catch (err) {
			return c.json(
				{ error: "Validation failed", details: getErrorMessage(err) },
				400,
			);
		}
	};
}

/**
 * Zod query validation middleware factory.
 */
export function validateQuery<T>(schema: {
	parse: (data: unknown) => T;
}): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		try {
			const query = c.req.query();
			const parsed = schema.parse(query);
			c.set("validatedQuery", parsed);
			return next();
		} catch (err) {
			return c.json(
				{ error: "Validation failed", details: getErrorMessage(err) },
				400,
			);
		}
	};
}
