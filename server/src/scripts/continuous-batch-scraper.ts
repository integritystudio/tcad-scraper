import winston from "winston";
import { prisma } from "../lib/prisma";
import { SearchTermDeduplicator } from "../lib/search-term-deduplicator";
import { scraperQueue } from "../queues/scraper.queue";
import {
	type SearchTermOptimizer,
	searchTermOptimizer,
} from "../services/search-term-optimizer";
import { getErrorMessage } from "../utils/error-helpers";

const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.simple(),
	),
	transports: [
		new winston.transports.Console(),
		new winston.transports.File({ filename: "logs/continuous-scraper.log" }),
	],
});

const TARGET_PROPERTIES = 451339;
const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES = 30000;
const CHECK_INTERVAL = 60000;

// Curated fallback terms for when DB candidates are exhausted.
// 198 proven terms from first names, last names, geographic, entity, and neighborhood categories.
const FALLBACK_TERMS: readonly string[] = [
	// First names (proven high-yield)
	"Joseph", "Taylor", "Charles", "Carol", "Steven", "Juan", "James", "Mary",
	"John", "Patricia", "Robert", "Elizabeth", "David", "Barbara", "Richard",
	"Susan", "Thomas", "Sarah", "Daniel", "Lisa", "Matthew", "Anthony", "Mark",
	"Donald", "Andrew", "Joshua", "Kenneth", "Kevin", "Brian", "George",
	"Edward", "Ronald", "Timothy", "Jason", "Jeffrey", "Ryan", "Jacob", "Gary",
	"Nicholas", "Eric", "Jonathan", "Stephen", "Larry", "Justin", "Scott",
	"Brandon", "Benjamin", "Samuel", "Raymond", "Gregory",
	// Last names (common Travis County, 4+ chars)
	"Smith", "Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis",
	"Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson",
	"Anderson", "Moore", "Jackson", "Martin", "Thompson",
	"White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
	"Walker", "Young", "Allen", "Wright", "Torres", "Nguyen",
	"Flores", "Green", "Adams", "Nelson", "Baker", "Rivera", "Campbell",
	"Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner",
	"Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart",
	"Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz",
	"Morgan", "Cooper", "Peterson", "Bailey", "Reed", "Howard", "Ramos",
	"Watson", "Brooks", "Chavez", "Bennett", "Mendoza", "Ruiz", "Hughes",
	"Price", "Alvarez", "Castillo", "Sanders", "Patel",
	// Geographic / street terms
	"Hill", "Lake", "Canyon", "Valley", "Forest", "Ranch", "Ridge", "Cave",
	"Park", "Glen", "Dale", "Ford", "Cove", "Rock", "Wood", "Farm", "Mill",
	"Pond", "Peak", "Creek", "Spring", "Bluff", "Meadow", "Grove", "Trail",
	"Vista", "Harbor", "Knoll", "Prairie", "Summit",
	// Entity terms
	"Trustee", "Holdings", "Partners", "Group", "Realty", "LLC", "Trust",
	"Estate of", "Foundation", "Investments", "Properties", "Association",
	"Capital", "Development", "Inc", "Corp", "Limited", "Company",
	"Partnership", "Charitable",
	// Neighborhoods / subdivisions
	"Barton", "Westlake", "Mueller", "Zilker", "Allandale", "Crestview",
	"Rosedale", "Tarrytown", "Brentwood", "Balcones", "Cherrywood",
	"Rollingwood", "Bouldin", "Hancock", "Windsor", "Gracywoods",
	"Spicewood", "Eanes", "Belterra", "Falconhead",
] as const;

/**
 * DB-driven term selector that picks search terms by performance tiers.
 *
 * Tier 1: totalSearches=1, successRate=1, avgResultsPerSearch >= 500
 * Tier 2: totalSearches=1, successRate=1, avgResultsPerSearch >= 100
 * Tier 3: totalSearches<=2, successRate>=0.4, avgResultsPerSearch >= 1000
 * Tier 4: Fallback pool of never-searched terms from FALLBACK_TERMS
 */
export class TermSelector {
	private enqueuedTerms = new Set<string>();
	private deduplicator = new SearchTermDeduplicator();
	private optimizer: SearchTermOptimizer;
	private blacklistLoaded = false;

	constructor(optimizer?: SearchTermOptimizer) {
		this.optimizer = optimizer ?? searchTermOptimizer;
	}

