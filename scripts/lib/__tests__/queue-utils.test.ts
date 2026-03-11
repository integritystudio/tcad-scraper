import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAdd = vi.fn();
const mockGetWaitingCount = vi.fn();
const mockGetActiveCount = vi.fn();

vi.mock("../../../server/src/queues/scraper.queue", () => ({
  scraperQueue: {
    add: (...args: unknown[]) => mockAdd(...args),
    getWaitingCount: () => mockGetWaitingCount(),
    getActiveCount: () => mockGetActiveCount(),
  },
}));

vi.mock("../../../server/src/config", () => ({
  config: {
    queue: {
      jobName: "scrape-properties",
      defaultJobOptions: {
        attempts: 3,
        backoffDelay: 2000,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    },
  },
}));

import { enqueueBatch, waitForQueueDrain, POLL_INTERVAL_MS } from "../queue-utils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("enqueueBatch", () => {
  it("returns count of successfully enqueued terms", async () => {
    mockAdd.mockResolvedValue(undefined);
    const count = await enqueueBatch(["alpha", "bravo", "charlie"], "user-1");
    expect(count).toBe(3);
    expect(mockAdd).toHaveBeenCalledTimes(3);
  });

  it("calls injected logger.error when a term fails, not console.error", async () => {
    const consoleSpy = vi.spyOn(console, "error");
    const mockLogger = { error: vi.fn() };
    mockAdd.mockRejectedValueOnce(new Error("queue full"));
    mockAdd.mockResolvedValue(undefined);

    const count = await enqueueBatch(["fail-term", "ok-term"], "user-1", mockLogger);

    expect(count).toBe(1);
    expect(mockLogger.error).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("fail-term"),
    );
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("falls back to console logger when no logger is provided", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAdd.mockRejectedValueOnce(new Error("boom"));

    const count = await enqueueBatch(["bad-term"], "user-1");

    expect(count).toBe(0);
    expect(consoleSpy).toHaveBeenCalledOnce();
    consoleSpy.mockRestore();
  });

  it("passes config-driven job options to scraperQueue.add", async () => {
    mockAdd.mockResolvedValue(undefined);
    await enqueueBatch(["test"], "user-42");

    expect(mockAdd).toHaveBeenCalledWith(
      "scrape-properties",
      { searchTerm: "test", userId: "user-42", scheduled: true },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  });

  it("returns 0 when all terms fail", async () => {
    mockAdd.mockRejectedValue(new Error("error"));
    const mockLogger = { error: vi.fn() };
    const count = await enqueueBatch(["a", "b", "c"], "user-1", mockLogger);
    expect(count).toBe(0);
    expect(mockLogger.error).toHaveBeenCalledTimes(3);
  });

  it("returns 0 for empty terms array", async () => {
    const count = await enqueueBatch([], "user-1");
    expect(count).toBe(0);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe("waitForQueueDrain", () => {
  it("resolves immediately when queue is already empty", async () => {
    mockGetWaitingCount.mockResolvedValue(0);
    mockGetActiveCount.mockResolvedValue(0);
    await expect(waitForQueueDrain()).resolves.toBeUndefined();
    expect(mockGetWaitingCount).toHaveBeenCalledOnce();
    expect(mockGetActiveCount).toHaveBeenCalledOnce();
  });

  it("polls until both active and waiting counts reach 0", async () => {
    vi.useFakeTimers();
    // First poll: busy; second poll: drained
    mockGetWaitingCount
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);
    mockGetActiveCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0);

    const drain = waitForQueueDrain();
    // Advance past the poll interval
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 100);
    await drain;

    expect(mockGetWaitingCount).toHaveBeenCalledTimes(2);
    expect(mockGetActiveCount).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
