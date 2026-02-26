import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock logger before importing module under test
vi.mock("../logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  fetchTCADProperties,
  mapTCADResultToPropertyData,
  type TCADPropertyResult,
} from "../tcad-api-client";

// ── Helpers ────────────────────────────────────────────────────────────

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.test-token-long-enough-to-be-valid-placeholder";
const YEAR = 2026;

function jsonResponse(body: unknown, status = 200): Response {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function apiBody(totalCount: number, results: TCADPropertyResult[]) {
  return {
    totalProperty: { propertyCount: totalCount },
    results,
  };
}

function makeResults(count: number, startPid = 1): TCADPropertyResult[] {
  return Array.from({ length: count }, (_, i) => ({
    pid: startPid + i,
    displayName: `Owner ${startPid + i}`,
    propType: "R",
    city: "Austin",
    streetPrimary: `${startPid + i} Main St`,
    assessedValue: 100000 + i,
    appraisedValue: 120000 + i,
    geoID: `GEO-${startPid + i}`,
    legalDescription: `Lot ${startPid + i}`,
  }));
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("tcad-api-client", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Helper: advance all pending timers while the promise settles
  async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
    let result: T | undefined;
    let error: unknown;
    let settled = false;

    promise
      .then((v) => { result = v; settled = true; })
      .catch((e) => { error = e; settled = true; });

    // Advance timers in a loop until the promise settles
    while (!settled) {
      await vi.advanceTimersByTimeAsync(1000);
    }

    if (error) throw error;
    return result as T;
  }

  describe("fetchTCADProperties", () => {
    it("returns single-page results when count fits in one page", async () => {
      const results = makeResults(3);
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(3, results)));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "test search", YEAR));

      expect(res.totalCount).toBe(3);
      expect(res.results).toHaveLength(3);
      expect(res.pageSize).toBe(1000);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("paginates when totalCount > first page results", async () => {
      // Page 1 returns exactly pageSize (1000) results → triggers pagination
      const page1 = makeResults(1000, 1);
      const page2 = makeResults(50, 1001);

      fetchSpy
        .mockResolvedValueOnce(jsonResponse(apiBody(1050, page1)))
        .mockResolvedValueOnce(jsonResponse(apiBody(1050, page2)));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR));

      expect(res.totalCount).toBe(1050);
      expect(res.results).toHaveLength(1050);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("falls back to smaller page size on TRUNCATED response", async () => {
      // First size (1000) returns truncated response
      fetchSpy.mockResolvedValueOnce(
        new Response('{"totalProperty":{"propertyCount":5},"results":[{"pid":1', {
          status: 200,
        }),
      );

      // Second size (500) succeeds
      const results = makeResults(5);
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(5, results)));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR));

      expect(res.totalCount).toBe(5);
      expect(res.results).toHaveLength(5);
      expect(res.pageSize).toBe(500);
    });

    it("throws TOKEN_EXPIRED on 401", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

      await expect(
        runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR)),
      ).rejects.toThrow("TOKEN_EXPIRED");
    });

    it("retries with smaller page size on 409 rate limit", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("Too Many Requests", { status: 409 }));

      const results = makeResults(2);
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(2, results)));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR));

      expect(res.totalCount).toBe(2);
      expect(res.pageSize).toBe(500);
    });

    it("retries with smaller page size on 504 gateway timeout", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("Gateway Timeout", { status: 504 }));

      const results = makeResults(1);
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(1, results)));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR));

      expect(res.totalCount).toBe(1);
      expect(res.pageSize).toBe(500);
    });

    it("throws when all page sizes are exhausted", async () => {
      for (let i = 0; i < 4; i++) {
        fetchSpy.mockResolvedValueOnce(
          new Response('{"truncated', { status: 200 }),
        );
      }

      await expect(
        runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR)),
      ).rejects.toThrow("All page sizes failed");
    });

    it("returns empty results when API returns zero properties", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(0, [])));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR));

      expect(res.totalCount).toBe(0);
      expect(res.results).toHaveLength(0);
    });

    it("stops paginating when results < pageSize (partial last page)", async () => {
      // Page 1 returns fewer results than pageSize → no more pages
      const results = makeResults(5);
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(5, results)));

      const res = await runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR));

      expect(res.totalCount).toBe(5);
      expect(res.results).toHaveLength(5);
      // Only 1 fetch call, no attempt to paginate
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("throws on unexpected HTTP error", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("Server Error", { status: 500 }));

      await expect(
        runWithTimers(fetchTCADProperties(TOKEN, "search", YEAR)),
      ).rejects.toThrow("HTTP 500");
    });

    it("sends correct request body with year and search term", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse(apiBody(0, [])));

      await runWithTimers(fetchTCADProperties(TOKEN, "Smith Trust", 2025));

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("page=1&pageSize=1000"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: TOKEN,
          }),
          body: JSON.stringify({
            pYear: { operator: "=", value: "2025" },
            fullTextSearch: { operator: "match", value: "Smith Trust" },
          }),
        }),
      );
    });
  });

  describe("mapTCADResultToPropertyData", () => {
    it("maps all fields correctly", () => {
      const input: TCADPropertyResult = {
        pid: 12345,
        displayName: "John Doe",
        propType: "R",
        city: "Austin",
        streetPrimary: "123 Main St",
        assessedValue: 200000,
        appraisedValue: 250000,
        geoID: "GEO-123",
        legalDescription: "Lot 5 Block A",
      };

      const result = mapTCADResultToPropertyData(input);

      expect(result).toEqual({
        propertyId: "12345",
        name: "John Doe",
        propType: "R",
        city: "Austin",
        propertyAddress: "123 Main St",
        assessedValue: 200000,
        appraisedValue: 250000,
        geoId: "GEO-123",
        description: "Lot 5 Block A",
      });
    });

    it("handles missing/undefined fields with defaults", () => {
      const input: TCADPropertyResult = {};

      const result = mapTCADResultToPropertyData(input);

      expect(result).toEqual({
        propertyId: "",
        name: "",
        propType: "",
        city: null,
        propertyAddress: "",
        assessedValue: 0,
        appraisedValue: 0,
        geoId: null,
        description: null,
      });
    });

    it("parses string numeric values", () => {
      const input: TCADPropertyResult = {
        assessedValue: "150000",
        appraisedValue: "175000",
      };

      const result = mapTCADResultToPropertyData(input);

      expect(result.assessedValue).toBe(150000);
      expect(result.appraisedValue).toBe(175000);
    });
  });
});
