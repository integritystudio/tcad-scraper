/**
 * 4-char prefixes confirmed to trigger TCAD's server-side JSON truncation bug
 * across every a-z expansion, regardless of the specific letter — see
 * docs/truncated-response-terms.md. Skipped before expansion in
 * backfill-2025.ts's getDenseExpansions() and getSeedExpansions() to avoid
 * re-attempting ~26 doomed searches per root on every backfill run.
 */
export const TRUNCATION_BUG_ROOTS: ReadonlySet<string> = new Set([
	"wayg",
	"wayh",
	"wayi",
	"wayj",
	"chri",
	"cong",
	"cree",
	"davi",
	"lama",
	"laur",
	"mana",
	"nguy",
	"trus",
]);
