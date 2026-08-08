/**
 * usePropertySearch Hook Tests
 *
 * Regression coverage for the stale-abort loading bug: a superseded search
 * call's `finally` block must not clear `loading` while a newer call is
 * still genuinely in flight.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePropertySearch } from "../usePropertySearch";

interface PendingFetch {
	resolve: (data: unknown) => void;
	settled: boolean;
}

const emptyResult = {
	data: [],
	pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
};

describe("usePropertySearch", () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let pending: PendingFetch[];

	beforeEach(() => {
		pending = [];
		fetchMock = vi.fn((_url: string, options?: { signal?: AbortSignal }) => {
			const entry: PendingFetch = { resolve: () => {}, settled: false };
			const promise = new Promise((resolve, reject) => {
				entry.resolve = (data: unknown) =>
					resolve({ ok: true, json: async () => data });
				options?.signal?.addEventListener("abort", () => {
					reject(new DOMException("Aborted", "AbortError"));
				});
			});
			pending.push(entry);
			return promise.finally(() => {
				entry.settled = true;
			});
		});
		global.fetch = fetchMock as unknown as typeof fetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps loading=true when a stale, aborted call's finally runs after a newer call has taken over", async () => {
		const { result } = renderHook(() => usePropertySearch());

		// Let the initial-load-on-mount fetch resolve first.
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		act(() => pending[0].resolve(emptyResult));
		await waitFor(() => expect(result.current.initialLoad).toBe(false));
		expect(result.current.loading).toBe(false);

		// Call A starts.
		act(() => {
			result.current.search("call-a");
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(result.current.loading).toBe(true);

		// Call B supersedes call A: aborts A's controller, starts its own fetch.
		act(() => {
			result.current.search("call-b");
		});
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
		expect(result.current.loading).toBe(true);

		// Call A's aborted fetch settles (rejects with AbortError); its catch
		// returns early, but its finally must NOT clear loading — call B is
		// still in flight.
		await waitFor(() => expect(pending[1].settled).toBe(true));
		expect(result.current.loading).toBe(true);

		// Call B resolves — only now should loading clear.
		act(() =>
			pending[2].resolve({
				data: [],
				pagination: { total: 3, limit: 50, offset: 0, hasMore: false },
			}),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.totalResults).toBe(3);
	});
});