	async getNextBatch(size: number): Promise<string[]> {
		await this.loadBlacklist();

		const batch: string[] = [];

		// Tier 1: single-search high-result terms (500+ avg)
		if (batch.length < size) {
			const tier1 = await this.queryTier({
				totalSearches: 1,
				successRate: 1,
				avgResultsPerSearch: { gte: 500 },
			}, size - batch.length);
			batch.push(...tier1);
		}

		// Tier 2: single-search moderate-result terms (100+ avg)
		if (batch.length < size) {
			const tier2 = await this.queryTier({
				totalSearches: 1,
				successRate: 1,
				avgResultsPerSearch: { gte: 100 },
			}, size - batch.length);
			batch.push(...tier2);
		}

		// Tier 3: low-search high-result terms (re-scrape candidates)
		if (batch.length < size) {
			const tier3 = await this.queryTier({
				totalSearches: { lte: 2 },
				successRate: { gte: 0.4 },
				avgResultsPerSearch: { gte: 1000 },
			}, size - batch.length);
			batch.push(...tier3);
		}

		// Tier 4: fallback — never-searched terms from curated list
		if (batch.length < size) {
			const searched = await this.getSearchedTermSet();
			for (const term of FALLBACK_TERMS) {
				if (batch.length >= size) break;
				if (this.enqueuedTerms.has(term)) continue;
				if (searched.has(term.toLowerCase())) continue;
				if (this.deduplicator.shouldSkipTerm(term)) continue;

				this.enqueuedTerms.add(term);
				this.deduplicator.markTermAsUsed(term);
				batch.push(term);
			}
		}

		if (batch.length > 0) {
			logger.info(`Selected ${batch.length} terms: ${batch.slice(0, 5).join(", ")}${batch.length > 5 ? "..." : ""}`);
		} else {
			logger.warn("No candidate terms available from any tier or fallback");
		}

		return batch;
	}

	private async queryTier(
		where: Record<string, unknown>,
		limit: number,
	): Promise<string[]> {
		const results = await prisma.searchTermAnalytics.findMany({
			where,
			orderBy: { avgResultsPerSearch: "desc" },
			select: { searchTerm: true },
			take: limit * 3, // over-fetch to account for filtering
		});

		const picked: string[] = [];
		for (const row of results) {
			if (picked.length >= limit) break;
			const term = row.searchTerm;
			if (this.enqueuedTerms.has(term)) continue;
			if (this.deduplicator.shouldSkipTerm(term)) continue;

			this.enqueuedTerms.add(term);
			this.deduplicator.markTermAsUsed(term);
			picked.push(term);
		}
		return picked;
	}

	private async getSearchedTermSet(): Promise<Set<string>> {
		const rows = await prisma.searchTermAnalytics.findMany({
			select: { searchTerm: true },
		});
		return new Set(rows.map((r) => r.searchTerm.toLowerCase()));
	}

	private async loadBlacklist(): Promise<void> {
		if (this.blacklistLoaded) return;
		try {
			const blacklisted = await this.optimizer.getBlacklistedTerms(3);
			for (const term of blacklisted) {
				// 3 failures = blacklisted in deduplicator
				this.deduplicator.markTermFailed(term);
				this.deduplicator.markTermFailed(term);
				this.deduplicator.markTermFailed(term);
			}
			if (blacklisted.length > 0) {
				logger.info(`Blacklisted ${blacklisted.length} zero-yield terms`);
			}
		} catch (error) {
			logger.warn(`Failed to load blacklist: ${getErrorMessage(error)}`);
		}

		try {
			const overSearched = await this.optimizer.getOverSearchedTerms(5);
			for (const term of overSearched) {
				this.enqueuedTerms.add(term);
			}
			if (overSearched.length > 0) {
				logger.info(`Marked ${overSearched.length} over-searched terms as used`);
			}
		} catch (error) {
			logger.warn(`Failed to load over-searched terms: ${getErrorMessage(error)}`);
		}

		this.blacklistLoaded = true;
	}
}

class ContinuousBatchScraper {
	private termSelector = new TermSelector();
	private stats = {
		totalQueued: 0,
		batchesProcessed: 0,
		startTime: Date.now(),
		startingPropertyCount: 0,
	};
	private running = true;

