import { describe, expect, it } from "vitest";
import {
	formatCurrency,
	formatDate,
	formatNumber,
	formatPropertyType,
	truncateText,
} from "../formatters";

describe("formatCurrency", () => {
	describe("valid numbers", () => {
		it("should format positive numbers correctly", () => {
			expect(formatCurrency(1000)).toBe("$1,000");
			expect(formatCurrency(1234567)).toBe("$1,234,567");
			expect(formatCurrency(999)).toBe("$999");
		});

		it("should format zero correctly", () => {
			expect(formatCurrency(0)).toBe("$0");
		});

		it("should format negative numbers correctly", () => {
			expect(formatCurrency(-1000)).toBe("-$1,000");
			expect(formatCurrency(-500)).toBe("-$500");
		});

		it("should format decimal numbers and round to whole dollars", () => {
			expect(formatCurrency(1234.56)).toBe("$1,235");
			expect(formatCurrency(999.99)).toBe("$1,000");
			expect(formatCurrency(100.49)).toBe("$100");
		});

		it("should format very large numbers", () => {
			expect(formatCurrency(1000000000)).toBe("$1,000,000,000");
			expect(formatCurrency(3900000000)).toBe("$3,900,000,000");
		});

		it("should format very small numbers", () => {
			expect(formatCurrency(0.01)).toBe("$0");
			expect(formatCurrency(0.99)).toBe("$1");
		});
	});

	describe("edge cases that could cause $NaN", () => {
		it("should handle null values gracefully", () => {
			expect(formatCurrency(null)).toBe("-");
		});

		it("should handle undefined values gracefully", () => {
			expect(formatCurrency(undefined)).toBe("-");
		});

		it("should handle NaN values gracefully", () => {
			expect(formatCurrency(NaN)).toBe("-");
		});

		it("should handle Infinity gracefully", () => {
			expect(formatCurrency(Infinity)).toBe("-");
			expect(formatCurrency(-Infinity)).toBe("-");
		});

		it("should handle division by zero results", () => {
			const result = 10 / 0;
			expect(formatCurrency(result)).toBe("-");
		});

		it("should handle calculation that produces NaN", () => {
			const result = Math.sqrt(-1);
			expect(formatCurrency(result)).toBe("-");
		});

		it("should handle string to number conversion failures", () => {
			const invalidNumber = Number("not a number");
			expect(formatCurrency(invalidNumber)).toBe("-");
		});
	});

	describe("type safety", () => {
		it("should accept number type", () => {
			const value: number = 1000;
			expect(formatCurrency(value)).toBe("$1,000");
		});

		it("should accept null type", () => {
			const value: null = null;
			expect(formatCurrency(value)).toBe("-");
		});

		it("should accept undefined type", () => {
			const value: undefined = undefined;
			expect(formatCurrency(value)).toBe("-");
		});

		it("should handle optional number (number | undefined)", () => {
			const value: number | undefined = undefined;
			expect(formatCurrency(value)).toBe("-");
		});

		it("should handle nullable number (number | null)", () => {
			const value: number | null = null;
			expect(formatCurrency(value)).toBe("-");
		});
	});
});

describe("formatNumber", () => {
	it("should format numbers with thousands separators", () => {
		expect(formatNumber(1000)).toBe("1,000");
		expect(formatNumber(1234567)).toBe("1,234,567");
	});

	it("should format zero", () => {
		expect(formatNumber(0)).toBe("0");
	});

	it("should preserve decimals", () => {
		expect(formatNumber(1234.56)).toBe("1,234.56");
	});

	it("should handle null values gracefully", () => {
		expect(formatNumber(null)).toBe("-");
	});

	it("should handle undefined values gracefully", () => {
		expect(formatNumber(undefined)).toBe("-");
	});

	it("should handle NaN values gracefully", () => {
		expect(formatNumber(NaN)).toBe("-");
	});

	it("should handle Infinity gracefully", () => {
		expect(formatNumber(Infinity)).toBe("-");
	});
});

describe("formatDate", () => {
	it("should format ISO date strings", () => {
		const result = formatDate("2024-01-15T10:30:00Z");
		expect(result).toMatch(/Jan 15, 2024/);
	});

	it("should include time in formatted output", () => {
		const result = formatDate("2024-01-15T10:30:00Z");
		expect(result).toMatch(/\d{2}:\d{2}/); // Should contain time like "10:30"
	});

	it("should handle invalid date strings gracefully", () => {
		expect(formatDate("not-a-date")).toBe("-");
	});

	it("should handle empty string gracefully", () => {
		expect(formatDate("")).toBe("-");
	});
});

describe("formatPropertyType", () => {
	it("should format single word types", () => {
		expect(formatPropertyType("RESIDENTIAL")).toBe("Residential");
	});

	it("should format multi-word types with underscores", () => {
		expect(formatPropertyType("COMMERCIAL_RETAIL")).toBe("Commercial Retail");
	});

	it("should handle empty strings", () => {
		expect(formatPropertyType("")).toBe("Unknown");
	});

	it("should handle mixed case", () => {
		expect(formatPropertyType("rEsIdEnTiAl")).toBe("Residential");
	});
});

describe("truncateText", () => {
	it("should not truncate text shorter than maxLength", () => {
		expect(truncateText("Hello", 10)).toBe("Hello");
	});

	it("should truncate text longer than maxLength", () => {
		expect(truncateText("Hello World", 8)).toBe("Hello...");
	});

	it("should handle exact length match", () => {
		expect(truncateText("Hello", 5)).toBe("Hello");
	});

	it("should handle empty strings", () => {
		expect(truncateText("", 10)).toBe("");
	});
});
