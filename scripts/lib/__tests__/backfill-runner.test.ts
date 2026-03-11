import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnqueueBatch = vi.fn();
const mockWaitForQueueDrain = vi.fn();
const mockGet2025Count = vi.fn();
const mockDisconnect = vi.fn();
const mockClose = vi.fn();

let mockTcadYear = 2025;

vi.mock("../../../server/src/lib/prisma", () => ({
  prisma: { $disconnect: () => mockDisconnect() },
}));

vi.mock("../../../server/src/queues/scraper.queue", () => ({
  scraperQueue: { close: () => mockClose() },
}));

vi.mock("../../../server/src/config", () => ({
  config: { scraper: { get tcadYear() { return mockTcadYear; } } },
}));

vi.mock("../../../server/src/utils/error-helpers", () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

// vi.mock factories are hoisted — must use literals, not const references
vi.mock("../queue-utils", () => ({
  enqueueBatch: (...args: unknown[]) => mockEnqueueBatch(...args),
  waitForQueueDrain: () => mockWaitForQueueDrain(),
  BATCH_SIZE: 3,
}));

vi.mock("../backfill-utils", () => ({
  get2025Count: () => mockGet2025Count(),
}));

vi.mock("../../../utils/constants", () => ({
  TARGET_2025_PROPERTY_COUNT: 100,
}));

import { runBackfill, DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES, type BackfillConfig } from "../backfill-runner";

// ── Test constants (match mocked values above) ──────────────────────
const TEST_TARGET_COUNT = 100;
const TEST_BATCH_SIZE = 3;
const BACKFILL_YEAR = 2025;
const WRONG_YEAR = 2026;
const BELOW_TARGET = 50;
const ENQUEUE_RETURN_COUNT = 3;

beforeEach(() => {
  vi.clearAllMocks();
  mockTcadYear = BACKFILL_YEAR;
  mockEnqueueBatch.mockResolvedValue(ENQUEUE_RETURN_COUNT);
  mockWaitForQueueDrain.mockResolvedValue(undefined);
});

function makeCfg(overrides: Partial<BackfillConfig> = {}): BackfillConfig {
  return {
    getTerms: async () => ["alpha", "bravo", "charlie", "delta", "echo"],
    userId: "test-backfill",
    label: "Test",
    ...overrides,
  };
}

describe("runBackfill", () => {
  it("exits early when already at target", async () => {
    mockGet2025Count.mockResolvedValue(TEST_TARGET_COUNT);

    await runBackfill(makeCfg());

    expect(mockEnqueueBatch).not.toHaveBeenCalled();
  });

  it("exits early when getTerms returns empty array", async () => {
    mockGet2025Count.mockResolvedValue(BELOW_TARGET);

    await runBackfill(makeCfg({ getTerms: async () => [] }));

    expect(mockEnqueueBatch).not.toHaveBeenCalled();
  });

  it("processes batches and stops when target reached mid-loop", async () => {
    const midProgress = 65;
    mockGet2025Count
      .mockResolvedValueOnce(BELOW_TARGET)      // initial header
      .mockResolvedValueOnce(BELOW_TARGET)      // batch 1 pre-check
      .mockResolvedValueOnce(midProgress)        // batch 1 post-drain
      .mockResolvedValueOnce(TEST_TARGET_COUNT)  // batch 2 pre-check → target reached
      .mockResolvedValueOnce(TEST_TARGET_COUNT); // final count

    await runBackfill(makeCfg());

    expect(mockEnqueueBatch).toHaveBeenCalledTimes(1);
    expect(mockEnqueueBatch).toHaveBeenCalledWith(
      ["alpha", "bravo", "charlie"],
      "test-backfill",
    );
    expect(mockWaitForQueueDrain).toHaveBeenCalledTimes(1);
  });

  it("processes all batches when zero-result but not enough to trigger stop", async () => {
    // 5 terms / TEST_BATCH_SIZE=3 → 2 batches, DEFAULT_MAX=3 → never triggered
    mockGet2025Count.mockResolvedValue(BELOW_TARGET);

    await runBackfill(makeCfg());

    expect(mockEnqueueBatch).toHaveBeenCalledTimes(2);
  });

  it("stops after custom maxConsecutiveZeroBatches", async () => {
    // 10 terms / TEST_BATCH_SIZE=3 → up to 4 batches, maxZero=1 → stop after first
    mockGet2025Count.mockResolvedValue(BELOW_TARGET);
    const manyTerms = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

    await runBackfill(makeCfg({
      getTerms: async () => manyTerms,
      maxConsecutiveZeroBatches: 1,
    }));

    expect(mockEnqueueBatch).toHaveBeenCalledTimes(1);
  });

  it("resets consecutive zero counter when a batch gains properties", async () => {
    // 9 terms / TEST_BATCH_SIZE=3 → 3 batches
    // Batch 1: 0 gained, Batch 2: +10, Batch 3: 0 gained → counter reset, no stop
    const afterGain = 60;
    mockGet2025Count
      .mockResolvedValueOnce(BELOW_TARGET) // initial
      .mockResolvedValueOnce(BELOW_TARGET) // batch 1 pre
      .mockResolvedValueOnce(BELOW_TARGET) // batch 1 post (0 gained)
      .mockResolvedValueOnce(BELOW_TARGET) // batch 2 pre
      .mockResolvedValueOnce(afterGain)    // batch 2 post (+10)
      .mockResolvedValueOnce(afterGain)    // batch 3 pre
      .mockResolvedValueOnce(afterGain)    // batch 3 post (0 gained)
      .mockResolvedValueOnce(afterGain);   // final

    const terms = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    await runBackfill(makeCfg({ getTerms: async () => terms }));

    expect(mockEnqueueBatch).toHaveBeenCalledTimes(3);
  });

  it("calls enqueueBatch with correct userId", async () => {
    mockGet2025Count
      .mockResolvedValueOnce(BELOW_TARGET)
      .mockResolvedValueOnce(BELOW_TARGET)
      .mockResolvedValueOnce(TEST_TARGET_COUNT)
      .mockResolvedValueOnce(TEST_TARGET_COUNT)
      .mockResolvedValueOnce(TEST_TARGET_COUNT);

    await runBackfill(makeCfg({ userId: "my-custom-id" }));

    expect(mockEnqueueBatch).toHaveBeenCalledWith(
      expect.any(Array),
      "my-custom-id",
    );
  });

  it("calls process.exit(1) when TCAD_YEAR is not 2025", async () => {
    mockTcadYear = WRONG_YEAR;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    try {
      await runBackfill(makeCfg());
    } catch {
      // process.exit mock throws
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it("slices terms into BATCH_SIZE chunks", async () => {
    // 5 terms / TEST_BATCH_SIZE=3 → batch 1 (3 terms), batch 2 (2 terms)
    mockGet2025Count.mockResolvedValue(BELOW_TARGET);

    await runBackfill(makeCfg());

    expect(mockEnqueueBatch).toHaveBeenNthCalledWith(1,
      ["alpha", "bravo", "charlie"],
      "test-backfill",
    );
    expect(mockEnqueueBatch).toHaveBeenNthCalledWith(2,
      ["delta", "echo"],
      "test-backfill",
    );
  });

  it("exports DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES as expected value", () => {
    expect(DEFAULT_MAX_CONSECUTIVE_ZERO_BATCHES).toBe(TEST_BATCH_SIZE); // 3
  });
});
