type Id = string | number;

export interface SearchResponse<T> {
	items: T[];
	/** Total matches if the API provides it (best-case) */
	total?: number;
	/**
	 * True if results are incomplete/truncated for this query.
	 * If your API doesn't provide it, we'll infer truncation from paging behavior.
	 */
	truncated?: boolean;
}

export interface SearchClient<T> {
	/**
	 * Return one page of search results.
	 * page is 0-based.
	 */
	search(
		query: string,
		page: number,
		pageSize: number,
	): Promise<SearchResponse<T>>;
	/** Extract stable unique ID from an item */
	getId(item: T): Id;
}

export interface ExploreOptions {
	/** Minimum query length constraint; per your requirement this should be 4 */
	minQueryLen?: number; // default 4
	/** Maximum prefix length to prevent infinite expansion */
	maxPrefixLen?: number; // default 20
	/** Page size for API calls */
	pageSize?: number; // default 100
	/** Safety cap on pages per non-truncated query */
	maxPagesPerQuery?: number; // default 200
	/** Characters to use when expanding prefixes */
	alphabet?: string[]; // default a-z0-9
	/**
	 * Seed prefixes: if not provided, we'll generate all length=minQueryLen combos
	 * which can be too many. For large alphabets, pass seeds.
	 */
	seeds?: string[];
	/** Concurrency for queries (keep modest to avoid bans) */
	concurrency?: number; // default 3
	/** Delay between requests in ms (basic politeness / rate limiting) */
	delayMs?: number; // default 100
}

/**
 * Explore a dataset by adaptively partitioning search space with prefixes (>=4 chars).
 * Yields items as they are discovered (deduped by ID).
 */
export async function* exploreByAdaptivePrefixes<T>(
	client: SearchClient<T>,
	opts: ExploreOptions = {},
): AsyncGenerator<T> {
	const minQueryLen = opts.minQueryLen ?? 4;
	const maxPrefixLen = opts.maxPrefixLen ?? 20;
	const pageSize = opts.pageSize ?? 100;
	const maxPagesPerQuery = opts.maxPagesPerQuery ?? 200;
	const concurrency = opts.concurrency ?? 3;
	const delayMs = opts.delayMs ?? 100;

	const alphabet = opts.alphabet ?? [
		..."abcdefghijklmnopqrstuvwxyz",
		..."0123456789",
	];

	// IMPORTANT: Generating *all* 4-char combinations is huge (36^4 = 1,679,616).
	// For real scraping, you usually want seeds (common prefixes, or learned from results).
	// If no seeds provided, we generate a smaller starter set (single-letter buckets)
	// expanded to minQueryLen by padding with a common character (e.g., 'a').
	const seeds =
		opts.seeds && opts.seeds.length > 0
			? opts.seeds
			: alphabet.map((ch) => ch.padEnd(minQueryLen, "a")); // e.g. "a___" -> "aaaa"

	// Queue of prefixes to process (BFS-ish)
	const queue: string[] = [];
	const seenPrefixes = new Set<string>();

	for (const s of seeds) {
		const seed = normalizeQuery(s);
		if (seed.length >= minQueryLen && !seenPrefixes.has(seed)) {
			queue.push(seed);
			seenPrefixes.add(seed);
		}
	}

	// Dedupe items globally
	const seenIds = new Set<Id>();

	// Simple worker pool
	async function sleep(ms: number) {
		if (ms <= 0) return;
		await new Promise((res) => setTimeout(res, ms));
	}

	async function processPrefix(
		prefix: string,
	): Promise<T[] | { expand: string }> {
		// Fetch pages until done, or until we infer truncation.
		const allItems: T[] = [];
		let inferredTruncated = false;

		// First page
		await sleep(delayMs);
		const first = await client.search(prefix, 0, pageSize);

		allItems.push(...first.items);

		// If API tells us it's truncated, expand immediately
		if (first.truncated === true) {
			return { expand: prefix };
		}

		// If API gives total, we can decide precisely:
		// If total > pageSize * maxPagesPerQuery, we should expand (too dense).
		// More importantly, if total > pageSize and paging is allowed, we can page.
		const total = first.total;

		// Decide paging plan
		const shouldPage =
			typeof total === "number"
				? total > first.items.length
				: first.items.length === pageSize;

		if (shouldPage) {
			for (let page = 1; page < maxPagesPerQuery; page++) {
				await sleep(delayMs);
				const resp = await client.search(prefix, page, pageSize);
				allItems.push(...resp.items);

				// Explicit truncation signal at any point => expand
				if (resp.truncated === true) {
					inferredTruncated = true;
					break;
				}

				// No more pages
				if (resp.items.length < pageSize) break;

				// If API provides total, stop when reached
				if (typeof total === "number" && allItems.length >= total) break;

				// If we hit maxPagesPerQuery and still getting full pages, treat as truncated
				if (page === maxPagesPerQuery - 1 && resp.items.length === pageSize) {
					inferredTruncated = true;
				}
			}
		}

		if (inferredTruncated) {
			return { expand: prefix };
		}
		return allItems;
	}

	// Run up to N prefixes concurrently
	while (queue.length > 0) {
		const batch = queue.splice(0, concurrency);

		const results = await Promise.allSettled(batch.map(processPrefix));

		for (let i = 0; i < results.length; i++) {
			const prefix = batch[i];
			const r = results[i];

			if (r.status === "rejected") {
				// TODO: retry with backoff, and/or persist to a dead-letter queue
				console.error(`Prefix "${prefix}" failed:`, r.reason);
				continue;
			}

			const value = r.value;

			// If too dense/truncated, expand by 1 character (if allowed)
			if (isExpandSignal(value)) {
				if (prefix.length >= maxPrefixLen) {
					// We've hit max depth; yield what we can but note: coverage may be incomplete.
					// (You could also switch strategies here: add filters, date ranges, etc.)
					continue;
				}

				for (const ch of alphabet) {
					const next = normalizeQuery(prefix + ch);
					if (next.length >= minQueryLen && !seenPrefixes.has(next)) {
						queue.push(next);
						seenPrefixes.add(next);
					}
				}
				continue;
			}

			// Otherwise we have items for this prefix; yield deduped
			for (const item of value) {
				const id = client.getId(item);
				if (seenIds.has(id)) continue;
				seenIds.add(id);
				yield item;
			}
		}
	}
}

function isExpandSignal<T>(
	v: T[] | { expand: string },
): v is { expand: string } {
	return (
		!Array.isArray(v) && typeof (v as { expand?: unknown }).expand === "string"
	);
}

function normalizeQuery(q: string): string {
	// Normalize however your API expects: trim, lowercase, collapse spaces, etc.
	return q.trim().toLowerCase();
}