	async run() {
		logger.info("========================================");
		logger.info("  CONTINUOUS BATCH SCRAPER (DB-driven)  ");
		logger.info("========================================\n");

		// Clear pending jobs from queue to start fresh
		const pendingCount = await scraperQueue.getWaitingCount();
		if (pendingCount > 0) {
			await scraperQueue.clean(0, "wait");
			logger.info(`Cleared ${pendingCount} pending jobs`);
		}

		this.stats.startingPropertyCount = await prisma.property.count();
		logger.info(`Starting: ${this.stats.startingPropertyCount.toLocaleString()}`);
		logger.info(`Target: ${TARGET_PROPERTIES.toLocaleString()}`);
		logger.info(`Remaining: ${(TARGET_PROPERTIES - this.stats.startingPropertyCount).toLocaleString()}\n`);

		process.on("SIGINT", () => this.stop());
		process.on("SIGTERM", () => this.stop());

		this.startMonitoring();

		while (this.running) {
			const currentCount = await prisma.property.count();
			if (currentCount >= TARGET_PROPERTIES) {
				logger.info(`TARGET REACHED! Current count: ${currentCount.toLocaleString()}`);
				break;
			}

			const [waiting, active] = await Promise.all([
				scraperQueue.getWaitingCount(),
				scraperQueue.getActiveCount(),
			]);

			if (waiting + active < 100) {
				await this.queueBatch();
			} else {
				logger.info(`Queue full (${waiting} waiting, ${active} active). Waiting...`);
			}

			await this.delay(DELAY_BETWEEN_BATCHES);
		}

		await this.printFinalReport();
		process.exit(0);
	}

	private async queueBatch() {
		const searchTerms = await this.termSelector.getNextBatch(BATCH_SIZE);
		this.stats.batchesProcessed++;

		logger.info(`Batch #${this.stats.batchesProcessed} (${searchTerms.length} terms)`);

		for (const searchTerm of searchTerms) {
			try {
				await scraperQueue.add(
					"scrape-properties",
					{
						searchTerm,
						userId: "continuous-batch",
						scheduled: true,
					},
					{
						attempts: 3,
						backoff: { type: "exponential", delay: 2000 },
						removeOnComplete: 100,
						removeOnFail: 50,
					},
				);
				this.stats.totalQueued++;
			} catch (error) {
				logger.error(`Failed to queue ${searchTerm}: ${getErrorMessage(error)}`);
			}
		}

		logger.info(`Queued ${searchTerms.length} jobs (Total: ${this.stats.totalQueued})`);
	}

	private startMonitoring() {
		setInterval(async () => {
			try {
				const [currentCount, waiting, active, completed, failed] =
					await Promise.all([
						prisma.property.count(),
						scraperQueue.getWaitingCount(),
						scraperQueue.getActiveCount(),
						scraperQueue.getCompletedCount(),
						scraperQueue.getFailedCount(),
					]);

				const newProperties = currentCount - this.stats.startingPropertyCount;
				const progress = (currentCount / TARGET_PROPERTIES) * 100;
				const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
				const hours = Math.floor(elapsed / 3600);
				const minutes = Math.floor((elapsed % 3600) / 60);
				const rate = newProperties / (elapsed / 60);

				logger.info(
					`[${hours}h ${minutes}m] ${progress.toFixed(2)}% | ` +
					`DB: ${currentCount.toLocaleString()} (+${newProperties.toLocaleString()}) | ` +
					`Queue: ${waiting}w/${active}a/${completed}c/${failed}f | ` +
					`${rate.toFixed(1)} props/min`,
				);

				if (rate > 0) {
					const remaining = TARGET_PROPERTIES - currentCount;
					const hoursRemaining = remaining / rate / 60;
					logger.info(`ETA: ${hoursRemaining.toFixed(1)} hours`);
				}
			} catch (error) {
				logger.error(`Monitoring error: ${getErrorMessage(error)}`);
			}
		}, CHECK_INTERVAL);
	}

	private async printFinalReport() {
		const finalCount = await prisma.property.count();
		const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
		const hours = Math.floor(elapsed / 3600);
		const minutes = Math.floor((elapsed % 3600) / 60);

		logger.info("\n=== FINAL REPORT ===");
		logger.info(`Runtime: ${hours}h ${minutes}m`);
		logger.info(`Starting: ${this.stats.startingPropertyCount.toLocaleString()}`);
		logger.info(`Final: ${finalCount.toLocaleString()}`);
		logger.info(`Added: ${(finalCount - this.stats.startingPropertyCount).toLocaleString()}`);
		logger.info(`Jobs queued: ${this.stats.totalQueued.toLocaleString()}`);
		logger.info(`Batches: ${this.stats.batchesProcessed}`);
	}

	private stop() {
		logger.info("Stopping continuous scraper...");
		this.running = false;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// Run when invoked directly (not when imported by tests)
const isDirectRun =
	process.argv[1]?.endsWith("continuous-batch-scraper.ts") ||
	process.argv[1]?.endsWith("continuous-batch-scraper.js");

if (isDirectRun) {
	const scraper = new ContinuousBatchScraper();
	scraper.run().catch((error) => {
		logger.error(`Fatal error: ${getErrorMessage(error)}`);
		process.exit(1);
	});
}
