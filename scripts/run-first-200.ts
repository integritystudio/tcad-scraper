/**
 * Enqueue the first 200 highest-yield search terms to the Workers scrape API.
 * Terms ordered by historical property yield from docs/SEARCH_TERMS.md.
 *
 * Usage: doppler run -- npx tsx scripts/run-first-200.ts
 */

const API_URL = "https://api.alephatx.info/api/properties/scrape";
const apiKeyFromEnv = process.env.TCAD_API_KEY;
const DELAY_MS = 500; // 500ms between requests to avoid overwhelming the queue

if (!apiKeyFromEnv) {
	console.error(
		"ERROR: TCAD_API_KEY not set. Run with: doppler run -- npx tsx scripts/run-first-200.ts",
	);
	process.exit(1);
}
const API_KEY: string = apiKeyFromEnv;

// Top 200 terms by property yield (Tiers 1-3 from docs/2025_BACKFILL_OPTIMIZATION.json)
const TERMS: readonly string[] = [
	// Tier 1: ranks 1-15 (19.6% coverage)
	"David",
	"Robert",
	"LIVING",
	"Home",
	"Fami",
	"James",
	"steph",
	"Paul",
	"eliza",
	"Rich",
	"Mark",
	"estat",
	"Christopher",
	"Martin",
	"Thomas",
	// Tier 2: ranks 16-50 (45.1% cumulative)
	"holdi",
	"Sand",
	"Maria",
	"Carl",
	"Rock",
	"Daniel",
	"Mary",
	"Wood",
	"marie",
	"Vista",
	"TEXAS",
	"Ridge",
	"Scott",
	"Angel",
	"CITY",
	"Green",
	"White",
	"VILLA",
	"JOSE",
	"West",
	"Michelle",
	"Matthew",
	"Susan",
	"Manor",
	"Assoc",
	"Pass",
	"Johnson",
	"Linda",
	"Jeffrey",
	"STATE",
	"Andrew",
	"laure",
	"Joseph",
	"Ranch",
	"Bend",
	// Tier 3: ranks 51-100 (67.4% cumulative)
	"Garcia",
	"Kevin",
	"Springs",
	"Edward",
	"Oaks",
	"Properties",
	"Tran",
	"Ryan",
	"Bell",
	"Carol",
	"Lopez",
	"Lynn",
	"Nguyen",
	"Lamar",
	"Taylor",
	"Brian",
	"BLUE",
	"Eric",
	"devel",
	"Land",
	"Steven",
	"Patrick",
	"ROSA",
	"Group",
	"Davis",
	"Jennifer",
	"EAST",
	"Charles",
	"patri",
	"BARR",
	"Rose",
	"Kelly",
	"Valley",
	"Crest",
	"Williams",
	"Miller",
	"kenne",
	"Louis",
	"Brown",
	"Lisa",
	"Smith",
	"Del Valle",
	"Rodriguez",
	"George",
	"SERIES",
	"Stone",
	"Rebecca",
	"Hills",
	"Jason",
	"Parkway",
	// Tier 3 continued: ranks 101-200 (92.1% cumulative)
	// High-efficiency terms from batch configs + backfill source
	"John",
	"Michael",
	"Elizabeth",
	"Oak",
	"Homes",
	"Spring",
	"Path",
	"Leander",
	"Brook",
	"Sarah",
	"Lago Vista",
	"Meadow",
	"Bee Cave",
	"Association",
	"LLC",
	"Trust",
	"Corp",
	"Corporation",
	"Inc",
	"Partnership",
	"Investments",
	"Holdings",
	"Capital",
	"Fund",
	"Development",
	"Realty",
	"Plaza",
	"Center",
	"Property",
	"Jones",
	"Wilson",
	"Anderson",
	"Jackson",
	"Lee",
	"Walker",
	"Allen",
	"King",
	"Hall",
	"Long",
	"Ross",
	"Freeman",
	"Harvey",
	"Webb",
	"Nichols",
	"Murray",
	"Knight",
	"Duncan",
	"Ferguson",
	"Gordon",
	"Rice",
	"Porter",
	"Hunter",
	"Boyd",
	"Arnold",
	"Wagner",
	"Black",
	"Grant",
	"Warner",
	"Garrett",
	"Hawkins",
	"Banks",
	"Fields",
	"Daniels",
	"Chandler",
	"Maxwell",
	"Tucker",
	"Hardy",
	"Cross",
	"Garner",
	"Brady",
	"Barker",
	"Norris",
	"Jenkins",
	"Perry",
	"Powell",
	"Patterson",
	"Hughes",
	"Washington",
	"Butler",
	"Simmons",
	"Foster",
	"Gonzales",
	"Bryant",
	"Alexander",
	"Russell",
	"Griffin",
	"Hayes",
	"Myers",
	"Ford",
	"Hamilton",
	"Graham",
	"Sullivan",
	"Wallace",
	"Woods",
	"Cole",
	"Owens",
	"Reynolds",
	"Fisher",
	"Ellis",
	"Harrison",
	"Gibson",
	"McDonald",
	"Marshall",
];

// Deduplicate (case-insensitive)
const seen = new Set<string>();
const uniqueTerms: string[] = [];
for (const term of TERMS) {
	const lower = term.toLowerCase();
	if (!seen.has(lower)) {
		seen.add(lower);
		uniqueTerms.push(term);
	}
}

const terms = uniqueTerms.slice(0, 200);

async function enqueue(term: string): Promise<boolean> {
	const res = await fetch(API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": API_KEY,
		},
		body: JSON.stringify({ searchTerm: term }),
	});

	if (!res.ok) {
		const text = await res.text();
		console.error(`  FAIL [${res.status}] "${term}": ${text}`);
		return false;
	}
	return true;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	console.log(`\n=== Enqueuing ${terms.length} search terms ===\n`);

	let success = 0;
	let failed = 0;

	for (let i = 0; i < terms.length; i++) {
		const term = terms[i];
		const ok = await enqueue(term);
		if (ok) {
			success++;
			console.log(`  [${i + 1}/${terms.length}] Queued: "${term}"`);
		} else {
			failed++;
		}

		// Pace requests
		if (i < terms.length - 1) {
			await sleep(DELAY_MS);
		}
	}

	console.log(`\n=== Done ===`);
	console.log(`  Success: ${success}`);
	console.log(`  Failed:  ${failed}`);
	console.log(`  Total:   ${terms.length}\n`);
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
