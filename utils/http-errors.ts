/**
 * HTTP status codes commonly used by APIs.
 */

export const HttpStatus = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	PAYMENT_REQUIRED: 402,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
	BAD_GATEWAY: 502,
	SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

export interface HttpErrorOptions extends ErrorOptions {
	readonly status: HttpStatusCode;
	readonly expose?: boolean;
	readonly details?: unknown;
}

export class HttpError extends Error {
	readonly status: HttpStatusCode;
	readonly expose: boolean;
	readonly details?: unknown;

	constructor(
		message: string,
		{ status, expose = status < 500, details, cause }: HttpErrorOptions,
	) {
		super(message, { cause });

		this.name = new.target.name;
		this.status = status;
		this.expose = expose;
		this.details = details;

		Object.setPrototypeOf(this, new.target.prototype);
	}

	toJSON() {
		return {
			error: this.name,
			message: this.message,
			status: this.status,
			...(this.details !== undefined && {
				details: this.details,
			}),
		};
	}
}

/**
 * Generic constructor.
 */
export function createHttpError(
	status: HttpStatusCode,
	message: string,
	options: Omit<HttpErrorOptions, "status"> = {},
): HttpError {
	return new HttpError(message, {
		status,
		...options,
	});
}

// Convenience helpers

export const badRequest = (
	message = "Bad Request",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.BAD_REQUEST, message, options);

export const unauthorized = (
	message = "Unauthorized",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.UNAUTHORIZED, message, options);

export const forbidden = (
	message = "Forbidden",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.FORBIDDEN, message, options);

export const notFound = (
	message = "Not Found",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.NOT_FOUND, message, options);

export const conflict = (
	message = "Conflict",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.CONFLICT, message, options);

export const unprocessable = (
	message = "Unprocessable Entity",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.UNPROCESSABLE_ENTITY, message, options);

export const rateLimited = (
	message = "Too Many Requests",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.TOO_MANY_REQUESTS, message, options);

export const internal = (
	message = "Internal Server Error",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.INTERNAL_SERVER_ERROR, message, options);

export const badGateway = (
	message = "Bad Gateway",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.BAD_GATEWAY, message, options);

export const unavailable = (
	message = "Service Unavailable",
	options?: Omit<HttpErrorOptions, "status">,
) => createHttpError(HttpStatus.SERVICE_UNAVAILABLE, message, options);

/**
 * Type guard.
 */
export function isHttpError(error: unknown): error is HttpError {
	return error instanceof HttpError;
}
