/**
 * API Usage controller — ported from server/src/controllers/api-usage.controller.ts
 * Key changes: Express req/res → Hono context, per-request Prisma,
 * raw SQL via D1 prepared statements (replaces Prisma.$queryRaw).
 */

import type { Prisma } from "@prisma/client";
import { Hono } from "hono";
import type { AppEnv } from "../bindings";
import { COST_DECIMAL_PLACES, PERCENT_MULTIPLIER } from "../utils/constants";

const DEFAULT_LOOKBACK_DAYS = 7;

const app = new Hono<AppEnv>();

// GET /stats — API usage statistics
app.get("/stats", async (c) => {
	const prisma = c.get("prisma");
	const daysParam = c.req.query("days");
	const environment = c.req.query("environment");

	const daysNum = Math.min(
		parseInt(daysParam || String(DEFAULT_LOOKBACK_DAYS), 10) ||
			DEFAULT_LOOKBACK_DAYS,
		90,
	);
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - daysNum);
	const startDateEpoch = String(startDate.getTime());
	const where: Prisma.ApiUsageLogWhereInput = {
		timestamp: { gte: startDateEpoch },
	};
	if (environment) where.environment = environment;

	const [
		totalLogs,
		successfulLogs,
		totalCost,
		usageByDay,
		usageByModel,
		recentLogs,
	] = await Promise.all([
		prisma.apiUsageLog.count({ where }),
		prisma.apiUsageLog.count({ where: { ...where, success: true } }),
		prisma.apiUsageLog.aggregate({
			where,
			_sum: { queryCost: true, inputTokens: true, outputTokens: true },
			_avg: { queryCost: true, responseTime: true },
		}),
		// D1 prepared statement (replaces Prisma.$queryRaw with Prisma.sql/Prisma.empty)
		(async () => {
			const db = c.env.DB;
			let sql = `
          SELECT
            date(CAST(timestamp AS INTEGER) / 1000, 'unixepoch') as date,
            COUNT(*) as count,
            SUM(query_cost) as total_cost,
            COUNT(CASE WHEN success = 1 THEN 1 END) as success_count
          FROM api_usage_logs
          WHERE timestamp >= ?
        `;
			const params: (string | number)[] = [startDateEpoch];

			if (environment) {
				sql += ` AND environment = ?`;
				params.push(environment);
			}

			sql += ` GROUP BY date(CAST(timestamp AS INTEGER) / 1000, 'unixepoch') ORDER BY date DESC`;

			const result = await db
				.prepare(sql)
				.bind(...params)
				.all<{
					date: string;
					count: number;
					total_cost: number;
					success_count: number;
				}>();
			return result.results;
		})(),
		prisma.apiUsageLog.groupBy({
			by: ["model"],
			where,
			_count: true,
			_sum: { queryCost: true, inputTokens: true, outputTokens: true },
			_avg: { responseTime: true },
			orderBy: { _count: { model: "desc" } },
		}),
		prisma.apiUsageLog.findMany({
			where,
			orderBy: { timestamp: "desc" },
			take: 10,
			select: {
				id: true,
				queryText: true,
				queryCost: true,
				inputTokens: true,
				outputTokens: true,
				model: true,
				environment: true,
				success: true,
				errorMessage: true,
				responseTime: true,
				timestamp: true,
			},
		}),
	]);

	const successRate =
		totalLogs > 0
			? (Number(successfulLogs) / totalLogs) * PERCENT_MULTIPLIER
			: 0;

	return c.json({
		summary: {
			totalCalls: totalLogs,
			successfulCalls: successfulLogs,
			failedCalls: totalLogs - successfulLogs,
			successRate: `${successRate.toFixed(2)}%`,
			totalCost: `$${(totalCost._sum.queryCost || 0).toFixed(COST_DECIMAL_PLACES)}`,
			averageCost: `$${(totalCost._avg.queryCost || 0).toFixed(COST_DECIMAL_PLACES)}`,
			totalInputTokens: totalCost._sum.inputTokens || 0,
			totalOutputTokens: totalCost._sum.outputTokens || 0,
			averageResponseTime: totalCost._avg.responseTime
				? `${Math.round(totalCost._avg.responseTime)}ms`
				: "N/A",
			period: `Last ${daysNum} days`,
			environment: environment ?? "all",
		},
		byDay: usageByDay.map((day) => ({
			date: day.date,
			calls: day.count,
			cost: `$${(day.total_cost ?? 0).toFixed(COST_DECIMAL_PLACES)}`,
			successRate: `${((day.success_count / day.count) * PERCENT_MULTIPLIER).toFixed(1)}%`,
		})),
		byModel: usageByModel.map((model) => ({
			model: model.model,
			calls: model._count,
			totalCost: `$${(model._sum.queryCost || 0).toFixed(COST_DECIMAL_PLACES)}`,
			totalInputTokens: model._sum.inputTokens || 0,
			totalOutputTokens: model._sum.outputTokens || 0,
			avgResponseTime: model._avg.responseTime
				? `${Math.round(model._avg.responseTime)}ms`
				: "N/A",
		})),
		recentCalls: recentLogs,
	});
});

