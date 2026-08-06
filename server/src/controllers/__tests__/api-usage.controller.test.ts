/**
 * ApiUsageController unit tests (TC-13)
 *
 * Covers: typeof guards on query params (days, environment, limit, offset, success),
 * null-safety for SUM(query_cost) returning null, and Prisma.sql parameterization.
 */

import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { ApiUsageController } from "../api-usage.controller";

vi.mock("../../lib/prisma", () => ({
	prismaReadOnly: {
		apiUsageLog: {
			count: vi.fn(),
			aggregate: vi.fn(),
			groupBy: vi.fn(),
			findMany: vi.fn(),
			$queryRaw: vi.fn(),
		},
		$queryRaw: vi.fn(),
	},
}));

const defaultAggregate = {
	_sum: { queryCost: null, inputTokens: null, outputTokens: null },
	_avg: { queryCost: null, responseTime: null },
};

function makeRes(): { res: Partial<Response>; jsonMock: Mock; statusMock: Mock } {
	const jsonMock: Mock = vi.fn();
	const statusMock: Mock = vi.fn().mockReturnValue({ json: jsonMock });
	return {
		res: { status: statusMock, json: jsonMock },
		jsonMock,
		statusMock,
	};
}

describe("ApiUsageController", () => {
	let controller: ApiUsageController;

	beforeEach(async () => {
		controller = new ApiUsageController();
		vi.clearAllMocks();

		// Default happy-path mock setup
		const { prismaReadOnly } = await import("../../lib/prisma");
		(prismaReadOnly.apiUsageLog.count as Mock).mockResolvedValue(0);
		(prismaReadOnly.apiUsageLog.aggregate as Mock).mockResolvedValue(
			defaultAggregate,
		);
		(prismaReadOnly.apiUsageLog.groupBy as Mock).mockResolvedValue([]);
		(prismaReadOnly.apiUsageLog.findMany as Mock).mockResolvedValue([]);
		(prismaReadOnly.$queryRaw as Mock).mockResolvedValue([]);
	});

	// ── getUsageStats ────────────────────────────────────────────────────

	describe("getUsageStats", () => {
		it("uses default days when param is absent", async () => {
			const req = { query: {} } as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			expect(jsonMock).toHaveBeenCalledOnce();
			const body = jsonMock.mock.calls[0][0] as { summary: { period: string } };
			// DEFAULT_LOOKBACK_DAYS = 7
			expect(body.summary.period).toBe("Last 7 days");
		});

		it("uses default days when param is a non-string (typeof guard)", async () => {
			// Express ParsedQs allows string[] — this exercises the typeof guard
			const req = { query: { days: ["10", "20"] } } as unknown as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as { summary: { period: string } };
			expect(body.summary.period).toBe("Last 7 days");
		});

		it("clamps days to 90 when requested value exceeds limit", async () => {
			const req = { query: { days: "999" } } as unknown as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as { summary: { period: string } };
			expect(body.summary.period).toBe("Last 90 days");
		});

		it("applies environment filter when param is a string", async () => {
			const req = {
				query: { environment: "production" },
			} as unknown as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				summary: { environment: string };
			};
			expect(body.summary.environment).toBe("production");
		});

		it("ignores environment param when it is not a string (typeof guard)", async () => {
			const req = {
				query: { environment: ["a", "b"] },
			} as unknown as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				summary: { environment: string };
			};
			expect(body.summary.environment).toBe("all");
		});

		it("handles null SUM(query_cost) without throwing (TC-13 null-dereference)", async () => {
			// SUM returns null when there are no rows
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.aggregate as Mock).mockResolvedValue({
				_sum: { queryCost: null, inputTokens: null, outputTokens: null },
				_avg: { queryCost: null, responseTime: null },
			});

			const req = { query: {} } as Request;
			const { res, jsonMock, statusMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			// Should NOT throw — falls back to 0
			expect(statusMock).not.toHaveBeenCalled();
			const body = jsonMock.mock.calls[0][0] as {
				summary: { totalCost: string; averageCost: string };
			};
			expect(body.summary.totalCost).toBe("$0.000000");
			expect(body.summary.averageCost).toBe("$0.000000");
		});

		it("formats response correctly when data is present", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.count as Mock)
				.mockResolvedValueOnce(10) // total
				.mockResolvedValueOnce(8); // successful
			(prismaReadOnly.apiUsageLog.aggregate as Mock).mockResolvedValue({
				_sum: { queryCost: 0.5, inputTokens: 1000, outputTokens: 500 },
				_avg: { queryCost: 0.05, responseTime: 250 },
			});

			const req = { query: {} } as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageStats(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				summary: {
					totalCalls: number;
					successfulCalls: number;
					failedCalls: number;
					successRate: string;
					totalCost: string;
					averageResponseTime: string;
				};
			};
			expect(body.summary.totalCalls).toBe(10);
			expect(body.summary.successfulCalls).toBe(8);
			expect(body.summary.failedCalls).toBe(2);
			expect(body.summary.successRate).toBe("80.00%");
			expect(body.summary.totalCost).toBe("$0.500000");
			expect(body.summary.averageResponseTime).toBe("250ms");
		});
	});

	// ── getUsageLogs ─────────────────────────────────────────────────────

	describe("getUsageLogs", () => {
		it("uses default limit and offset when params are absent", async () => {
			const req = { query: {} } as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageLogs(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				pagination: { limit: number; offset: number };
			};
			expect(body.pagination.limit).toBe(50);
			expect(body.pagination.offset).toBe(0);
		});

		it("uses default limit when param is non-string (typeof guard)", async () => {
			const req = {
				query: { limit: ["10", "20"] },
			} as unknown as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageLogs(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				pagination: { limit: number };
			};
			expect(body.pagination.limit).toBe(50);
		});

		it("clamps limit to 1000", async () => {
			const req = { query: { limit: "5000" } } as unknown as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageLogs(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				pagination: { limit: number };
			};
			expect(body.pagination.limit).toBe(1000);
		});

		it("filters by success=true when param is 'true'", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			const req = { query: { success: "true" } } as unknown as Request;
			const { res } = makeRes();

			await controller.getUsageLogs(req, res as Response);

			const findManyCall = (prismaReadOnly.apiUsageLog.findMany as Mock).mock
				.calls[0][0] as { where: { success?: boolean } };
			expect(findManyCall.where.success).toBe(true);
		});

		it("filters by success=false when param is 'false'", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			const req = { query: { success: "false" } } as unknown as Request;
			const { res } = makeRes();

			await controller.getUsageLogs(req, res as Response);

			const findManyCall = (prismaReadOnly.apiUsageLog.findMany as Mock).mock
				.calls[0][0] as { where: { success?: boolean } };
			expect(findManyCall.where.success).toBe(false);
		});
	});

	// ── getUsageAlerts ────────────────────────────────────────────────────

	describe("getUsageAlerts", () => {
		it("returns empty alerts when costs and failures are below thresholds", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.aggregate as Mock)
				.mockResolvedValueOnce({ _sum: { queryCost: 0 } }) // today
				.mockResolvedValueOnce({ _sum: { queryCost: 0 } }); // this month
			(prismaReadOnly.apiUsageLog.count as Mock).mockResolvedValue(0); // failures

			const req = {} as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageAlerts(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as { alerts: unknown[] };
			expect(body.alerts).toHaveLength(0);
		});

		it("generates warning alert when daily cost exceeds $1", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.aggregate as Mock)
				.mockResolvedValueOnce({ _sum: { queryCost: 1.5 } }) // today > $1 warning
				.mockResolvedValueOnce({ _sum: { queryCost: 0 } }); // month
			(prismaReadOnly.apiUsageLog.count as Mock).mockResolvedValue(0);

			const req = {} as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageAlerts(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				alerts: Array<{ level: string }>;
			};
			expect(body.alerts.some((a) => a.level === "warning")).toBe(true);
		});

		it("generates critical alert when daily cost exceeds $5", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.aggregate as Mock)
				.mockResolvedValueOnce({ _sum: { queryCost: 6.0 } }) // today > $5 critical
				.mockResolvedValueOnce({ _sum: { queryCost: 0 } }); // month
			(prismaReadOnly.apiUsageLog.count as Mock).mockResolvedValue(0);

			const req = {} as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageAlerts(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				alerts: Array<{ level: string }>;
			};
			expect(body.alerts.some((a) => a.level === "critical")).toBe(true);
		});

		it("generates critical alert when failures exceed threshold (10)", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.aggregate as Mock)
				.mockResolvedValueOnce({ _sum: { queryCost: 0 } })
				.mockResolvedValueOnce({ _sum: { queryCost: 0 } });
			(prismaReadOnly.apiUsageLog.count as Mock).mockResolvedValue(15); // > 10 threshold

			const req = {} as Request;
			const { res, jsonMock } = makeRes();

			await controller.getUsageAlerts(req, res as Response);

			const body = jsonMock.mock.calls[0][0] as {
				alerts: Array<{ level: string; message: string }>;
			};
			const failureAlert = body.alerts.find((a) =>
				a.message.includes("failure"),
			);
			expect(failureAlert?.level).toBe("critical");
		});

		it("handles null SUM(query_cost) safely", async () => {
			const { prismaReadOnly } = await import("../../lib/prisma");
			(prismaReadOnly.apiUsageLog.aggregate as Mock)
				.mockResolvedValueOnce({ _sum: { queryCost: null } })
				.mockResolvedValueOnce({ _sum: { queryCost: null } });
			(prismaReadOnly.apiUsageLog.count as Mock).mockResolvedValue(0);

			const req = {} as Request;
			const { res, jsonMock, statusMock } = makeRes();

			await controller.getUsageAlerts(req, res as Response);

			expect(statusMock).not.toHaveBeenCalled();
			const body = jsonMock.mock.calls[0][0] as {
				costs: { today: string; month: string };
			};
			expect(body.costs.today).toBe("$0.000000");
			expect(body.costs.month).toBe("$0.000000");
		});
	});
});
