/**
 * Queue Results — show recent scrape jobs + property count from the Workers API.
 *
 * Usage: npx tsx scripts/queue-results.ts [--limit N]
 */

import { runMain } from "./lib/run-main";

const API_BASE = "https://api.alephatx.info/api/properties";

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100; // API max for /history?limit=

const rawLimit = Number(
	process.argv.find((_, i, a) => a[i - 1] === "--limit") ?? DEFAULT_LIMIT,
);
const limit = Number.isFinite(rawLimit)
	? Math.min(Math.max(Math.trunc(rawLimit), MIN_LIMIT), MAX_LIMIT)
	: DEFAULT_LIMIT;

interface ScrapeJob {
	id: string;
	searchTerm: string;
	status: string;
	resultCount: number | null;
	error: string | null;
	startedAt: string;
	completedAt: string | null;
}

interface HistoryResponse {
	data: ScrapeJob[];
	pagination: { total: number };
}

interface StatsResponse {
	totalProperties: number;
	totalJobs: number;
	recentJobs: number;
}

function formatDate(value: string | null): string {
	if (!value || value === "0") return "N/A";
	// Accepts ISO 8601 or epoch-ms strings (pre-ISO-migration API responses)
	const iso = /^\d+$/.test(value)
		? new Date(Number(value)).toISOString()
		: value;
	return iso.replace("T", " ").slice(0, 19);
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`GET ${url} failed: HTTP ${res.status} ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}

async function main() {
	const [stats, history] = await Promise.all([
		fetchJson<StatsResponse>(`${API_BASE}/stats`),
		fetchJson<HistoryResponse>(`${API_BASE}/history?limit=${limit}`),
	]);

	const jobs = history.data;
	const byStatus = new Map<string, number>();
	for (const j of jobs) {
		byStatus.set(j.status, (byStatus.get(j.status) ?? 0) + 1);
	}

	console.log("Job totals:", {
		allTime: stats.totalJobs,
		last24h: stats.recentJobs,
	});
	console.log(
		`Last ${jobs.length} jobs by status:`,
		Object.fromEntries(byStatus),
	);
	console.log("Properties:", stats.totalProperties);
	console.log();

	const completed = jobs.filter((j) => j.status === "completed");
	if (completed.length) {
		console.log(`Completed jobs (last ${completed.length}):`);
		console.log(`  ${"Term".padEnd(22)}${"Props".padStart(6)}  Finished`);
		console.log(`  ${"-".repeat(60)}`);
		for (const j of completed) {
			const term = (j.searchTerm || "").padEnd(22);
			const props = String(j.resultCount ?? 0).padStart(6);
			console.log(`  ${term}${props}  ${formatDate(j.completedAt)}`);
		}
	} else {
		console.log("No completed jobs in recent history.");
	}

	const failed = jobs.filter((j) => j.status === "failed");
	if (failed.length) {
		console.log();
		console.log(`Failed jobs (last ${failed.length}):`);
		console.log(`  ${"Term".padEnd(22)}Error`);
		console.log(`  ${"-".repeat(60)}`);
		for (const j of failed) {
			const term = (j.searchTerm || "").padEnd(22);
			console.log(`  ${term}${j.error || "unknown"}`);
		}
	}
}

runMain(main, { disconnectPrisma: false });
