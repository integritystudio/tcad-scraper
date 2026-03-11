import { describe, it, expect, vi, beforeEach } from "vitest";
import { MIN_TERM_LENGTH } from "../../../utils/constants";

const mockQueryRaw = vi.fn();

vi.mock("../../../server/src/lib/prisma", () => ({
  prisma: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
}));

import { get2025Count, isSupersetOfSuccessful } from "../backfill-utils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("get2025Count", () => {
  it("returns the count from the query result", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 12345 }]);
    const result = await get2025Count();
    expect(result).toBe(12345);
  });

  it("returns 0 when no properties exist", async () => {
    mockQueryRaw.mockResolvedValue([{ count: 0 }]);
    const result = await get2025Count();
    expect(result).toBe(0);
  });
});

describe("isSupersetOfSuccessful", () => {
  // Test terms are crafted relative to MIN_TERM_LENGTH (4):
  // - "john" (length = MIN_TERM_LENGTH) → exact match, not a superset
  // - "johnson" (length > MIN_TERM_LENGTH, starts with "john") → superset
  // - "joe" (length < MIN_TERM_LENGTH) → too short to check
  const successful = new Set(["john", "smith", "jane"]);

  it("returns true when a shorter prefix is in the successful set", () => {
    expect(isSupersetOfSuccessful("johnson", successful)).toBe(true);
  });

  it("returns true for longer extensions of successful terms", () => {
    expect(isSupersetOfSuccessful("smithfield", successful)).toBe(true);
  });

  it("returns false when no prefix matches", () => {
    expect(isSupersetOfSuccessful("williams", successful)).toBe(false);
  });

  it("returns false when the term equals a successful term (not longer)", () => {
    // "john" has length = MIN_TERM_LENGTH, loop runs for len < MIN_TERM_LENGTH → no iterations
    expect(isSupersetOfSuccessful("john", successful)).toBe(false);
    expect("john".length).toBe(MIN_TERM_LENGTH);
  });

  it("returns false for terms shorter than MIN_TERM_LENGTH", () => {
    expect(isSupersetOfSuccessful("joe", successful)).toBe(false);
    expect("joe".length).toBeLessThan(MIN_TERM_LENGTH);
  });

  it("returns false for an empty successful set", () => {
    expect(isSupersetOfSuccessful("johnson", new Set())).toBe(false);
  });

  it("checks all prefix lengths from MIN_TERM_LENGTH up to term length - 1", () => {
    // "janes" (length = MIN_TERM_LENGTH + 1) should match "jane" at length MIN_TERM_LENGTH
    expect(isSupersetOfSuccessful("janes", successful)).toBe(true);
    expect("janes".length).toBe(MIN_TERM_LENGTH + 1);
  });

  it("handles (MIN_TERM_LENGTH+1)-char terms with a MIN_TERM_LENGTH-char prefix", () => {
    const s = new Set(["test"]);
    expect("test".length).toBe(MIN_TERM_LENGTH);
    expect(isSupersetOfSuccessful("testi", s)).toBe(true);
    expect(isSupersetOfSuccessful("tests", s)).toBe(true);
    expect(isSupersetOfSuccessful("toast", s)).toBe(false);
  });
});
