/**
 * Bull Queue Type Definitions
 *
 * Provides type-safe interfaces for Bull queue jobs used in the TCAD scraper.
 * These types eliminate the need for 'any' casts when working with Bull jobs.
 *
 * Usage:
 * ```typescript
 * import { BullJob, BullJobWithData } from '../types/queue.types';
 *
 * const job: BullJob<ScrapeJobData> = await scraperQueue.getJob(jobId);
 * const data: ScrapeJobData = job.data; // Type-safe!
 * ```
 */

import type Bull from "bull";
import type { ScrapeJobData, ScrapeJobResult } from "./index";

/**
 * Bull Job interface with typed data payload
 * Represents a job in the queue with specific data type
 */
export type BullJob<T = ScrapeJobData> = Bull.Job<T>;

/**
 * Bull Job with data guarantee
 * Use when you know the job has been loaded with data
 */
export interface BullJobWithData<T = ScrapeJobData> extends Bull.Job<T> {
	data: T;
}

/**
 * Bull Job with result (completed job)
 * Use for jobs that have completed successfully
 */
export type BullCompletedJob<
	T = ScrapeJobData,
	R = ScrapeJobResult,
> = Bull.Job<T> & {
	data: T;
	returnvalue: R;
	finishedOn: number;
};

/**
 * Bull Job with failure (failed job)
 * Use for jobs that have failed
 */
export type BullFailedJob<T = ScrapeJobData> = Bull.Job<T> & {
	data: T;
	failedReason: string;
	stacktrace: string[];
};

/**
 * Scraper-specific job type
 * Most common job type in the system
 */
export type ScraperJob = BullJob<ScrapeJobData>;

/**
 * Scraper job with guaranteed data
 */
export type ScraperJobWithData = BullJobWithData<ScrapeJobData>;

/**
 * Completed scraper job with result
 */
export type CompletedScraperJob = BullCompletedJob<
	ScrapeJobData,
	ScrapeJobResult
>;

/**
 * Failed scraper job with error details
 */
export type FailedScraperJob = BullFailedJob<ScrapeJobData>;

/**
 * Job counts by status
 * Used in queue status scripts
 */
export interface JobCounts {
	waiting: number;
	active: number;
	completed: number;
	failed: number;
	delayed: number;
	paused: number;
}

/**
 * Job priority levels
 * Bull uses 1 (highest) to 10 (lowest), default is 3
 */
export type JobPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Job options with common settings
 */
export interface JobOptions {
	priority?: JobPriority;
	delay?: number;
	attempts?: number;
	removeOnComplete?: boolean | number;
	removeOnFail?: boolean | number;
}

/**
 * Error tracking for failed jobs
 * Used in requeue scripts to categorize failures
 */
export interface ErrorStats {
	errorType: string;
	errorMessage: string;
	count: number;
	firstSeen: Date;
	lastSeen: Date;
	jobIds: string[];
}

/**
 * Type guard to check if a job has completed successfully
 */
export function isCompletedJob<T, R>(
	job: Bull.Job<T>,
): job is BullCompletedJob<T, R> {
	return (
		job.finishedOn !== null &&
		job.finishedOn !== undefined &&
		job.returnvalue !== null
	);
}

/**
 * Type guard to check if a job has failed
 */
export function isFailedJob<T>(job: Bull.Job<T>): job is BullFailedJob<T> {
	return job.failedReason !== null && job.failedReason !== undefined;
}

/**
 * Type guard to check if a job has data
 */
export function hasJobData<T>(
	job: Bull.Job<T> | undefined | null,
): job is BullJobWithData<T> {
	return (
		job !== null &&
		job !== undefined &&
		job.data !== null &&
		job.data !== undefined
	);
}
