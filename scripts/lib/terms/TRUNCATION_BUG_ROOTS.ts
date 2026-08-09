/**
 * 4-char prefixes that TCAD cannot serve, in either of two reproducible ways:
 *
 *  - **HTTP 204, empty body** (`way*`) — `JSON.parse("")` then throws
 *    "Unexpected end of JSON input", which is what the name records. The
 *    response is empty, not cut short; "truncation" was a misreading of the
 *    exception, and the name is kept only for continuity.
 *  - **HTTP 504 after ~10s at any page size** (`lane`, `aust`) — a server-side
 *    timeout on the query itself.
 *
 * Skipped before expansion in backfill.ts's getDenseExpansions() and
 * getSeedExpansions() to avoid re-attempting ~26 doomed searches per root on
 * every backfill run. See docs/truncated-response-terms.md.
 *
 * ── Scope corrected 2026-08-08 ──────────────────────────────────────
 * This set previously also held `chri`, `cong`, `cree`, `davi`, `lama`,
 * `laur`, `mana`, `nguy`, `trus` and `llc.`. Retested against the 2026 roll at
 * production page size, all ten return **HTTP 200 with valid JSON** — 2,522 to
 * 53,899 matches each — and, once run, saved 3,676 new properties that the
 * blacklist had been suppressing.
 *
 * `lane` and `aust` stay, under the second failure mode: a reproducible
 * **HTTP 504 after ~10s**, at every page size down to `pageSize=1` and in both
 * 2025 and 2026. An earlier note here called that a load-dependent timeout
 * belonging in retry handling — that was wrong, and testing at pageSize=1
 * disproves it: the timeout is on the query itself, not on serialising a large
 * response, so no page size and no retry budget reaches these terms.
 *
 * `lmtd` also 204s but is deliberately not listed: this set exists to stop
 * a-z expansion of *analytics* roots, and nothing expands `lmtd`, so adding it
 * would suppress nothing. It is recorded in docs/truncated-response-terms.md.
 *
 * Entry bar: a *reproducible* server-side refusal — a 204, or a 504 that
 * survives dropping the page size to 1. Not a one-off failure. Every addition
 * permanently removes ~26 expansions from every future backfill, and a stale
 * entry is invisible, because the searches it suppresses never run and so
 * never report anything.
 */
export const TRUNCATION_BUG_ROOTS: ReadonlySet<string> = new Set([
	// HTTP 204, empty body
	"wayg",
	"wayh",
	"wayi",
	"wayj",
	// HTTP 504 after ~10s, reproducible down to pageSize=1
	"lane",
	"aust",
]);
