/** Shared scrape_jobs count/rate helpers for analyze-failed-jobs.ts and analyze-search-terms.ts. */

import { prisma } from "./d1-prisma";

export interface JobStats {
	totalJobs: number;
	completedJobs: number;
	failedJobs: number;
	pendingJobs: number;
	/** completedJobs as a percentage of totalJobs (0-100; 0 when totalJobs is 0). */
	completedRate: number;
	/** failedJobs as a percentage of totalJobs (0-100; 0 when totalJobs is 0). */
	failedRate: number;
}

function rate(count: number, total: number): number {
	return total > 0 ? (count / total) * 100 : 0;
}

/** Fetch overall scrape_jobs counts by status, plus completed/failed rates. */
export async function getJobStats(): Promise<JobStats> {
	const [totalJobs, completedJobs, failedJobs, pendingJobs] = await Promise.all(
		[
			prisma.scrapeJob.count(),
			prisma.scrapeJob.count({ where: { status: "completed" } }),
			prisma.scrapeJob.count({ where: { status: "failed" } }),
			prisma.scrapeJob.count({ where: { status: "pending" } }),
		],
	);

	return {
		totalJobs,
		completedJobs,
		failedJobs,
		pendingJobs,
		completedRate: rate(completedJobs, totalJobs),
		failedRate: rate(failedJobs, totalJobs),
	};
}
