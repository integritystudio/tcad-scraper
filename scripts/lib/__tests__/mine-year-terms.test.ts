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
} from "../mine-year-terms";

const YEARS = { sourceYear: 2025, targetYear: 2026 };

/** The SQL passed to D1, collapsed to single spaces for stable assertions. */
function executedSql(): string {
	const [sql] = mockQueryRawUnsafe.mock.calls[0] as [string];
	return sql.replace(/\s+/g, " ");
}

beforeEach(() => {
	vi.clearAllMocks();
	mockQueryRawUnsafe.mockResolvedValue([]);
});

describe("mine-year-terms result mapping", () => {
	it("maps rows to term/count and converts bigint counts to numbers", async () => {
		mockQueryRawUnsafe.mockResolvedValue([
			{ term: "NGUYEN", cnt: BigInt(42) },
			{ term: "MARTINEZ", cnt: 17 },
		]);

		const result = await mineOwnerFirstWords({ ...YEARS, minCount: 5 });

		expect(result).toEqual([
			{ term: "NGUYEN", count: 42 },
			{ term: "MARTINEZ", count: 17 },
		]);
	});
});

describe("mine-year-terms query construction", () => {
	const miners = [
		mineOwnerFirstWords,
		mineStreetNames,
		mineDescriptionFirstWords,
		mineTwoWordOwnerNames,
		mineEntityPhrases,
	];

	it("every miner scopes to the source-year/target-year gap", async () => {
		for (const mine of miners) {
			mockQueryRawUnsafe.mockClear();
			await mine({ ...YEARS, minCount: 5 });
			expect(executedSql()).toContain(
				"WHERE year = 2025 AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2026)",
			);
		}
	});

	it("mines the reverse direction when the years are swapped", async () => {
		await mineOwnerFirstWords({
			sourceYear: 2026,
			targetYear: 2025,
			minCount: 5,
		});

		expect(executedSql()).toContain(
			"WHERE year = 2026 AND property_id NOT IN (SELECT property_id FROM properties WHERE year = 2025)",
		);
	});

	it("rejects a gap of a year against itself", async () => {
		for (const mine of miners) {
			await expect(
				mine({ sourceYear: 2025, targetYear: 2025, minCount: 5 }),
			).rejects.toThrow(RangeError);
		}
	});

	it("rejects non-integer years rather than interpolating them into SQL", async () => {
		await expect(
			mineOwnerFirstWords({
				sourceYear: 2025.5,
				targetYear: 2026,
				minCount: 5,
			}),
		).rejects.toThrow(TypeError);
		expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
	});

	it("applies minCount as the HAVING threshold", async () => {
		await mineOwnerFirstWords({ ...YEARS, minCount: 7 });

		expect(executedSql()).toContain("HAVING COUNT(DISTINCT property_id) >= 7");
	});

	it("adds the all-digits filter only when excludeAllNumeric is set", async () => {
		await mineOwnerFirstWords({
			...YEARS,
			minCount: 5,
			excludeAllNumeric: true,
		});
		// "contains at least one non-digit" — keeps 7-ELEVEN, drops 1905.
		expect(executedSql()).toContain("term GLOB '*[^0-9]*'");

		mockQueryRawUnsafe.mockClear();
		await mineOwnerFirstWords({ ...YEARS, minCount: 5 });
		expect(executedSql()).not.toContain("[^0-9]");
	});

	it("keeps excludeAllNumeric distinct from alphaOnly rather than collapsing them", async () => {
		// alphaOnly requires a *leading* letter and so would also discard
		// "7-ELEVEN", which searches fine. Only all-digit terms are unusable.
		await mineOwnerFirstWords({ ...YEARS, minCount: 5, alphaOnly: true });
		const alphaSql = executedSql();
		expect(alphaSql).toContain("GLOB '[A-Za-z]*'");
		expect(alphaSql).not.toContain("[^0-9]");
	});

	it("applies both filters together when both are set", async () => {
		await mineOwnerFirstWords({
			...YEARS,
			minCount: 5,
			alphaOnly: true,
			excludeAllNumeric: true,
		});

		const sql = executedSql();
		expect(sql).toContain("GLOB '[A-Za-z]*'");
		expect(sql).toContain("GLOB '*[^0-9]*'");
	});

	it("scopes the filters to w1 for two-word owner names", async () => {
		await mineTwoWordOwnerNames({
			...YEARS,
			minCount: 5,
			excludeAllNumeric: true,
		});

		expect(executedSql()).toContain("w1 GLOB '*[^0-9]*'");
	});

	it("adds the letter GLOB filter only when alphaOnly is set", async () => {
		await mineOwnerFirstWords({ ...YEARS, minCount: 5, alphaOnly: true });
		expect(executedSql()).toContain("GLOB '[A-Za-z]*'");

		mockQueryRawUnsafe.mockClear();
		await mineOwnerFirstWords({ ...YEARS, minCount: 5 });
		expect(executedSql()).not.toContain("GLOB");
	});

	it("mineTwoWordOwnerNames requires word lengths (w1 >= MIN_TERM_LENGTH, w2 >= 2)", async () => {
		await mineTwoWordOwnerNames({ ...YEARS, minCount: 5 });

		expect(executedSql()).toContain(
			`LENGTH(w1) >= ${MIN_TERM_LENGTH} AND LENGTH(w2) >= 2`,
		);
	});

	it("mineEntityPhrases filters to entity names and skips word-length filters", async () => {
		await mineEntityPhrases({ ...YEARS, minCount: 10 });

		const sql = executedSql();
		expect(sql).toContain("name LIKE '%LLC%'");
		expect(sql).toContain("name LIKE '%TRUST%'");
		expect(sql).not.toContain("LENGTH(w1)");
	});
});
