/**
 * POST /api/properties/search must degrade when no AI provider is reachable
 * (e.g. exhausted credits on both Anthropic and xAI) instead of
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
		// T13: FTS now runs two queries per ftsQueryPage call (page + COUNT) so
		// the mock must route by SQL shape rather than returning the same value.
		mockQueryRaw.mockImplementation((...args: unknown[]) => {
			const sql = Array.from(args[0] as TemplateStringsArray).join("?");
			return Promise.resolve(
				sql.includes("COUNT(*)")
					? [{ total: 2 }]
					: [{ id: "prop-1" }, { id: "prop-2" }],
			);
		});

		const res = await searchRequest();

		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			query: { explanation: string; answer?: string };
		};
		expect(body.query.explanation).toContain('Keyword search for "Oak Street"');
		expect(body.query.answer).toBeUndefined();
		// One AND ftsQueryPage call = 2 $queryRaw calls (page + count)
		expect(mockQueryRaw).toHaveBeenCalledTimes(2);
		expect(capturedWhere).toMatchObject({
			year: 2025,
			id: { in: ["prop-1", "prop-2"] },
		});
	});

	it("serves the GET /search variant with identical fallback semantics", async () => {
		mockQueryRaw.mockImplementation((...args: unknown[]) => {
			const sql = Array.from(args[0] as TemplateStringsArray).join("?");
			return Promise.resolve(
				sql.includes("COUNT(*)") ? [{ total: 1 }] : [{ id: "prop-1" }],
			);
		});

		const res = await app.request(
			"/api/properties/search?query=Oak%20Street",
			{ method: "GET" },
			TEST_ENV,
		);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { query: { explanation: string } };
		expect(body.query.explanation).toContain('Keyword search for "Oak Street"');
		expect(capturedWhere).toMatchObject({
			year: 2025,
			id: { in: ["prop-1"] },
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
