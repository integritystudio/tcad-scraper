/** Terms that cause TCAD API timeouts or truncated responses — hard skip. */
export const BLOCKED_TERMS: ReadonlySet<string> = new Set([
	"street",
	"drive",
	"avenue",
	"belterra",
	"lakeline boulevard",
	"maple run",
	"mesa park",
	"pemberton heights",
	"sendero springs",
	"escrow",
]);