// GET /logs — paginated API usage logs
app.get("/logs", async (c) => {
	const prisma = c.get("prisma");
	const limitNum = Math.min(
		parseInt(c.req.query("limit") || "50", 10) || 50,
		1000,
	);
	const offsetNum = parseInt(c.req.query("offset") || "0", 10) || 0;
	const environment = c.req.query("environment");
	const success = c.req.query("success");

	const where: Prisma.ApiUsageLogWhereInput = {};
	if (environment) where.environment = environment;
	if (success !== undefined) where.success = success === "true";

	const [logs, total] = await Promise.all([
		prisma.apiUsageLog.findMany({
			where,
			orderBy: { timestamp: "desc" },
			take: limitNum,
			skip: offsetNum,
		}),
		prisma.apiUsageLog.count({ where }),
	]);

	return c.json({
		data: logs,
		pagination: {
			total,
			limit: limitNum,
			offset: offsetNum,
			hasMore: offsetNum + logs.length < total,
		},
	});
});

// GET /alerts — cost/usage alerts
app.get("/alerts", async (c) => {
	const prisma = c.get("prisma");
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const DAILY_COST_WARNING = 1.0;
	const DAILY_COST_CRITICAL = 5.0;
	const MONTHLY_COST_WARNING = 10.0;
	const MONTHLY_COST_CRITICAL = 50.0;
	const FAILURE_THRESHOLD = 10;

	const [todayCost, monthCost, recentFailures] = await Promise.all([
		prisma.apiUsageLog.aggregate({
			where: { timestamp: { gte: String(today.getTime()) } },
			_sum: { queryCost: true },
		}),
		prisma.apiUsageLog.aggregate({
			where: { timestamp: { gte: String(thisMonth.getTime()) } },
			_sum: { queryCost: true },
		}),
		prisma.apiUsageLog.count({
			where: {
				success: false,
				timestamp: { gte: String(Date.now() - 24 * 60 * 60 * 1000) },
			},
		}),
	]);

	const alerts: Array<{ level: string; message: string }> = [];
	const todayCostNum = todayCost._sum.queryCost || 0;
	const monthCostNum = monthCost._sum.queryCost || 0;

	if (todayCostNum >= DAILY_COST_CRITICAL) {
		alerts.push({
			level: "critical",
			message: `Daily API cost (${todayCostNum.toFixed(2)}) exceeded critical threshold ($${DAILY_COST_CRITICAL})`,
		});
	} else if (todayCostNum >= DAILY_COST_WARNING) {
		alerts.push({
			level: "warning",
			message: `Daily API cost (${todayCostNum.toFixed(2)}) exceeded warning threshold ($${DAILY_COST_WARNING})`,
		});
	}

	if (monthCostNum >= MONTHLY_COST_CRITICAL) {
		alerts.push({
			level: "critical",
			message: `Monthly API cost (${monthCostNum.toFixed(2)}) exceeded critical threshold ($${MONTHLY_COST_CRITICAL})`,
		});
	} else if (monthCostNum >= MONTHLY_COST_WARNING) {
		alerts.push({
			level: "warning",
			message: `Monthly API cost (${monthCostNum.toFixed(2)}) exceeded warning threshold ($${MONTHLY_COST_WARNING})`,
		});
	}

	if (recentFailures >= FAILURE_THRESHOLD) {
		alerts.push({
			level: "critical",
			message: `High failure rate: ${recentFailures} failures in the last 24 hours`,
		});
	}

	return c.json({
		alerts,
		costs: {
			today: `$${todayCostNum.toFixed(COST_DECIMAL_PLACES)}`,
			month: `$${monthCostNum.toFixed(COST_DECIMAL_PLACES)}`,
		},
		failures: { last24Hours: recentFailures },
		thresholds: {
			dailyWarning: `$${DAILY_COST_WARNING}`,
			dailyCritical: `$${DAILY_COST_CRITICAL}`,
			monthlyWarning: `$${MONTHLY_COST_WARNING}`,
			monthlyCritical: `$${MONTHLY_COST_CRITICAL}`,
			failureThreshold: FAILURE_THRESHOLD,
		},
	});
});

export { app as apiUsageRoutes };
