/**
 * Contract for what parseNaturalLanguageQuery reports about its source.
 *
 * /search/test is a diagnostic, so "which provider answered" has to track
 * reality: the endpoint previously claimed "Claude API connection successful"
 * while the Grok fallback was serving every request, which made the one thing
 * it exists to tell you the one thing it got wrong.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { parseNaturalLanguageQuery } from "../claude.service";

const FILTERS_JSON = JSON.stringify({
	whereClause: { city: { contains: "Austin" } },
	explanation: "Properties in Austin",
});

function anthropicOk(model = "claude-3-haiku-20240307") {
	return new Response(
		JSON.stringify({ content: [{ type: "text", text: FILTERS_JSON }], model }),
		{ status: 200 },
	);
}

/** Anthropic reports an exhausted balance as 400, not 402. */
function anthropicCreditExhausted() {
	return new Response(
		JSON.stringify({
			error: { message: "Your credit balance is too low to access the API" },
		}),
		{ status: 400 },
	);
}

function grokOk(model = "grok-4.20-0309-non-reasoning") {
	return new Response(
		JSON.stringify({
			choices: [{ message: { content: FILTERS_JSON } }],
			model,
		}),
		{ status: 200 },
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("parseNaturalLanguageQuery provider reporting", () => {
	it("reports anthropic when Anthropic answers", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => anthropicOk()),
		);

		const result = await parseNaturalLanguageQuery("q", "sk-ant", "xai-key");

		expect(result.provider).toBe("anthropic");
		expect(result.model).toBe("claude-3-haiku-20240307");
		expect(result.filters.whereClause).toEqual({
			city: { contains: "Austin" },
		});
	});

	it("reports grok when the fallback answers", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(anthropicCreditExhausted())
			.mockResolvedValueOnce(grokOk());
		vi.stubGlobal("fetch", fetchMock);

		const result = await parseNaturalLanguageQuery("q", "sk-ant", "xai-key");

		expect(result.provider).toBe("grok");
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result.filters.whereClause).toEqual({
			city: { contains: "Austin" },
		});
	});

	it("reports the model the provider served, not the one requested", async () => {
		// xAI substitutes silently for an unknown model name: a request for the
		// nonexistent "grok-3" came back served_as "grok-4.3". Surfacing the
		// served value is what makes that visible instead of silent.
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(anthropicCreditExhausted())
				.mockResolvedValueOnce(grokOk("grok-4.3")),
		);

		const result = await parseNaturalLanguageQuery("q", "sk-ant", "xai-key");

		expect(result.model).toBe("grok-4.3");
	});

	it("does not claim a provider when no provider answered", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => anthropicCreditExhausted()),
		);

		// No fallback key, so the Anthropic error propagates rather than
		// resolving to a misleading success.
		await expect(parseNaturalLanguageQuery("q", "sk-ant")).rejects.toThrow(
			/credit balance/i,
		);
	});
});
