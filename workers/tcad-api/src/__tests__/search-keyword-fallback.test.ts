/**
 * POST /api/properties/search must degrade when no AI provider is reachable
 * (e.g. exhausted credits on both Anthropic and OpenAI) instead of
 * returning 503: first to FTS5 keyword search, then to plain contains
 * filters if the FTS table is unavailable.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";

const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockQueryRaw = vi.fn();
let capturedWhere: unknown;

vi.mock("../db", () => ({
	createPrisma: () => ({
		property: {
			findMany: (args: { where: unknown }) => {
				capturedWhere = args.where;
				return mockFindMany(args);
			},
			count: () => mockCount(),
		},
		$queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
	}),
}));

vi.mock("../lib/claude.service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../lib/claude.service")>();
	return {
		...actual,
		parseNaturalLanguageQuery: vi
			.fn()
			.mockRejectedValue(
				new Error("Claude API error 400: credit balance is too low"),
			),
	};
});

// D1 binding is consumed only by the mocked createPrisma
const TEST_ENV = { DB: {} };

const searchRequest = () =>
	app.request(
		"/api/properties/search",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query: "Oak Street" }),
		},
		TEST_ENV,
	);

describe("POST /api/properties/search — keyword fallback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		capturedWhere = undefined;
		mockFindMany.mockResolvedValue([]);
		mockCount.mockResolvedValue(0);
	});

	it("serves FTS5 keyword results instead of 503", async () => {
		mockQueryRaw.mockResolvedValue([{ id: "prop-1" }, { id: "prop-2" }]);

		const res = await searchRequest();

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			query: { explanation: string; answer?: string };
		};
		expect(body.query.explanation).toContain('Keyword search for "Oak Street"');
		expect(body.query.answer).toBeUndefined();
		expect(mockQueryRaw).toHaveBeenCalledTimes(1);
		expect(capturedWhere).toMatchObject({
			year: 2025,
			id: { in: ["prop-1", "prop-2"] },
		});
	});

	it("degrades to contains filters when the FTS table is unavailable", async () => {
		mockQueryRaw.mockRejectedValue(new Error("no such table: properties_fts"));

		const res = await searchRequest();

		expect(res.status).toBe(200);
		expect(capturedWhere).toMatchObject({
			year: 2025,
			OR: [
				{ name: { contains: "Oak Street" } },
				{ propertyAddress: { contains: "Oak Street" } },
				{ city: { contains: "Oak Street" } },
				{ description: { contains: "Oak Street" } },
			],
		});
	});
});
