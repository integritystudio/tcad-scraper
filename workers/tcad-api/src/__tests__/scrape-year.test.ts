/**
 * Year selection contract for POST /api/properties/scrape.
 *
 * TCAD serves several roll years concurrently, so which year a scrape targets
 * is a per-request decision, not a deployment-wide one. Flipping the TCAD_YEAR
 * var to run a 2026 backfill would also retarget the monitored-search cron and
 * every ad-hoc scrape, so the request body carries an optional `year` that
 * overrides it. These tests pin that precedence — an omitted `year` must keep
 * falling back to the var, because every pre-2026 caller depends on it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";

const mockSend = vi.fn();

vi.mock("../db", () => ({
	createPrisma: () => ({}),
}));

const API_KEY = "test-api-key";
const ENV_YEAR = "2025";
const REQUESTED_YEAR = 2026;

const TEST_ENV = {
	DB: {},
	API_KEY,
	TCAD_YEAR: ENV_YEAR,
	SCRAPER_QUEUE: { send: (...args: unknown[]) => mockSend(...args) },
};

const HTTP_ACCEPTED = 202;
const HTTP_BAD_REQUEST = 400;

async function scrape(
	body: Record<string, unknown>,
	env: Record<string, unknown> = TEST_ENV,
): Promise<Response> {
	return app.request(
		"/api/properties/scrape",
		{
			method: "POST",
			headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
			body: JSON.stringify(body),
		},
		env,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSend.mockResolvedValue(undefined);
});

describe("POST /scrape year selection", () => {
	it("falls back to the TCAD_YEAR var when the body omits a year", async () => {
		const res = await scrape({ searchTerm: "Smith" });

		expect(res.status).toBe(HTTP_ACCEPTED);
		expect(mockSend).toHaveBeenCalledWith({
			searchTerm: "Smith",
			year: Number(ENV_YEAR),
		});
	});

	it("uses the requested year when the body supplies one", async () => {
		const res = await scrape({ searchTerm: "Smith", year: REQUESTED_YEAR });

		expect(res.status).toBe(HTTP_ACCEPTED);
		expect(mockSend).toHaveBeenCalledWith({
			searchTerm: "Smith",
			year: REQUESTED_YEAR,
		});
	});

	it("echoes the resolved year so a caller can confirm what was queued", async () => {
		const res = await scrape({ searchTerm: "Smith", year: REQUESTED_YEAR });

		expect(await res.json()).toMatchObject({ year: REQUESTED_YEAR });
	});

	it("falls back to the default when TCAD_YEAR is unset or malformed", async () => {
		// parseInt returns NaN here, which is not nullish — a `??` fallback
		// would queue NaN and the workflow would ask TCAD for pYear "NaN".
		await scrape({ searchTerm: "Smith" }, { ...TEST_ENV, TCAD_YEAR: "" });

		expect(mockSend).toHaveBeenCalledWith({
			searchTerm: "Smith",
			year: Number(ENV_YEAR),
		});
	});

	it("rejects a non-integer year", async () => {
		const res = await scrape({ searchTerm: "Smith", year: 2026.5 });

		expect(res.status).toBe(HTTP_BAD_REQUEST);
		expect(mockSend).not.toHaveBeenCalled();
	});

	it("rejects a year outside the accepted range", async () => {
		const res = await scrape({ searchTerm: "Smith", year: 20_226 });

		expect(res.status).toBe(HTTP_BAD_REQUEST);
		expect(mockSend).not.toHaveBeenCalled();
	});
});
