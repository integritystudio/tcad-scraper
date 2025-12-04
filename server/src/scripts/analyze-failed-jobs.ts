#!/usr/bin/env tsx

/**
 * Analyze Failed Jobs Script
 *
 * Queries the scrape_jobs table to analyze failure patterns:
 * - Error message frequency
 * - Failure rate over time
 * - Common search terms that fail
 * - Error types (TOKEN_EXPIRED, HTTP 504, TRUNCATED, etc.)
 */

import logger from "../lib/logger";
import { prisma } from "../lib/prisma";

interface ErrorStats {
	errorMessage: string;
	count: number;
	percentage: number;
	searchTerms: string[];
}

interface FailureAnalysis {
	totalJobs: number;
	failedJobs: number;
	completedJobs: number;
	failureRate: number;
	errorBreakdown: ErrorStats[];
	recentFailures: Array<{
		searchTerm: string;
		error: string | null;
		completedAt: Date | null;
	}>;
}

async function analyzeFailedJobs(): Promise<FailureAnalysis> {
	logger.info("Analyzing failed scrape jobs...");

	// Get overall job statistics
	const [totalJobs, failedJobs, completedJobs] = await Promise.all([
		prisma.scrapeJob.count(),
		prisma.scrapeJob.count({ where: { status: "failed" } }),
		prisma.scrapeJob.count({ where: { status: "completed" } }),
	]);

	const failureRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;

	logger.info(`Total jobs: ${totalJobs}`);
	logger.info(`Failed jobs: ${failedJobs} (${failureRate.toFixed(2)}%)`);
	logger.info(`Completed jobs: ${completedJobs}`);

	// Get all failed jobs with error messages
	const failedJobsData = await prisma.scrapeJob.findMany({
		where: { status: "failed" },
		select: {
			searchTerm: true,
			error: true,
			completedAt: true,
		},
		orderBy: { completedAt: "desc" },
	});

	// Group errors by message
	const errorGroups = new Map<
		string,
		{ count: number; searchTerms: Set<string> }
	>();

	for (const job of failedJobsData) {
		const errorMsg = job.error || "Unknown error";

		if (!errorGroups.has(errorMsg)) {
			errorGroups.set(errorMsg, { count: 0, searchTerms: new Set() });
		}

		const group = errorGroups.get(errorMsg)!;
		group.count++;
		group.searchTerms.add(job.searchTerm);
	}

	// Convert to sorted array
	const errorBreakdown: ErrorStats[] = Array.from(errorGroups.entries())
		.map(([errorMessage, data]) => ({
			errorMessage,
			count: data.count,
			percentage: failedJobs > 0 ? (data.count / failedJobs) * 100 : 0,
			searchTerms: Array.from(data.searchTerms).slice(0, 5), // Top 5 search terms
		}))
		.sort((a, b) => b.count - a.count);

	// Get recent failures
	const recentFailures = failedJobsData.slice(0, 20).map((job) => ({
		searchTerm: job.searchTerm,
		error: job.error,
		completedAt: job.completedAt,
	}));

	return {
		totalJobs,
		failedJobs,
		completedJobs,
		failureRate,
		errorBreakdown,
		recentFailures,
	};
}

async function main() {
	try {
		const analysis = await analyzeFailedJobs();

		console.log("\n========================================");
		console.log("FAILED JOBS ANALYSIS");
		console.log("========================================\n");

		console.log(`Total Jobs: ${analysis.totalJobs}`);
		console.log(
			`Failed: ${analysis.failedJobs} (${analysis.failureRate.toFixed(2)}%)`,
		);
		console.log(`Completed: ${analysis.completedJobs}\n`);

		console.log("========================================");
		console.log("ERROR BREAKDOWN (by frequency)");
		console.log("========================================\n");

		for (const [index, error] of analysis.errorBreakdown.entries()) {
			console.log(`${index + 1}. ${error.errorMessage}`);
			console.log(
				`   Count: ${error.count} (${error.percentage.toFixed(2)}% of failures)`,
			);
			console.log(`   Sample search terms: ${error.searchTerms.join(", ")}`);
			console.log("");
		}

		console.log("========================================");
		console.log("RECENT FAILURES (last 20)");
		console.log("========================================\n");

		for (const failure of analysis.recentFailures) {
			const timestamp = failure.completedAt
				? failure.completedAt.toISOString()
				: "N/A";
			console.log(`[${timestamp}] "${failure.searchTerm}"`);
			console.log(`  Error: ${failure.error || "Unknown"}\n`);
		}

		// Categorize errors by type
		console.log("========================================");
		console.log("ERROR CATEGORIES");
		console.log("========================================\n");

		const categories = {
			tokenExpired: analysis.errorBreakdown.filter(
				(e) =>
					e.errorMessage.includes("TOKEN_EXPIRED") ||
					e.errorMessage.includes("HTTP 401"),
			),
			timeout: analysis.errorBreakdown.filter(
				(e) =>
					e.errorMessage.includes("GATEWAY_TIMEOUT") ||
					e.errorMessage.includes("HTTP 504") ||
					e.errorMessage.includes("timeout"),
			),
			truncated: analysis.errorBreakdown.filter((e) =>
				e.errorMessage.includes("TRUNCATED"),
			),
			captureFailure: analysis.errorBreakdown.filter((e) =>
				e.errorMessage.includes("Failed to capture authorization token"),
			),
			other: analysis.errorBreakdown.filter(
				(e) =>
					!e.errorMessage.includes("TOKEN_EXPIRED") &&
					!e.errorMessage.includes("HTTP 401") &&
					!e.errorMessage.includes("GATEWAY_TIMEOUT") &&
					!e.errorMessage.includes("HTTP 504") &&
					!e.errorMessage.includes("timeout") &&
					!e.errorMessage.includes("TRUNCATED") &&
					!e.errorMessage.includes("Failed to capture authorization token"),
			),
		};

		const categoryCounts = {
			tokenExpired: categories.tokenExpired.reduce(
				(sum, e) => sum + e.count,
				0,
			),
			timeout: categories.timeout.reduce((sum, e) => sum + e.count, 0),
			truncated: categories.truncated.reduce((sum, e) => sum + e.count, 0),
			captureFailure: categories.captureFailure.reduce(
				(sum, e) => sum + e.count,
				0,
			),
			other: categories.other.reduce((sum, e) => sum + e.count, 0),
		};

		console.log(
			`Token Expired (HTTP 401): ${categoryCounts.tokenExpired} (${((categoryCounts.tokenExpired / analysis.failedJobs) * 100).toFixed(2)}%)`,
		);
		console.log(
			`Timeout Errors (HTTP 504): ${categoryCounts.timeout} (${((categoryCounts.timeout / analysis.failedJobs) * 100).toFixed(2)}%)`,
		);
		console.log(
			`Truncated Responses: ${categoryCounts.truncated} (${((categoryCounts.truncated / analysis.failedJobs) * 100).toFixed(2)}%)`,
		);
		console.log(
			`Token Capture Failures: ${categoryCounts.captureFailure} (${((categoryCounts.captureFailure / analysis.failedJobs) * 100).toFixed(2)}%)`,
		);
		console.log(
			`Other Errors: ${categoryCounts.other} (${((categoryCounts.other / analysis.failedJobs) * 100).toFixed(2)}%)\n`,
		);
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger.error(`Failed to analyze jobs: ${errorMessage}`);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

main().catch(console.error);
