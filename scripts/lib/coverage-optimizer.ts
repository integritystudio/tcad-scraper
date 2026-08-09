/**
 * Greedy maximum-coverage selection of TCAD search terms.
 *
 * The problem: TCAD exposes no way to enumerate a roll year, only full-text
 * search. Covering a year therefore means choosing a set of search terms whose
 * combined results are the whole roll. Terms overlap heavily — "Smith" and
 * "Smit" return almost the same 3,300 properties — so the naive approach
 * (run every term that yielded anything last year) buys the last few percent
 * of coverage at hundreds of redundant scrapes.
 *
 * This module models the problem as maximum coverage and solves it greedily:
 * repeatedly take the term that matches the most *not-yet-covered*
 * properties. Greedy is the standard choice here — max-coverage is NP-hard,
 * and greedy is provably within (1 - 1/e) ≈ 63% of optimal, in practice far
 * closer on data this skewed.
 *
 * ── Modeling TCAD's matcher ─────────────────────────────────────────
 * The index simulates the search semantics established in CLAUDE.md:
 *  - matching is on owner name + address only, never the legal description,
 *    so only those two columns feed the index;
 *  - matching is word-start prefix, so a term matches a property when any of
 *    its words starts with that term;
 *  - a 4-char prefix is a strict superset of every longer word starting with
 *    it, so candidates are generated as 4-char prefixes rather than whole
 *    words — a longer candidate can never cover more than its own prefix;
 *  - hyphens do not break a token ("mo-pac" → 966 matches, "mopa" → 46), so
 *    they are kept inside words;
 *  - bare numeric terms do not search, so all-digit prefixes are dropped.
 *
 * ── What the coverage numbers mean ──────────────────────────────────
 * Coverage is measured against a *model* corpus — the most recent fully
 * scraped year — not against the year being filled. Travis County's roll
 * moves by low single-digit percent year over year, so the term set transfers
 * well, but the reported percentages describe the model, not ground truth.
 * Properties new to the target year are by definition not in the model and
 * are picked up by the tail phases (backfill-novel, enqueue-tail-terms).
 */

import { MIN_TERM_LENGTH } from "../../utils/constants";

/** One property's searchable text, as stored in D1. */
export interface CorpusRow {
	name: string | null;
	property_address: string | null;
}

