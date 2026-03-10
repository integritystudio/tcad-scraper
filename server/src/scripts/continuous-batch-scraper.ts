import type { Prisma } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import { SearchTermDeduplicator } from "../lib/search-term-deduplicator";
import { scraperQueue } from "../queues/scraper.queue";
import {
	type SearchTermOptimizer,
	searchTermOptimizer,
} from "../services/search-term-optimizer";
import logger from "../lib/logger";
import { getErrorMessage } from "../utils/error-helpers";
import { HIGH_RESULT_TERM_SPLITS } from "./config/batch-configs";
import { enqueueBatch } from "./lib/queue-utils";
import { TARGET_2025_PROPERTY_COUNT } from "./lib/backfill-constants";

// Operational stop threshold — scraper halts when DB reaches this count.
// Not the full dataset ceiling (~451K total Travis County parcels); set lower
// to leave headroom for duplicate records and future growth.
const STOP_AT_PROPERTIES = 500000;
const MAX_CONSECUTIVE_ZERO_BATCHES = 3;
const BATCH_SIZE = 25;
const DELAY_BETWEEN_BATCHES = 30000;
const CHECK_INTERVAL = 60000;

// Curated fallback terms for when DB candidates are exhausted.
// 198 proven terms from first names, last names, geographic, entity, and neighborhood categories.
export const FALLBACK_TERMS: readonly string[] = [
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
	// Unsearched first names (curated 5-char list)
	"Devin", "Diego", "Dolly", "Doris", "Dulce", "Dusty", "Dwain", "Earle",
	"Ebony", "Eddie", "Edwin", "Efren", "Eldon", "Elena", "Elisa", "Elise",
	"Ellie", "Elsie", "Elton", "Elvis", "Emile", "Erica", "Ernie", "Essie",
	"Ethel", "Faith", "Fanny", "Fidel", "Fiona", "Frida", "Garry", "Gavin",
	"Gemma", "Gerri", "Ginny", "Gopal", "Greta", "Heidi", "Homer", "Ilene",
	"Irene", "Isael", "Janie", "Jared", "Jenna", "Jenny", "Jewel", "Jimmy",
	"Johan", "Jorge", "Juana", "Jules", "Jyoti", "Karin", "Katie", "Kavya",
	"Kayla", "Klaus", "Laila", "Lance", "Layne", "Lenny", "Leroy", "Linus",
	"Lonny", "Loren", "Lorna", "Lucia", "Luisa", "Luigi", "Lydia", "Lynda",
	"Mabel", "Macie", "Madge", "Mandy", "Manny", "Marco", "Marge", "Marla",
	"Mateo", "Maude", "Maura", "Meena", "Mercy", "Merry", "Midge", "Miley",
	"Millie", "Mindy", "Mirna", "Misty", "Mitch", "Moira", "Molly", "Monte",
	"Monty", "Myrna", "Nabil", "Nadia", "Naomi", "Neha", "Nelly", "Nesta",
	"Nigel", "Nicky", "Nikki", "Nilda", "Nisha", "Nitin", "Norma", "Pablo",
	"Paige", "Pansy", "Patsy", "Patty", "Paula", "Pavan", "Pearl", "Peggy",
	"Penny", "Percy", "Pooja", "Polly", "Priya", "Radha", "Randi", "Raoul",
	"Reece", "Reema", "Reina", "Renee", "Rhoda", "Ricky", "Rocio", "Rocky",
	"Ronda", "Rosie", "Rowan", "Roxie", "Rufus", "Rusty", "Sadie", "Sagar",
	"Sally", "Sandy", "Seema", "Selma", "Serge", "Shane", "Shana", "Shari",
	"Sheri", "Sonia", "Sonja", "Sonya", "Sonny", "Stacy", "Sunil", "Suraj",
	"Susie", "Swati", "Tamra", "Tanya", "Tasha", "Teddy", "Terri", "Tessa",
	"Theda", "Tiana", "Tisha", "Tommy", "Tonya", "Trent", "Trish", "Trudy",
	"Varun", "Vicki", "Vijay", "Vikki", "Vince", "Viola", "Vivek", "Wally",
	"Wanda", "Wendy", "Zelda", "Zelma",
	// Unsearched last names (curated lists)
	"Navra", "Oakes", "Ogden", "Plant", "Platt", "Power", "Prine", "Pryor",
	"Rains", "Reeve", "Ricks", "Roper", "Rouse", "Sales", "Sands", "Selby",
	"Sells", "Sheen", "Small", "Stack", "Stern", "Stock", "Stowe", "Suggs",
	"Thiel", "Tobin", "Truax", "Tubbs", "Varga", "Wages", "Wendt", "Worth",
	"Wyman",
] as const;

