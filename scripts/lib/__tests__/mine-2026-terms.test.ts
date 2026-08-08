import { beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_TERM_LENGTH } from "../../../utils/constants";

const mockQueryRawUnsafe = vi.fn();

vi.mock("../d1-prisma", () => ({
	prisma: {
		$queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
	},
	epochAgo: (ms: number) => String(Date.now() - ms),
}));

import {
	mineDescriptionFirstWords,
	mineEntityPhrases,
	mineOwnerFirstWords,
	mineStreetNames,
	mineTwoWordOwnerNames,
} from "../mine-2026-terms";

/** The SQL passed to D1, collapsed to single spaces for stable assertions. */
function executedSql(): string {
	const [sql] = mockQueryRawUnsafe.mock.calls[0] as [string];
	return sql.replace(/\s+/g, " ");
}

beforeEach(() => {
	vi.clearAllMocks();
	mockQueryRawUnsafe.mockResolvedValue([]);
});

describe("mine-2026-terms result mapping", () => {
	it("maps rows to term/count and converts bigint counts to numbers", async () => {
		mockQueryRawUnsafe.mockResolvedValue([
			{ term: "NGUYEN", cnt: BigInt(42) },
			{ term: "MARTINEZ", cnt: 17 },
		]);

		const result = await mineOwnerFirstWords({ minCount: 5 });

		expect(result).toEqual([
			{ term: "NGUYEN", count: 42 },
			{ term: "MARTINEZ", count: 17 },
		]);
	});
});

describe("mine-2026-terms query construction", () => {
	it("every miner scopes to 2026-only properties", async () => {
		const miners = [
			() => mineOwnerFirstWords({ minCount: 5 }),
			() => mineStreetNames({ minCount: 5 }),
			() => mineDescriptionFirstWords({ minCount: 5 }),
			() => mineTwoWordOwnerNames({ minCount: 5 }),
			() => mineEntityPhrases({ minCount: 5 }),
		];

		for (const mine of miners) {
			mockQueryRawUnsafe.mockClear();
			await mine();
			expect(executedSql()).toContain(
				"WHERE year = 2026 AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)",
			);
		}
	});

	it("applies minCount as the HAVING threshold", async () => {
		await mineOwnerFirstWords({ minCount: 7 });

		expect(executedSql()).toContain("HAVING COUNT(DISTINCT property_id) >= 7");
	});

	it("adds the letter GLOB filter only when alphaOnly is set", async () => {
		await mineOwnerFirstWords({ minCount: 5, alphaOnly: true });
		expect(executedSql()).toContain("GLOB '[A-Za-z]*'");

		mockQueryRawUnsafe.mockClear();
		await mineOwnerFirstWords({ minCount: 5 });
		expect(executedSql()).not.toContain("GLOB");
	});

	it("mineTwoWordOwnerNames requires word lengths (w1 >= MIN_TERM_LENGTH, w2 >= 2)", async () => {
		await mineTwoWordOwnerNames({ minCount: 5 });

		expect(executedSql()).toContain(
			`LENGTH(w1) >= ${MIN_TERM_LENGTH} AND LENGTH(w2) >= 2`,
		);
	});

	it("mineEntityPhrases filters to entity names and skips word-length filters", async () => {
		await mineEntityPhrases({ minCount: 10 });

		const sql = executedSql();
		expect(sql).toContain("name LIKE '%LLC%'");
		expect(sql).toContain("name LIKE '%TRUST%'");
		expect(sql).not.toContain("LENGTH(w1)");
	});
});
