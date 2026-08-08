import { describe, expect, it } from "vitest";
import {
	formatDateCompact,
	formatDateSortable,
	parseEpochOrIso,
} from "../epoch-format";

const EPOCH_MS = "1700000000000"; // 2023-11-14T22:13:20.000Z

describe("parseEpochOrIso", () => {
	it("parses an epoch-ms string", () => {
		expect(parseEpochOrIso(EPOCH_MS)?.toISOString()).toBe(
			"2023-11-14T22:13:20.000Z",
		);
	});

	it("parses an ISO 8601 string", () => {
		expect(parseEpochOrIso("2023-11-14T22:13:20.000Z")?.toISOString()).toBe(
			"2023-11-14T22:13:20.000Z",
		);
	});

	it('returns null for null, undefined, and "0"', () => {
		expect(parseEpochOrIso(null)).toBeNull();
		expect(parseEpochOrIso(undefined)).toBeNull();
		expect(parseEpochOrIso("0")).toBeNull();
	});

	it("returns null for an unparseable string", () => {
		expect(parseEpochOrIso("not a date")).toBeNull();
	});
});

describe("formatDateSortable", () => {
	it('formats as "YYYY-MM-DD HH:MM:SS"', () => {
		expect(formatDateSortable(EPOCH_MS)).toBe("2023-11-14 22:13:20");
	});

	it("accepts an already-ISO string the same way", () => {
		expect(formatDateSortable("2023-11-14T22:13:20.000Z")).toBe(
			"2023-11-14 22:13:20",
		);
	});

	it('falls back to N/A for null/"0"', () => {
		expect(formatDateSortable(null)).toBe("N/A");
		expect(formatDateSortable("0")).toBe("N/A");
	});
});

describe("formatDateCompact", () => {
	it('formats as "Mon DD, HH:MM AM/PM" in the local timezone', () => {
		// Exact clock time depends on the machine's timezone; assert the shape.
		expect(formatDateCompact(EPOCH_MS)).toMatch(
			/^Nov 14, \d{2}:\d{2} (AM|PM)$/,
		);
	});

	it('falls back to N/A for null/"0"', () => {
		expect(formatDateCompact(null)).toBe("N/A");
		expect(formatDateCompact("0")).toBe("N/A");
	});
});