export interface TermSelectorConfig {
	tiers: Prisma.SearchTermAnalyticsWhereInput[];
	applyHighResultSplits: boolean;
}

const STANDARD_TIER_CONFIG: TermSelectorConfig = {
	tiers: [
		{ totalSearches: 1, successRate: 1, avgResultsPerSearch: { gte: 500 } },
		{ totalSearches: 1, successRate: 1, avgResultsPerSearch: { gte: 100 } },
		{ totalSearches: { lte: 2 }, successRate: { gte: 0.4 }, avgResultsPerSearch: { gte: 1000 } },
	],
	applyHighResultSplits: true,
};

export const LOW_THRESHOLD_TIER_CONFIG: TermSelectorConfig = {
	tiers: [
		{ totalSearches: 1, successRate: 1, avgResultsPerSearch: { gte: 20 } },
		{ totalSearches: { lte: 2 }, successRate: { gte: 0.5 }, avgResultsPerSearch: { gte: 20 } },
		{ totalSearches: { lte: 3 }, successRate: { gte: 0.3 }, avgResultsPerSearch: { gte: 50 } },
	],
	applyHighResultSplits: false,
};

/**
 * DB-driven term selector that picks search terms by performance tiers.
 *
 * Tier 1–3: configurable where-clauses (defaults to STANDARD_TIER_CONFIG)
 * Tier 4: Fallback pool of never-searched terms from FALLBACK_TERMS
 *
 * Pass LOW_THRESHOLD_TIER_CONFIG to lower thresholds for long-tail scraping.
 */
const CACHE_REFRESH_INTERVAL_BATCHES = 20;

export class TermSelector {
	private enqueuedTerms = new Set<string>();
	private deduplicator = new SearchTermDeduplicator();
	private optimizer: SearchTermOptimizer;
	private config: TermSelectorConfig;
	private blacklistLoaded = false;
	private queueSeeded = false;
	private cachedPropertyTermSet: Set<string> | null = null;
	private cachedAllSearchedTermSet: Set<string> | null = null;
	private batchCount = 0;

	constructor(config?: TermSelectorConfig, optimizer?: SearchTermOptimizer) {
		this.config = config ?? STANDARD_TIER_CONFIG;
		this.optimizer = optimizer ?? searchTermOptimizer;
	}

	async getNextBatch(size: number): Promise<string[]> {
		this.batchCount++; // always >= 1 by the time the modulo check fires
		if (this.batchCount % CACHE_REFRESH_INTERVAL_BATCHES === 0) {
			this.cachedPropertyTermSet = null;
			this.cachedAllSearchedTermSet = null;
			logger.info(`Cache invalidated after ${this.batchCount} batches`);
		}
		await this.loadBlacklist();
		await this.seedFromQueue();
		// Both sets are fetched explicitly even though getAllSearchedTermSet() calls
		// getPropertyTermSet() internally. The direct call to getPropertyTermSet() ensures the
		// property cache is warm before tier queries use it for dedup, while getAllSearchedTermSet()
		// also needs the property set to build its union. Both are cheap on repeat invocations
		// because each uses its own cache guard.
		const propertyTerms = await this.getPropertyTermSet();
		const allSearched = await this.getAllSearchedTermSet();

		const batch: string[] = [];

		for (const tierWhere of this.config.tiers) {
			if (batch.length >= size) break;
			const tierResults = await this.queryTier(tierWhere, size - batch.length, propertyTerms);
			batch.push(...tierResults);
		}

		// Tier 4: fallback — never-searched terms from curated list
		if (batch.length < size) {
			for (const term of FALLBACK_TERMS) {
				if (batch.length >= size) break;
				if (this.enqueuedTerms.has(term)) continue;
				if (allSearched.has(term.toLowerCase())) continue;
				if (this.deduplicator.shouldSkipTerm(term)) continue;

				this.enqueuedTerms.add(term);
				this.deduplicator.markTermAsUsed(term);
				batch.push(term);
			}
		}

		// Expand high-result terms to narrower sub-queries to prevent truncation.
		// e.g. "Oak" (7210 avg results) → ["Oak Hill", "Oakwood", "Oak Run", ...]
		// Keys must match DB casing exactly (Map lookup is case-sensitive).
		const expanded: string[] = [];
		for (const term of batch) {
			const splits = this.config.applyHighResultSplits ? HIGH_RESULT_TERM_SPLITS.get(term) : undefined;
			if (splits) {
				let added = 0;
				for (const split of splits) {
					if (this.enqueuedTerms.has(split)) continue;
					if (allSearched.has(split.toLowerCase())) continue;
					// Do NOT add to enqueuedTerms yet — defer until after slice to avoid
					// marking trimmed splits as used when expansion overshoots size.
					expanded.push(split);
					added++;
				}
				if (added > 0) {
					logger.info(`Expanded high-result term "${term}" → ${added} sub-queries`);
				} else {
					logger.info(`High-result term "${term}" all splits already searched; slot dropped`);
				}
				// Parent term stays in enqueuedTerms to prevent future re-selection
			} else {
				expanded.push(term);
			}
		}

		// Trim to requested size — expansion can produce more terms than size when
		// multiple high-result terms are selected in the same batch.
		// Mark splits as enqueued only after trimming so overshoots don't block future batches.
		// Non-split terms are already in enqueuedTerms from queryTier/fallback; re-adding is a no-op.
		const result = expanded.slice(0, size);
		for (const term of result) {
			this.enqueuedTerms.add(term);
		}

		if (result.length > 0) {
			logger.info(`Selected ${result.length} terms: ${result.slice(0, 5).join(", ")}${result.length > 5 ? "..." : ""}`);
		} else {
			logger.warn("No candidate terms available from any tier or fallback");
		}

		return result;
	}

