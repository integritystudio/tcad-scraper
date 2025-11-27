import { Request, Response } from 'express';
import { prismaReadOnly } from '../lib/prisma';

export class ApiUsageController {
  /**
   * GET /api/usage/stats - Get API usage statistics
   */
  async getUsageStats(req: Request, res: Response) {
    const { days = 7, environment } = req.query;

    const daysNum = Math.min(parseInt(days as string) || 7, 90); // Max 90 days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // Build where clause
    const where: any = {
      timestamp: {
        gte: startDate,
      },
    };

    if (environment) {
      where.environment = environment as string;
    }

    // Get usage statistics
    const [totalLogs, successfulLogs, totalCost, usageByDay, usageByModel, recentLogs] =
      await Promise.all([
        // Total API calls
        prismaReadOnly.apiUsageLog.count({ where }),

        // Successful calls
        prismaReadOnly.apiUsageLog.count({
          where: { ...where, success: true },
        }),

        // Total cost
        prismaReadOnly.apiUsageLog.aggregate({
          where,
          _sum: {
            queryCost: true,
            inputTokens: true,
            outputTokens: true,
          },
          _avg: {
            queryCost: true,
            responseTime: true,
          },
        }),

        // Usage by day
        prismaReadOnly.$queryRaw<
          Array<{ date: Date; count: bigint; total_cost: number; success_count: bigint }>
        >`
          SELECT
            DATE(timestamp) as date,
            COUNT(*)::bigint as count,
            SUM(query_cost) as total_cost,
            COUNT(CASE WHEN success THEN 1 END)::bigint as success_count
          FROM api_usage_logs
          WHERE timestamp >= ${startDate}
            ${environment ? `AND environment = ${environment}` : ''}
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `,

        // Usage by model
        prismaReadOnly.apiUsageLog.groupBy({
          by: ['model'],
          where,
          _count: true,
          _sum: {
            queryCost: true,
            inputTokens: true,
            outputTokens: true,
          },
          _avg: {
            responseTime: true,
          },
          orderBy: {
            _count: {
              model: 'desc',
            },
          },
        }),

        // Recent logs (last 10)
        prismaReadOnly.apiUsageLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
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

    const successRate = totalLogs > 0 ? (Number(successfulLogs) / totalLogs) * 100 : 0;

    return res.json({
      summary: {
        totalCalls: totalLogs,
        successfulCalls: successfulLogs,
        failedCalls: totalLogs - successfulLogs,
        successRate: successRate.toFixed(2) + '%',
        totalCost: `$${(totalCost._sum.queryCost || 0).toFixed(6)}`,
        averageCost: `$${(totalCost._avg.queryCost || 0).toFixed(6)}`,
        totalInputTokens: totalCost._sum.inputTokens || 0,
        totalOutputTokens: totalCost._sum.outputTokens || 0,
        averageResponseTime: totalCost._avg.responseTime
          ? `${Math.round(totalCost._avg.responseTime)}ms`
          : 'N/A',
        period: `Last ${daysNum} days`,
        environment: environment || 'all',
      },
      byDay: usageByDay.map((day) => ({
        date: day.date,
        calls: Number(day.count),
        cost: `$${day.total_cost.toFixed(6)}`,
        successRate: `${((Number(day.success_count) / Number(day.count)) * 100).toFixed(1)}%`,
      })),
      byModel: usageByModel.map((model) => ({
        model: model.model,
        calls: model._count,
        totalCost: `$${(model._sum.queryCost || 0).toFixed(6)}`,
        totalInputTokens: model._sum.inputTokens || 0,
        totalOutputTokens: model._sum.outputTokens || 0,
        avgResponseTime: model._avg.responseTime
          ? `${Math.round(model._avg.responseTime)}ms`
          : 'N/A',
      })),
      recentCalls: recentLogs,
    });
  }

  /**
   * GET /api/usage/logs - Get paginated API usage logs
   */
  async getUsageLogs(req: Request, res: Response) {
    const { limit = 50, offset = 0, environment, success } = req.query;

    const where: any = {};
    if (environment) {
      where.environment = environment as string;
    }
    if (success !== undefined) {
      where.success = success === 'true';
    }

    const [logs, total] = await Promise.all([
      prismaReadOnly.apiUsageLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: Math.min(parseInt(limit as string) || 50, 1000),
        skip: parseInt(offset as string) || 0,
      }),
      prismaReadOnly.apiUsageLog.count({ where }),
    ]);

    return res.json({
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
        hasMore: (parseInt(offset as string) || 0) + logs.length < total,
      },
    });
  }

  /**
   * GET /api/usage/alerts - Check for cost/usage alerts
   */
  async getUsageAlerts(_req: Request, res: Response) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayCost, monthCost, recentFailures] = await Promise.all([
      // Today's cost
      prismaReadOnly.apiUsageLog.aggregate({
        where: {
          timestamp: { gte: today },
        },
        _sum: {
          queryCost: true,
        },
      }),

      // This month's cost
      prismaReadOnly.apiUsageLog.aggregate({
        where: {
          timestamp: { gte: thisMonth },
        },
        _sum: {
          queryCost: true,
        },
      }),

      // Recent failures (last 24 hours)
      prismaReadOnly.apiUsageLog.count({
        where: {
          success: false,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const alerts: Array<{ level: string; message: string }> = [];

    // Cost thresholds (customize these based on your budget)
    const DAILY_COST_WARNING = 1.0; // $1/day
    const DAILY_COST_CRITICAL = 5.0; // $5/day
    const MONTHLY_COST_WARNING = 10.0; // $10/month
    const MONTHLY_COST_CRITICAL = 50.0; // $50/month
    const FAILURE_THRESHOLD = 10; // 10 failures in 24h

    const todayCostNum = todayCost._sum.queryCost || 0;
    const monthCostNum = monthCost._sum.queryCost || 0;

    // Daily cost alerts
    if (todayCostNum >= DAILY_COST_CRITICAL) {
      alerts.push({
        level: 'critical',
        message: `Daily API cost (${todayCostNum.toFixed(2)}) exceeded critical threshold ($${DAILY_COST_CRITICAL})`,
      });
    } else if (todayCostNum >= DAILY_COST_WARNING) {
      alerts.push({
        level: 'warning',
        message: `Daily API cost (${todayCostNum.toFixed(2)}) exceeded warning threshold ($${DAILY_COST_WARNING})`,
      });
    }

    // Monthly cost alerts
    if (monthCostNum >= MONTHLY_COST_CRITICAL) {
      alerts.push({
        level: 'critical',
        message: `Monthly API cost (${monthCostNum.toFixed(2)}) exceeded critical threshold ($${MONTHLY_COST_CRITICAL})`,
      });
    } else if (monthCostNum >= MONTHLY_COST_WARNING) {
      alerts.push({
        level: 'warning',
        message: `Monthly API cost (${monthCostNum.toFixed(2)}) exceeded warning threshold ($${MONTHLY_COST_WARNING})`,
      });
    }

    // Failure rate alerts
    if (recentFailures >= FAILURE_THRESHOLD) {
      alerts.push({
        level: 'critical',
        message: `High failure rate: ${recentFailures} failures in the last 24 hours`,
      });
    }

    return res.json({
      alerts,
      costs: {
        today: `$${todayCostNum.toFixed(6)}`,
        month: `$${monthCostNum.toFixed(6)}`,
      },
      failures: {
        last24Hours: recentFailures,
      },
      thresholds: {
        dailyWarning: `$${DAILY_COST_WARNING}`,
        dailyCritical: `$${DAILY_COST_CRITICAL}`,
        monthlyWarning: `$${MONTHLY_COST_WARNING}`,
        monthlyCritical: `$${MONTHLY_COST_CRITICAL}`,
        failureThreshold: FAILURE_THRESHOLD,
      },
    });
  }
}

export const apiUsageController = new ApiUsageController();
