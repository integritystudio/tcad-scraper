import { describe, expect, it } from "vitest";
import { BATCH_CONFIGS, getAvailableBatchTypes } from "../batch-configs";

describe("batch-configs", () => {
	it("should have no duplicate terms across batches", () => {
		const seen = new Map<string, string>();
		const duplicates: string[] = [];

		for (const [batchType, config] of Object.entries(BATCH_CONFIGS)) {
			for (const term of config.terms) {
				const existing = seen.get(term);
				if (existing) {
					duplicates.push(`"${term}" in both "${existing}" and "${batchType}"`);
				} else {
					seen.set(term, batchType);
				}
			}
		}

		expect(duplicates, `Duplicate terms found:\n${duplicates.join("\n")}`).toHaveLength(0);
	});

	it("should have no duplicate terms within a single batch", () => {
		const duplicates: string[] = [];

		for (const [batchType, config] of Object.entries(BATCH_CONFIGS)) {
			const seen = new Set<string>();
			for (const term of config.terms) {
				if (seen.has(term)) {
					duplicates.push(`"${term}" duplicated in "${batchType}"`);
				}
				seen.add(term);
			}
		}

		expect(duplicates, `Intra-batch duplicates:\n${duplicates.join("\n")}`).toHaveLength(0);
	});

	it("should have no empty terms", () => {
		for (const [batchType, config] of Object.entries(BATCH_CONFIGS)) {
			for (const term of config.terms) {
				expect(term.trim(), `Empty term in "${batchType}"`).not.toBe("");
			}
		}
	});

	it("should have no terms with leading or trailing whitespace", () => {
		for (const [batchType, config] of Object.entries(BATCH_CONFIGS)) {
			for (const term of config.terms) {
				expect(term, `Whitespace in term "${term}" in "${batchType}"`).toBe(term.trim());
			}
		}
	});

	it("should have at least one term per batch", () => {
		for (const [batchType, config] of Object.entries(BATCH_CONFIGS)) {
			expect(config.terms.length, `No terms in "${batchType}"`).toBeGreaterThan(0);
		}
	});

	it("should return all batch types from getAvailableBatchTypes", () => {
		const types = getAvailableBatchTypes();
		expect(types).toEqual(Object.keys(BATCH_CONFIGS));
		expect(types.length).toBeGreaterThan(0);
	});
});
