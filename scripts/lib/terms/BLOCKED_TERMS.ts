/** Terms that cause TCAD API timeouts or truncated responses — hard skip. */
export const BLOCKED_TERMS: ReadonlySet<string> = new Set([
	"street",
	"drive",
	"lane",
	"road",
	"way",
	"court",
	"place",
	"circle",
	"avenue",
	"boulevard",
	"belterra",
	"fiduciary",
	"lakeline boulevard",
	"lmtd",
	"maple run",
	"mesa park",
	"nonprofit",
	"pemberton heights",
	"residential builders",
	"sendero springs",
	"wayg",
	"wayh",
	"wayi",
	"wayj",
	"escrow",
	// Matches an extreme number of properties (Living/Family/Revocable
	// Trust, etc. — 23,852 matches, ~24 pages). Timed out 3/3 retries before
	// per-page checkpointing (16449c5, fixing incident 2026-08-06) and now
	// completes; still not worth the TCAD API load for a re-scrape of an
	// already-searched, generic term with minimal new-property yield.
	"trust",
]);
