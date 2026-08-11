/**
 * Contract for T17: both provider fetch calls carry an AbortSignal so a hung
 * provider fails into the keyword fallback instead of burning the request budget.
 *
 * Implementation in callAnthropicAPI / callGrokAPI passes
 * AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS) to each fetch.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AI_PROVIDER_TIMEOUT_MS,
	parseNaturalLanguageQuery,
} from "../claude.service";

const FILTERS_JSON = JSON.stringify({
	whereClause: { city: { contains: "Austin" } },
	explanation: "Properties in Austin",
});

function anthropicOk() {
	return new Response(
		JSON.stringify({
			content: [{ type: "text", text: FILTERS_JSON }],
			model: "claude-3-haiku-20240307",
		}),
		{ status: 200 },
	);
}

function anthropicCreditExhausted() {
	return new Response(
		JSON.stringify({
			error: { message: "Your credit balance is too low to access the API" },
		}),
		{ status: 400 },
	);
}

function grokOk() {
	return new Response(
		JSON.stringify({
			choices: [{ message: { content: FILTERS_JSON } }],
			model: "grok-4.20-0309-non-reasoning",
		}),
		{ status: 200 },
	);
}

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("AI_PROVIDER_TIMEOUT_MS", () => {
	it("is a positive number", () => {
		expect(AI_PROVIDER_TIMEOUT_MS).toBeGreaterThan(0);
	});
});

describe("provider timeout signal", () => {
	it("passes an AbortSignal to the Anthropic fetch", async () => {
		let capturedSignal: AbortSignal | null | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: unknown, init?: RequestInit) => {
				capturedSignal = init?.signal;
				return anthropicOk();
			}),
		);

		await parseNaturalLanguageQuery("q", "sk-ant");

		expect(capturedSignal).toBeInstanceOf(AbortSignal);
	});

	it("calls AbortSignal.timeout with AI_PROVIDER_TIMEOUT_MS for Anthropic", async () => {
		const mockSignal = AbortSignal.abort(); // arbitrary pre-aborted signal as a stand-in
		vi.spyOn(AbortSignal, "timeout").mockReturnValue(mockSignal);

		let capturedSignal: AbortSignal | null | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: unknown, init?: RequestInit) => {
				capturedSignal = init?.signal;
				return anthropicOk();
			}),
		);

		await parseNaturalLanguageQuery("q", "sk-ant");

		expect(AbortSignal.timeout).toHaveBeenCalledWith(AI_PROVIDER_TIMEOUT_MS);
		expect(capturedSignal).toBe(mockSignal);
	});

	it("passes an AbortSignal to the Grok fetch on fallback", async () => {
		let grokSignal: AbortSignal | null | undefined;
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(anthropicCreditExhausted())
				.mockImplementationOnce(async (_url: unknown, init?: RequestInit) => {
					grokSignal = init?.signal;
					return grokOk();
				}),
		);

		await parseNaturalLanguageQuery("q", "sk-ant", "xai-key");

		expect(grokSignal).toBeInstanceOf(AbortSignal);
	});

	it("calls AbortSignal.timeout twice when both providers are called", async () => {
		vi.spyOn(AbortSignal, "timeout").mockReturnValue(AbortSignal.abort());
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(anthropicCreditExhausted())
				.mockResolvedValueOnce(grokOk()),
		);

		await parseNaturalLanguageQuery("q", "sk-ant", "xai-key");

		expect(AbortSignal.timeout).toHaveBeenCalledTimes(2);
		expect(AbortSignal.timeout).toHaveBeenNthCalledWith(
			1,
			AI_PROVIDER_TIMEOUT_MS,
		);
		expect(AbortSignal.timeout).toHaveBeenNthCalledWith(
			2,
			AI_PROVIDER_TIMEOUT_MS,
		);
	});

	it("propagates an abort error so the caller can fall back to keyword search", async () => {
		// Simulate a hung Anthropic call: mock AbortSignal.timeout to fire
		// immediately and mock fetch to reject when the signal is already aborted.
		vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
			const ctrl = new AbortController();
			ctrl.abort(
				new DOMException("The operation was aborted.", "TimeoutError"),
			);
			return ctrl.signal;
		});

		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: unknown, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						const signal = init?.signal;
						const abort = () =>
							reject(
								new DOMException("The operation was aborted.", "AbortError"),
							);
						if (signal?.aborted) {
							abort();
						} else {
							signal?.addEventListener("abort", abort);
						}
					}),
			),
		);

		// No Grok key — Anthropic timeout should propagate to the caller.
		await expect(parseNaturalLanguageQuery("q", "sk-ant")).rejects.toThrow(
			/aborted/i,
		);
	});
});
