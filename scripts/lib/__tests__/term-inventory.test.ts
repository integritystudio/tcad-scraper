import { describe, expect, it } from "vitest";
import { buildTermInventory, sortInsensitive } from "../term-inventory";

describe("buildTermInventory", () => {
	it("buckets each term under its source, sorted case-insensitively", () => {
		const { sources } = buildTermInventory({
			a: ["Smith", "Adams"],
			b: ["Johnson"],
		});

		expect(sources.a).toEqual(["Adams", "Smith"]);
		expect(sources.b).toEqual(["Johnson"]);
	});

	it("drops numeric-only terms from every source", () => {
		const { all, sources } = buildTermInventory({
			a: ["Smith", "12345"],
		});

		expect(all).not.toContain("12345");
		expect(sources.a).not.toContain("12345");
	});

	it("gives the first source (by iteration order) the term, case-insensitively", () => {
		const { sources, duplicated } = buildTermInventory({
			first: ["Trust"],
			second: ["trust"],
		});

		expect(sources.first).toContain("Trust");
		expect(sources.second).not.toContain("trust");
		expect(duplicated).toEqual(["trust [second ∩ first]"]);
	});

	it("does not flag terms that appear in exactly one source", () => {
		const { duplicated } = buildTermInventory({
			a: ["Smith"],
			b: ["Johnson"],
		});

		expect(duplicated).toHaveLength(0);
	});

	it("returns all accepted terms flattened and sorted", () => {
		const { all } = buildTermInventory({
			a: ["Smith", "adams"],
			b: ["Johnson"],
		});

		expect(all).toEqual(["adams", "Johnson", "Smith"]);
	});
});

describe("sortInsensitive", () => {
	it("orders case-insensitively", () => {
		expect(["banana", "Apple", "cherry"].sort(sortInsensitive)).toEqual([
			"Apple",
			"banana",
			"cherry",
		]);
	});
});
