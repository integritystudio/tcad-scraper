import { describe, it, expect, vi, beforeEach } from "vitest";

const mockScrapeJobCount = vi.fn();
const mockPropertyCount = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock("../../lib/prisma", () => ({
  prisma: {
    scrapeJob: {
      count: (...args: unknown[]) => mockScrapeJobCount(...args),
    },
    property: {
      count: (...args: unknown[]) => mockPropertyCount(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { analyzeSearchTerms } from "../analyze-search-terms";

/** Configure standard mock responses for one full analyzeSearchTerms() run. */
function setupDefaultMocks(overrides: { propertyCount?: number } = {}) {
  vi.clearAllMocks();

  // scrapeJob.count called 4 times: total, completed, failed, pending
  mockScrapeJobCount
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);

  mockPropertyCount.mockResolvedValue(overrides.propertyCount ?? 450_000);

  // $queryRaw called in order:
  // 1. COUNT(DISTINCT search_term) from scrape_jobs — unique terms
  // 2. top 20 terms query → []
  // 3. always-failing terms → []
  // 4. recent terms (last 30 days) → []
  // 5-9. countTermsMatching (5 categories) → [{count: 0n}] each
  mockQueryRaw
    .mockResolvedValueOnce([{ count: BigInt(42) }]) // unique terms
    .mockResolvedValueOnce([])                       // topTerms
    .mockResolvedValueOnce([])                       // failingTerms
    .mockResolvedValueOnce([])                       // recentTerms
    .mockResolvedValue([{ count: BigInt(0) }]);      // countTermsMatching (5 calls)
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("analyzeSearchTerms — staleness guard", () => {
  it("fires console.warn when propertyCount exceeds TCAD_TOTAL_PROPERTIES", async () => {
    setupDefaultMocks({ propertyCount: 460_000 });

    await analyzeSearchTerms();

    const warnSpy = vi.mocked(console.warn);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("constant may be stale"),
    );
  });

  it("does NOT fire console.warn when propertyCount is below threshold", async () => {
    setupDefaultMocks({ propertyCount: 400_000 });

    await analyzeSearchTerms();

    expect(vi.mocked(console.warn)).not.toHaveBeenCalled();
  });

  it("clamps Remaining to 0 when DB count exceeds TCAD_TOTAL_PROPERTIES", async () => {
    setupDefaultMocks({ propertyCount: 500_000 });

    await analyzeSearchTerms();

    const allOutput = vi.mocked(console.log).mock.calls
      .map(c => c[0] as string)
      .join("\n");
    expect(allOutput).toContain("Remaining: 0");
    expect(allOutput).not.toMatch(/Remaining: -/);
  });
});

describe("analyzeSearchTerms — division by zero when totalJobs === 0", () => {
  it("does not throw when totalJobs is 0", async () => {
    setupDefaultMocks();
    // Override: all job counts = 0
    mockScrapeJobCount.mockReset().mockResolvedValue(0);

    await expect(analyzeSearchTerms()).resolves.toBeUndefined();
  });

  it("outputs NaN% when totalJobs is 0 (documents pre-existing gap)", async () => {
    setupDefaultMocks();
    mockScrapeJobCount.mockReset().mockResolvedValue(0);

    await analyzeSearchTerms();

    const allOutput = vi.mocked(console.log).mock.calls
      .map(c => c[0] as string)
      .join("\n");
    expect(allOutput).toContain("NaN%");
  });
});
