/**
 * 4-char prefixes that TCAD cannot serve at all: the endpoint answers
 * **HTTP 204 with an empty body**, so `JSON.parse("")` throws "Unexpected end
 * of JSON input". Skipped before expansion in backfill.ts's
 * getDenseExpansions() and getSeedExpansions() to avoid re-attempting ~26
 * doomed searches per root on every backfill run.
 *
 * The name is retained for continuity but the failure is not truncation — the
 * response is empty, not cut short. See docs/truncated-response-terms.md.
 *
 * ── Scope corrected 2026-08-08 ──────────────────────────────────────
 * This set previously also held `chri`, `cong`, `cree`, `davi`, `lama`,
 * `laur`, `mana`, `nguy`, `trus`, `lane`, `aust` and `llc.`. Retested against
 * the 2026 roll at production page size, the first nine return **HTTP 200 with
 * valid JSON** — 2,522 to 27,378 matches each — and, once run, saved 1,360 new
 * properties that the blacklist had been suppressing. `llc.` returns 53,899
 * matches. `lane` and `aust` returned **HTTP 504**, a load-dependent timeout
 * rather than a permanent fault, so they belong in retry/backoff handling
 * rather than here.
 *
 * `lmtd` also 204s but is deliberately not listed: this set exists to stop
 * a-z expansion of *analytics* roots, and nothing expands `lmtd`, so adding it
 * would suppress nothing. It is recorded in docs/truncated-response-terms.md.
 *
 * Keep the entry bar at a reproducible 204: a term that times out or errors
 * intermittently is not a member, because every addition permanently removes
 * ~26 expansions from every future backfill — and a stale entry is invisible,
 * since the searches it suppresses never run and so never report anything.
 */
export const TRUNCATION_BUG_ROOTS: ReadonlySet<string> = new Set([
	"wayg",
	"wayh",
	"wayi",
	"wayj",
]);