	private async queryTier(
		where: Prisma.SearchTermAnalyticsWhereInput,
		limit: number,
		searched: Set<string>,
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
			if (searched.has(term.toLowerCase())) continue;
			if (this.deduplicator.shouldSkipTerm(term)) continue;

			this.enqueuedTerms.add(term);
			this.deduplicator.markTermAsUsed(term);
			picked.push(term);
		}
		return picked;
	}

	private async seedFromQueue(): Promise<void> {
		if (this.queueSeeded) return;
		try {
			const [waiting, active] = await Promise.all([
				scraperQueue.getWaiting(),
				scraperQueue.getActive(),
			]);
			let seeded = 0;
			for (const job of [...waiting, ...active]) {
				const term = job.data?.searchTerm;
				if (term && !this.enqueuedTerms.has(term)) {
					this.enqueuedTerms.add(term);
					seeded++;
				}
			}
			if (seeded > 0) {
				logger.info(`Seeded ${seeded} in-flight terms from queue`);
			}
		} catch (error) {
			logger.warn(`Failed to seed from queue: ${getErrorMessage(error)}`);
		}
		this.queueSeeded = true;
	}

	private async getPropertyTermSet(): Promise<Set<string>> {
		if (this.cachedPropertyTermSet) return this.cachedPropertyTermSet;

		const propertyTerms = await prisma.property.groupBy({
			by: ["searchTerm"],
			where: { year: config.scraper.tcadYear, searchTerm: { not: null } },
		});
		const set = new Set<string>();
		for (const r of propertyTerms) {
			if (r.searchTerm) set.add(r.searchTerm.toLowerCase());
		}
		this.cachedPropertyTermSet = set;
		return set;
	}

	private async getAllSearchedTermSet(): Promise<Set<string>> {
		if (this.cachedAllSearchedTermSet) return this.cachedAllSearchedTermSet;

		const [analyticsRows, propertyTerms] = await Promise.all([
			prisma.searchTermAnalytics.findMany({
				select: { searchTerm: true },
			}),
			this.getPropertyTermSet(),
		]);
		const set = new Set<string>(propertyTerms);
		for (const r of analyticsRows) set.add(r.searchTerm.toLowerCase());
		this.cachedAllSearchedTermSet = set;
		return set;
	}

	private async loadBlacklist(): Promise<void> {
		if (this.blacklistLoaded) return;
		try {
			const blacklisted = await this.optimizer.getBlacklistedTerms(3);
			for (const term of blacklisted) {
				this.deduplicator.forceBlacklist(term);
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
	private readonly lowThreshold: boolean;
	private readonly stopAtProperties: number;
	private readonly userId: string;
	private termSelector: TermSelector;
	private stats = {
		totalQueued: 0,
		batchesProcessed: 0,
		startTime: Date.now(),
		startingPropertyCount: 0,
	};
	private running = true;
	private monitorInterval: ReturnType<typeof setInterval> | null = null;
	private consecutiveZeroBatches = 0;
	private lastPropertyCount = 0;

	constructor(lowThreshold = false) {
		this.lowThreshold = lowThreshold;
		this.stopAtProperties = lowThreshold ? TARGET_2025_PROPERTY_COUNT : STOP_AT_PROPERTIES;
		this.userId = lowThreshold ? "lowthreshold-batch" : "continuous-batch";
		this.termSelector = new TermSelector(lowThreshold ? LOW_THRESHOLD_TIER_CONFIG : undefined);
	}

	async run() {
		if (this.lowThreshold) {
			logger.info("=============================================");
			logger.info("  LOW-THRESHOLD CONTINUOUS SCRAPER (long tail)");
			logger.info("=============================================\n");
		} else {
			logger.info("========================================");
			logger.info("  CONTINUOUS BATCH SCRAPER (DB-driven)  ");
			logger.info("========================================\n");
		}

		// Clear pending jobs from queue to start fresh
		const pendingCount = await scraperQueue.getWaitingCount();
		if (pendingCount > 0) {
			await scraperQueue.clean(0, "wait");
			logger.info(`Cleared ${pendingCount} pending jobs`);
		}

		this.stats.startingPropertyCount = await prisma.property.count({ where: { year: config.scraper.tcadYear } });
		this.lastPropertyCount = this.stats.startingPropertyCount;
		logger.info(`Starting: ${this.stats.startingPropertyCount.toLocaleString()}`);
		logger.info(`Stop at: ${this.stopAtProperties.toLocaleString()} or ${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive zero-result batches`);
		logger.info(`Remaining: ${(this.stopAtProperties - this.stats.startingPropertyCount).toLocaleString()}\n`);

		process.on("SIGINT", () => this.stop());
		process.on("SIGTERM", () => this.stop());

		this.startMonitoring();

		while (this.running) {
			const currentCount = await prisma.property.count({ where: { year: config.scraper.tcadYear } });

			if (currentCount >= this.stopAtProperties) {
				logger.info(`STOP TARGET REACHED! Current count: ${currentCount.toLocaleString()}`);
				break;
			}

			// Track consecutive batches with zero new properties
			const newSinceLastCheck = currentCount - this.lastPropertyCount;
			if (this.stats.batchesProcessed > 0 && newSinceLastCheck === 0) {
				this.consecutiveZeroBatches++;
				logger.warn(`Zero new properties (${this.consecutiveZeroBatches}/${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive)`);
				if (this.consecutiveZeroBatches >= MAX_CONSECUTIVE_ZERO_BATCHES) {
					logger.info(`STOPPING: ${MAX_CONSECUTIVE_ZERO_BATCHES} consecutive batches with zero new properties`);
					break;
				}
			} else if (newSinceLastCheck > 0) {
				this.consecutiveZeroBatches = 0;
			}
			this.lastPropertyCount = currentCount;

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
		await prisma.$disconnect();
		process.exit(0);
	}

	private async queueBatch() {
		const searchTerms = await this.termSelector.getNextBatch(BATCH_SIZE);
		this.stats.batchesProcessed++;

		logger.info(`Batch #${this.stats.batchesProcessed} (${searchTerms.length} terms)`);

		const enqueued = await enqueueBatch(searchTerms, this.userId, logger);
		this.stats.totalQueued += enqueued;

		logger.info(`Queued ${enqueued} jobs (Total: ${this.stats.totalQueued})`);
	}

	private startMonitoring() {
		this.monitorInterval = setInterval(async () => {
			try {
				const [currentCount, waiting, active, completed, failed] =
					await Promise.all([
						prisma.property.count({ where: { year: config.scraper.tcadYear } }),
						scraperQueue.getWaitingCount(),
						scraperQueue.getActiveCount(),
						scraperQueue.getCompletedCount(),
						scraperQueue.getFailedCount(),
					]);

				const newProperties = currentCount - this.stats.startingPropertyCount;
				const progress = (currentCount / this.stopAtProperties) * 100;
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
					const remaining = this.stopAtProperties - currentCount;
					const hoursRemaining = remaining / rate / 60;
					logger.info(`ETA: ${hoursRemaining.toFixed(1)} hours`);
				}
			} catch (error) {
				logger.error(`Monitoring error: ${getErrorMessage(error)}`);
			}
		}, CHECK_INTERVAL);
	}

	private async printFinalReport() {
		const finalCount = await prisma.property.count({ where: { year: config.scraper.tcadYear } });
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
		if (this.monitorInterval !== null) {
			clearInterval(this.monitorInterval);
			this.monitorInterval = null;
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// Run when invoked directly (not when imported by tests)
if (require.main === module) {
	const lowThreshold = process.argv.includes("--low-threshold");
	const scraper = new ContinuousBatchScraper(lowThreshold);
	scraper.run().catch((error) => {
		logger.error(`Fatal error: ${getErrorMessage(error)}`);
		process.exit(1);
	});
}