/** Characters kept inside a word; everything else delimits or is stripped. */
const IN_WORD_CHARS = /^[a-z0-9'-]+$/;
const ALL_DIGITS = /^[0-9]+$/;

/**
 * Split searchable text into TCAD-style words: whitespace-delimited, with
 * hyphens and apostrophes retained inside the token and other punctuation
 * (&, /, parens, commas) trimmed from the edges. Lower-cased.
 */
export function tokenize(text: string | null | undefined): string[] {
	if (!text) return [];
	const words: string[] = [];
	for (const raw of text.toLowerCase().split(/\s+/)) {
		// Trim leading/trailing punctuation but keep interior hyphens.
		const word = raw.replace(/^[^a-z0-9]+/, "").replace(/[^a-z0-9'-]+$/, "");
		if (word && IN_WORD_CHARS.test(word)) words.push(word);
	}
	return words;
}

/**
 * The distinct candidate prefixes a property would be matched by.
 * A word shorter than `prefixLength` yields no candidate — TCAD rejects
 * terms below MIN_TERM_LENGTH, so such a word is unreachable on its own.
 */
export function prefixesForRow(
	row: CorpusRow,
	prefixLength: number = MIN_TERM_LENGTH,
): Set<string> {
	const out = new Set<string>();
	for (const field of [row.name, row.property_address]) {
		for (const word of tokenize(field)) {
			if (word.length < prefixLength) continue;
			const prefix = word.slice(0, prefixLength);
			if (ALL_DIGITS.test(prefix)) continue;
			out.add(prefix);
		}
	}
	return out;
}

export interface CoverageIndex {
	/** Number of properties in the model corpus. */
	propertyCount: number;
	/** Candidate prefix → indices of the properties it matches. */
	postings: Map<string, Int32Array>;
	/** Properties yielding no candidate prefix at all (unreachable by search). */
	unreachableCount: number;
}

export interface BuildIndexOptions {
	prefixLength?: number;
	/** Prefixes to exclude outright (truncation-bug roots, blocked terms, blacklist). */
	excluded?: Set<string>;
	/**
	 * Drop candidates matching fewer than this many properties. Trims the long
	 * tail of one-off prefixes that would never be selected anyway, and keeps
	 * the postings map small enough to hold comfortably in memory.
	 */
	minPostings?: number;
}

export const DEFAULT_MIN_POSTINGS = 2;

/** Build the prefix → properties inverted index over a model corpus. */
export function buildCoverageIndex(
	rows: readonly CorpusRow[],
	opts: BuildIndexOptions = {},
): CoverageIndex {
	const prefixLength = opts.prefixLength ?? MIN_TERM_LENGTH;
	const excluded = opts.excluded ?? new Set<string>();
	const minPostings = opts.minPostings ?? DEFAULT_MIN_POSTINGS;

	const building = new Map<string, number[]>();
	let unreachableCount = 0;

	for (const [i, row] of rows.entries()) {
		const prefixes = prefixesForRow(row, prefixLength);
		if (prefixes.size === 0) {
			unreachableCount++;
			continue;
		}
		for (const prefix of prefixes) {
			if (excluded.has(prefix)) continue;
			const list = building.get(prefix);
			if (list) list.push(i);
			else building.set(prefix, [i]);
		}
	}

	const postings = new Map<string, Int32Array>();
	for (const [prefix, list] of building) {
		if (list.length < minPostings) continue;
		postings.set(prefix, Int32Array.from(list));
	}

	return { propertyCount: rows.length, postings, unreachableCount };
}

export interface SelectedTerm {
	term: string;
	/** Properties this term covers that no earlier term did. */
	newlyCovered: number;
	/** Properties covered by this term and every earlier one. */
	cumulativeCovered: number;
	/** cumulativeCovered / propertyCount. */
	cumulativeFraction: number;
}

/**
 * Mark every property already reachable by a set of terms that have run.
 *
 * Tests each word against every prefix length rather than looking terms up in
 * the 4-char index, because the two are not equivalent: a completed search for
 * "smith" covers a strict *subset* of what the "smit" posting holds, and
 * crediting it with the whole posting would report the roll as covered when
 * every "Smitherman" is still missing. Cost is one set lookup per (word,
 * prefix length), which stays well under a second on a 500k-row corpus.
 */
export function buildCoveredMask(
	rows: readonly CorpusRow[],
	ranTerms: Iterable<string>,
	prefixLength: number = MIN_TERM_LENGTH,
): Uint8Array {
	const ran = new Set<string>();
	for (const term of ranTerms) {
		const lower = term.toLowerCase().trim();
		// Multi-word terms match their tokens independently; any token being
		// a prefix of a word is enough for the property to have been returned.
		for (const token of lower.split(/\s+/)) {
			if (token.length >= prefixLength) ran.add(token);
		}
	}

	const mask = new Uint8Array(rows.length);
	if (ran.size === 0) return mask;

	for (const [i, row] of rows.entries()) {
		let hit = false;
		for (const field of [row.name, row.property_address]) {
			for (const word of tokenize(field)) {
				for (let len = prefixLength; len <= word.length; len++) {
					if (ran.has(word.slice(0, len))) {
						hit = true;
						break;
					}
				}
				if (hit) break;
			}
			if (hit) break;
		}
		if (hit) mask[i] = 1;
	}
	return mask;
}

export interface GreedyCoverOptions {
	/**
	 * Properties already covered before selection starts — see
	 * buildCoveredMask(). Makes the result the *remaining* work rather than a
	 * plan that re-runs finished scrapes.
	 */
	preCoveredMask?: Uint8Array;
	/** Terms never to select (already run, blacklisted, known-broken). */
	excludeTerms?: Set<string>;
	/** Stop once this fraction of the model corpus is covered (default 0.995). */
	targetFraction?: number;
	/** Stop when the best remaining term would add fewer than this many properties. */
	minMarginalGain?: number;
	/** Hard cap on selected terms. */
	maxTerms?: number;
}

export const DEFAULT_TARGET_FRACTION = 0.995;
export const DEFAULT_MIN_MARGINAL_GAIN = 25;

/** Binary max-heap over (term, gain), largest gain first. */
class GainHeap {
	private terms: string[] = [];
	private gains: number[] = [];

	get size(): number {
		return this.terms.length;
	}

	push(term: string, gain: number): void {
		this.terms.push(term);
		this.gains.push(gain);
		let i = this.terms.length - 1;
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (this.gains[parent] >= this.gains[i]) break;
			this.swap(i, parent);
			i = parent;
		}
	}

	peekGain(): number {
		return this.gains.length > 0 ? this.gains[0] : -1;
	}

	pop(): { term: string; gain: number } | undefined {
		if (this.terms.length === 0) return undefined;
		const term = this.terms[0];
		const gain = this.gains[0];
		const lastTerm = this.terms.pop() as string;
		const lastGain = this.gains.pop() as number;
		if (this.terms.length > 0) {
			this.terms[0] = lastTerm;
			this.gains[0] = lastGain;
			this.siftDown();
		}
		return { term, gain };
	}

	private siftDown(): void {
		let i = 0;
		const n = this.terms.length;
		for (;;) {
			const left = 2 * i + 1;
			const right = left + 1;
			let largest = i;
			if (left < n && this.gains[left] > this.gains[largest]) largest = left;
			if (right < n && this.gains[right] > this.gains[largest]) largest = right;
			if (largest === i) return;
			this.swap(i, largest);
			i = largest;
		}
	}

	private swap(a: number, b: number): void {
		[this.terms[a], this.terms[b]] = [this.terms[b], this.terms[a]];
		[this.gains[a], this.gains[b]] = [this.gains[b], this.gains[a]];
	}
}

export interface CoverResult {
	selected: SelectedTerm[];
	/** Properties covered by `alreadyRun` before greedy selection began. */
	preCovered: number;
	/** Properties covered once every selected term has run. */
	totalCovered: number;
	propertyCount: number;
	/** Why the loop stopped. */
	stoppedBecause:
		| "target-reached"
		| "marginal-gain"
		| "max-terms"
		| "exhausted";
}

/**
 * Select terms greedily by marginal coverage.
 *
 * Uses lazy (CELF) evaluation: gains in the heap may be stale upper bounds,
 * so the popped candidate is re-scored against the current covered set and
 * re-inserted if it no longer leads. Because coverage is submodular a stale
 * gain can only overestimate, which makes the first candidate whose re-scored
 * gain still beats the next heap entry provably the true maximum — the
 * shortcut is exact, not an approximation of the greedy step.
 */
export function greedyCover(
	index: CoverageIndex,
	opts: GreedyCoverOptions = {},
): CoverResult {
	const targetFraction = opts.targetFraction ?? DEFAULT_TARGET_FRACTION;
	const minMarginalGain = opts.minMarginalGain ?? DEFAULT_MIN_MARGINAL_GAIN;
	const maxTerms = opts.maxTerms ?? Number.POSITIVE_INFINITY;

	const covered = opts.preCoveredMask ?? new Uint8Array(index.propertyCount);
	if (covered.length !== index.propertyCount) {
		throw new RangeError(
			`preCoveredMask length ${covered.length} does not match propertyCount ${index.propertyCount}`,
		);
	}
	let coveredCount = 0;
	for (const flag of covered) if (flag !== 0) coveredCount++;
	const preCovered = coveredCount;

	const markCovered = (postings: Int32Array): number => {
		let added = 0;
		for (const idx of postings) {
			if (covered[idx] === 0) {
				covered[idx] = 1;
				added++;
			}
		}
		coveredCount += added;
		return added;
	};

	const excludeTerms = opts.excludeTerms ?? new Set<string>();
	const heap = new GainHeap();
	for (const [term, postings] of index.postings) {
		if (excludeTerms.has(term)) continue;
		heap.push(term, postings.length);
	}

	const countUncovered = (postings: Int32Array): number => {
		let n = 0;
		for (const idx of postings) if (covered[idx] === 0) n++;
		return n;
	};

	const selected: SelectedTerm[] = [];
	const targetCount = Math.ceil(index.propertyCount * targetFraction);
	let stoppedBecause: CoverResult["stoppedBecause"] = "exhausted";

	while (heap.size > 0) {
		if (coveredCount >= targetCount) {
			stoppedBecause = "target-reached";
			break;
		}
		if (selected.length >= maxTerms) {
			stoppedBecause = "max-terms";
			break;
		}

		const top = heap.pop();
		if (!top) break;
		const postings = index.postings.get(top.term) as Int32Array;
		const actual = countUncovered(postings);

		// Stale gain — re-insert with the true value and let the heap re-order.
		if (actual < top.gain && actual < heap.peekGain()) {
			heap.push(top.term, actual);
			continue;
		}

		if (actual < minMarginalGain) {
			stoppedBecause = "marginal-gain";
			break;
		}

		markCovered(postings);
		selected.push({
			term: top.term,
			newlyCovered: actual,
			cumulativeCovered: coveredCount,
			cumulativeFraction: coveredCount / index.propertyCount,
		});
	}

	return {
		selected,
		preCovered,
		totalCovered: coveredCount,
		propertyCount: index.propertyCount,
		stoppedBecause,
	};
}
