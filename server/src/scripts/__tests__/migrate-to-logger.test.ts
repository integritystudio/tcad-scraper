import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();

vi.mock("node:fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  existsSync: vi.fn().mockReturnValue(true),
}));

import { migrateFile } from "../migrate-to-logger";

beforeEach(() => {
  vi.clearAllMocks();
});

const FAKE_PATH = "/fake/scripts/some-script.ts";

describe("migrateFile dry-run", () => {
  it("prints per-type replacement counts and does NOT write to disk", () => {
    mockReadFileSync.mockReturnValue(
      'import foo from "bar";\nconsole.log("hello");\nconsole.error("oops");\nconsole.warn("warn");\n',
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    migrateFile(FAKE_PATH, true);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    // Should print dry-run header and per-type breakdown lines
    const logCalls = logSpy.mock.calls.map(c => c[0] as string);
    expect(logCalls.some(l => l.includes("[dry-run]"))).toBe(true);
    expect(logCalls.some(l => l.includes("console.log("))).toBe(true);
    expect(logCalls.some(l => l.includes("console.error("))).toBe(true);
    expect(logCalls.some(l => l.includes("console.warn("))).toBe(true);

    logSpy.mockRestore();
  });

  it("dry-run reports correct total replacement count", () => {
    mockReadFileSync.mockReturnValue(
      'console.log("a");\nconsole.log("b");\nconsole.error("c");\n',
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    migrateFile(FAKE_PATH, true);

    const header = logSpy.mock.calls.find(c =>
      (c[0] as string).includes("[dry-run]"),
    );
    expect(header).toBeDefined();
    expect(header![0]).toContain("3 replacements");

    logSpy.mockRestore();
  });

  it("regex labels are human-readable (no escaped backslashes)", () => {
    mockReadFileSync.mockReturnValue('console.log("hello");\n');
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    migrateFile(FAKE_PATH, true);

    const allOutput = logSpy.mock.calls.map(c => c[0] as string).join("\n");
    // Should contain readable "console.log(" not "console\\.log\\("
    expect(allOutput).toContain("console.log(");
    expect(allOutput).not.toContain("\\.");

    logSpy.mockRestore();
  });
});

describe("migrateFile write mode", () => {
  it("writes modified content when not dry-run", () => {
    mockReadFileSync.mockReturnValue('console.log("hello");\n');
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    migrateFile(FAKE_PATH, false);

    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [writtenPath, writtenContent] = mockWriteFileSync.mock.calls[0] as [string, string, string];
    expect(writtenPath).toBe(FAKE_PATH);
    expect(writtenContent).toContain("logger.info(");
    expect(writtenContent).not.toContain("console.log(");

    logSpy.mockRestore();
  });
});

describe("migrateFile no-op", () => {
  it("prints 'No changes' and does not write when file has no console calls", () => {
    mockReadFileSync.mockReturnValue('const x = 1;\nconst y = 2;\n');
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    migrateFile(FAKE_PATH, false);

    expect(mockWriteFileSync).not.toHaveBeenCalled();
    const logCalls = logSpy.mock.calls.map(c => c[0] as string);
    expect(logCalls.some(l => l.toLowerCase().includes("no changes"))).toBe(true);

    logSpy.mockRestore();
  });

  it("dry-run on file with no console calls also does not write", () => {
    mockReadFileSync.mockReturnValue('const x = 1;\n');
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    migrateFile(FAKE_PATH, true);

    expect(mockWriteFileSync).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
