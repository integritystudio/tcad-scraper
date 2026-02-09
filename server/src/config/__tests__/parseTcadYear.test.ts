import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/logger", () => ({
	default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn() },
}));

// dotenv.config() is called at module top-level; stub it to avoid side effects
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

describe("parseTcadYear", () => {
	let parseTcadYear: typeof import("../index").parseTcadYear;
	let logger: { warn: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		vi.resetModules();
		const mod = await import("../index");
		parseTcadYear = mod.parseTcadYear;
		const loggerMod = await import("../../lib/logger");
		logger = loggerMod.default as unknown as typeof logger;
		vi.clearAllMocks();
	});

	afterEach(() => {
		delete process.env.TCAD_YEAR;
	});

	it("should return default when env var is not set", () => {
		delete process.env.TCAD_YEAR;
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2026);
	});

	it("should parse valid env var override", () => {
		process.env.TCAD_YEAR = "2024";
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2024);
	});

	it("should reject year below 2020 and return default", () => {
		process.env.TCAD_YEAR = "2019";
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2026);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({ envKey: "TCAD_YEAR", value: 2019 }),
			expect.stringContaining("out of range"),
		);
	});

	it("should reject year above currentYear+1 and return default", () => {
		const farFuture = new Date().getFullYear() + 5;
		process.env.TCAD_YEAR = String(farFuture);
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2026);
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({ envKey: "TCAD_YEAR", value: farFuture }),
			expect.stringContaining("out of range"),
		);
	});

	it("should accept currentYear+1 (next-year boundary)", () => {
		const nextYear = new Date().getFullYear() + 1;
		process.env.TCAD_YEAR = String(nextYear);
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(nextYear);
	});

	it("should accept 2020 (lower boundary)", () => {
		process.env.TCAD_YEAR = "2020";
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2020);
	});

	it("should return default for non-numeric value", () => {
		process.env.TCAD_YEAR = "abc";
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2026);
	});

	it("should return default for empty string", () => {
		process.env.TCAD_YEAR = "";
		expect(parseTcadYear("TCAD_YEAR", 2026)).toBe(2026);
	});
});
