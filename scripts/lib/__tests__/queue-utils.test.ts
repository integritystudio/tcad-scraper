import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// queue-utils exits at import time without an API key, so the env must be set
// before the module loads — hence the dynamic import instead of a static one.
process.env.TCAD_API_KEY = "test-api-key";
const { DRAIN_TIMEOUT_MS, POLL_INTERVAL_MS, enqueueBatch, waitForQueueDrain } =
	await import("../queue-utils");

interface HistoryJob {
	searchTerm: string;
	status: string;
	startedAt: string;
}

// Older than the 30s clock-skew tolerance, so the job predates the cutoff
const STALE_AGE_MS = 60_000;

function job(
	searchTerm: string,
	status: string,
	startedAtMs: number,
): HistoryJob {
	return { searchTerm, status, startedAt: new Date(startedAtMs).toISOString() };
}

function historyResponse(jobs: HistoryJob[], hasMore = false): Response {
	return {
		ok: true,
		json: async () => ({ data: jobs, pagination: { hasMore } }),
	} as Response;
}

function okResponse(): Response {
	return { ok: true } as Response;
}

function errorResponse(status: number, statusText: string): Response {
	return { ok: false, status, statusText } as Response;
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("waitForQueueDrain", () => {
	it("resolves after one poll when every term has a terminal job started after enqueue", async () => {
		const now = Date.now();
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				historyResponse([
					job("Alpha", "completed", now + 1_000),
					job("Bravo", "failed", now + 1_000),
				]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha", "Bravo"], now, {
			error: vi.fn(),
		});
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("matches job search terms case-insensitively", async () => {
		const now = Date.now();
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				historyResponse([job("ALPHA", "completed", now + 1_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, { error: vi.fn() });
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("ignores terminal jobs started before the enqueue cutoff", async () => {
		const now = Date.now();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now - STALE_AGE_MS)]),
			)
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 1_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, { error: vi.fn() });
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("treats an unparseable startedAt as stale and keeps polling", async () => {
		const now = Date.now();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				historyResponse([
					{ searchTerm: "Alpha", status: "completed", startedAt: "not-a-date" },
				]),
			)
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 1_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, { error: vi.fn() });
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("keeps polling while jobs are still processing", async () => {
		const now = Date.now();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "processing", now + 1_000)]),
			)
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 2_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, { error: vi.fn() });
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("returns immediately without polling when there are no terms", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await waitForQueueDrain([], Date.now(), { error: vi.fn() });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("continues polling after a rejected history fetch", async () => {
		const now = Date.now();
		const logger = { error: vi.fn() };
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new Error("network down"))
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 1_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, logger);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("network down"),
		);
	});

	it("continues polling after a non-ok history response", async () => {
		const now = Date.now();
		const logger = { error: vi.fn() };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"))
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 1_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, logger);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("HTTP 500"),
		);
	});

	it("paginates to the next page when the first page is full and hasMore=true", async () => {
		const now = Date.now();
		// 100 unrelated completed jobs fill page 1; target is on page 2
		const page1Jobs = Array.from({ length: 100 }, (_, i) =>
			job(`other${i}`, "completed", now + 1_000),
		);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(historyResponse(page1Jobs, true))
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 500)], false),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, { error: vi.fn() });
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("stops paginating once a job older than the cutoff is encountered", async () => {
		const now = Date.now();
		// Page 1: 100 unrelated jobs (hasMore=true), page 2: starts with a stale job
		const page1Jobs = Array.from({ length: 100 }, (_, i) =>
			job(`other${i}`, "completed", now + 1_000),
		);
		const fetchMock = vi
			.fn()
			// poll 1, page 1: full page, hasMore
			.mockResolvedValueOnce(historyResponse(page1Jobs, true))
			// poll 1, page 2: stale job triggers cutoff stop; target not yet visible
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now - STALE_AGE_MS)], false),
			)
			// poll 2, page 1: target now present with a fresh timestamp
			.mockResolvedValueOnce(
				historyResponse([job("Alpha", "completed", now + 1_000)], false),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, { error: vi.fn() });
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
		await drained;

		// 2 fetches in poll 1 (stops at cutoff), 1 fetch in poll 2
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("gives up after the drain timeout and logs unfinished terms", async () => {
		const now = Date.now();
		const logger = { error: vi.fn() };
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				historyResponse([job("Alpha", "processing", now + 1_000)]),
			);
		vi.stubGlobal("fetch", fetchMock);

		const drained = waitForQueueDrain(["Alpha"], now, logger);
		await vi.advanceTimersByTimeAsync(DRAIN_TIMEOUT_MS + POLL_INTERVAL_MS);
		await drained;

		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("Drain timeout"),
		);
		expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Alpha"));
	});
});

describe("enqueueBatch", () => {
	it("POSTs each term to the scrape endpoint with the API key", async () => {
		const fetchMock = vi.fn().mockResolvedValue(okResponse());
		vi.stubGlobal("fetch", fetchMock);

		await enqueueBatch(["Alpha"], { error: vi.fn() });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.alephatx.info/api/properties/scrape",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": "test-api-key",
				},
				body: JSON.stringify({ searchTerm: "Alpha" }),
			},
		);
	});

	it("returns only the terms the API accepted", async () => {
		const logger = { error: vi.fn() };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(okResponse())
			.mockResolvedValueOnce(errorResponse(500, "Internal Server Error"))
			.mockResolvedValueOnce(okResponse());
		vi.stubGlobal("fetch", fetchMock);

		const enqueued = await enqueueBatch(["Alpha", "Bravo", "Charlie"], logger);

		expect(enqueued).toEqual(["Alpha", "Charlie"]);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining('"Bravo"'),
		);
	});

	it("omits terms whose request throws and logs the error", async () => {
		const logger = { error: vi.fn() };
		const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
		vi.stubGlobal("fetch", fetchMock);

		const enqueued = await enqueueBatch(["Alpha"], logger);

		expect(enqueued).toEqual([]);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining("network down"),
		);
	});
});
