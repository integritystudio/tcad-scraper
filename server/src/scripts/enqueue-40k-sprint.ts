/**
 * Temporary sprint script targeting ~40K new properties.
 *
 * Strategy: Generate a broad pool of never-searched terms (not in
 * searchTermAnalytics), enqueue one at a time, wait for completion,
 * and stop after 10 consecutive zero-yield terms.
 *
 * Usage:
 *   doppler run -- npx tsx src/scripts/enqueue-40k-sprint.ts
 *   doppler run -- npx tsx src/scripts/enqueue-40k-sprint.ts --dry-run
 *   doppler run -- npx tsx src/scripts/enqueue-40k-sprint.ts --limit 100
 *   doppler run -- npx tsx src/scripts/enqueue-40k-sprint.ts --no-wait --limit 50
 */

import { prisma } from "../lib/prisma";
import logger from "../lib/logger";
import { scraperQueue } from "../queues/scraper.queue";
import { getErrorMessage } from "../utils/error-helpers";

const NEW_PROPERTY_TARGET = 40_000;
const SPRINT_PRIORITY = 1;
const MAX_CONSECUTIVE_ZEROS = 10;
const JOB_POLL_INTERVAL_MS = 3_000;
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

// Broad pool of terms likely to match Travis County property records.
// Organized by category, curated for 4+ char length and likely hits.
const TERM_POOL: readonly string[] = [
	// === Last names: less common but present in Travis County ===
	"Abbott", "Acevedo", "Adkins", "Aguirre", "Albert", "Allison", "Amos",
	"Andrade", "Archer", "Arnold", "Atkins", "Avery", "Ayala",
	"Baird", "Ball", "Ballard", "Banks", "Barber", "Barker", "Barnett",
	"Barrera", "Barrett", "Barrios", "Bartlett", "Bass", "Bates", "Bauer",
	"Baxter", "Bean", "Beard", "Beasley", "Beck", "Becker", "Bell",
	"Beltran", "Benavides", "Benson", "Berg", "Berger", "Bernard",
	"Berry", "Best", "Bird", "Bishop", "Black", "Blackwell", "Blair",
	"Blake", "Blanchard", "Bland", "Blanton", "Block", "Bloom", "Boggs",
	"Bond", "Bonilla", "Booker", "Boone", "Booth", "Bowers", "Boyd",
	"Boyle", "Bradford", "Brady", "Branch", "Brandt", "Bray", "Brennan",
	"Brewer", "Bridges", "Briggs", "Britt", "Brock", "Brooke", "Bryan",
	"Buchanan", "Buck", "Buckley", "Bullock", "Burch", "Burgess", "Burke",
	"Burnett", "Burns", "Burris", "Burton", "Bush", "Byrd",
	"Cabrera", "Cain", "Calderon", "Caldwell", "Calhoun", "Callahan",
	"Camacho", "Cameron", "Campos", "Cannon", "Cardenas", "Carey",
	"Carlson", "Carney", "Carr", "Carrillo", "Carroll", "Carson",
	"Case", "Cash", "Castaneda", "Castro", "Cervantes", "Chambers",
	"Chan", "Chandler", "Chang", "Chapman", "Chase", "Chavis", "Cherry",
	"Choi", "Christian", "Church", "Cisneros", "Clapp", "Clayton",
	"Clement", "Cline", "Coates", "Cochran", "Coffey", "Cohen", "Cole",
	"Collier", "Colvin", "Combs", "Conley", "Conner", "Conrad",
	"Conway", "Cooke", "Cooley", "Coombs", "Copeland", "Cordova",
	"Corey", "Corona", "Cortez", "Costa", "Cotton", "Coulter", "Cowan",
	"Craig", "Crane", "Crawford", "Crews", "Croft", "Crosby", "Cross",
	"Crow", "Crowell", "Crum", "Cuevas", "Cunningham", "Curry",
	"Dale", "Dalton", "Daniel", "Darby", "Darden", "Darnell", "Daugherty",
	"Davila", "Dawn", "Dawson", "Dean", "Decker", "Delacruz", "Delaney",
	"Deleon", "Delgado", "Dennis", "Denny", "Desmond", "Devlin",
	"Dewey", "Diamond", "Dick", "Dickerson", "Dickson", "Dillard",
	"Dillon", "Dixon", "Dodd", "Dodson", "Dolan", "Donaldson", "Donnelly",
	"Donovan", "Dooley", "Dorsey", "Dotson", "Douglas", "Downs", "Doyle",
	"Drake", "Draper", "Drew", "Drummond", "Dudley", "Duffy", "Duke",
	"Duncan", "Dunlap", "Dunn", "Duran", "Durham", "Dyer",
	"Eaton", "Edmonds", "Eldridge", "Elkins", "Elliott", "Ellis",
	"Ellison", "Emerson", "Emery", "England", "English", "Enriquez",
	"Erickson", "Espinosa", "Espinoza", "Estes", "Estrada", "Everett",
	"Ewing",
	"Fagan", "Fairley", "Falcon", "Falk", "Farley", "Farmer", "Farr",
	"Farrell", "Faulkner", "Felix", "Felt", "Ferguson", "Fernandez",
	"Field", "Fields", "Figueroa", "Finch", "Finley", "Fischer", "Fisher",
	"Fitzgerald", "Fitzpatrick", "Fleming", "Fletcher", "Floyd", "Flynn",
	"Foley", "Fonseca", "Forbes", "Ford", "Forrest", "Forrester",
	"Foster", "Fowler", "Fox", "Francis", "Franco", "Frank", "Franklin",
	"Frazier", "Frederick", "Freeman", "French", "Friedman", "Frost",
	"Fry", "Fuentes", "Fuller", "Fulton",
	"Gaines", "Galindo", "Gallagher", "Gallegos", "Galloway", "Gamble",
	"Garner", "Garrett", "Garrison", "Garza", "Gates", "Gay", "Gentry",
	"George", "Gibbs", "Gibson", "Gilbert", "Giles", "Gill", "Gillespie",
	"Glenn", "Glover", "Golden", "Goodman", "Goodwin", "Gordon", "Gould",
	"Grace", "Grady", "Graham", "Grant", "Graves", "Gray", "Greene",
	"Greer", "Gregory", "Griffin", "Griffith", "Grimes", "Gross",
	"Guerra", "Guerrero", "Guthrie", "Guzman",
	"Haas", "Hahn", "Hale", "Haley", "Halsey", "Hamilton", "Hammond",
	"Hampton", "Hancock", "Haney", "Hankins", "Hanson", "Harding",
	"Hardy", "Harmon", "Harper", "Harrell", "Harrington", "Harrison",
	"Hart", "Hartley", "Hartman", "Harvey", "Hastings", "Hatfield",
	"Hawkins", "Hawley", "Hayden", "Hayes", "Haynes", "Hays", "Head",
	"Heath", "Hebert", "Hendricks", "Hendrix", "Henry", "Herman",
	"Herring", "Hess", "Hewitt", "Hickman", "Hicks", "Higgins",
	"Hildebrand", "Hines", "Hinton", "Hobbs", "Hodge", "Hodges",
	"Hoffman", "Hogan", "Holder", "Holland", "Holley", "Holman",
	"Holmes", "Holt", "Hood", "Hook", "Hooper", "Hoover", "Hopkins",
	"Hopper", "Horn", "Horner", "Horton", "Houston", "Howell", "Hubbard",
	"Huff", "Huffman", "Hunt", "Hunter", "Hurst", "Hutchins", "Hutton",
	"Hyde",
	"Ingram", "Irwin", "Ivey",
	"Jacks", "Jacobson", "Jaime", "Jarvis", "Jefferson", "Jenkins",
	"Jennings", "Jensen", "Jimenez", "Johns", "Johnston", "Jolly",
	"Jordan", "Joyce", "Juarez",
	"Kaiser", "Kane", "Kaplan", "Katz", "Kaufman", "Keane", "Kearney",
	"Keating", "Keen", "Keller", "Kelley", "Kelly", "Kemp", "Kendall",
	"Kennedy", "Kent", "Kerr", "Key", "Keys", "Kidd", "Kilgore",
	"Kimball", "Kindle", "King", "Kirk", "Kirkland", "Kirkpatrick",
	"Klein", "Kline", "Knapp", "Knight", "Knott", "Knox", "Koch",
	"Kramer", "Krause", "Krueger", "Kuhn",
	"Lacey", "Lacy", "Laird", "Lake", "Lamb", "Lambert", "Lancaster",
	"Landers", "Landry", "Lane", "Lang", "Lange", "Langley", "Langston",
	"Lara", "Larsen", "Larson", "Lash", "Lauer", "Lawler", "Lawrence",
	"Lawson", "Leach", "Leal", "Leblanc", "Ledford", "Lehman", "Leon",
	"Leonard", "Lester", "Leung", "Levine", "Levy", "Lindsey", "Link",
	"Little", "Livingston", "Lloyd", "Locke", "Logan", "Lombard",
	"Long", "Lott", "Love", "Lowe", "Lowery", "Lozano", "Lugo",
	"Luna", "Lund", "Lutz", "Lynch", "Lynn", "Lyon", "Lyons",
	"Macdonald", "Mack", "Mackey", "Madden", "Maddox", "Mahoney",
	"Major", "Maldonado", "Malone", "Manning", "Marks", "Marsh",
	"Marshall", "Mata", "Mathews", "Mathis", "Maxwell", "Mayer",
	"Maynard", "Mayo", "Mays", "McBride", "McCann", "McCarthy",
	"McClellan", "McCormick", "McCoy", "McCullough", "McDaniel",
	"McDonald", "McDowell", "McFarland", "McGee", "McGill", "McGowan",
	"McGuire", "McIntosh", "McIntyre", "McKay", "McKee", "McKenzie",
	"McKinney", "McLaughlin", "McLean", "McMillan", "McMullen",
	"McNamara", "McNeil", "McPherson", "Meadows", "Medina", "Mejia",
	"Melendez", "Melton", "Mendez", "Mercer", "Merritt", "Mesa",
	"Meyer", "Meyers", "Michael", "Middleton", "Miles", "Millar",
	"Millard", "Mills", "Minor", "Miranda", "Moeller", "Moffett",
	"Molina", "Monroe", "Montgomery", "Moody", "Moon", "Mooney",
	"Moorehead", "Mora", "Morales", "Moran", "Moreno", "Morin",
	"Moseley", "Moser", "Moss", "Mott", "Mullen", "Mullins", "Munoz",
	"Murillo", "Murray", "Myers",
	// === Street / geographic terms not yet searched ===
	"Arbor", "Aspen", "Basin", "Bayou", "Birch", "Bluff", "Branch",
	"Briar", "Brook", "Butte", "Cedar", "Chase", "Cliff", "Cloud",
	"Coast", "Coral", "Crown", "Delta", "Devon", "Eagle", "Elm",
	"Falls", "Fawn", "Field", "Flint", "Glade", "Haven", "Hawk",
	"Hazel", "Heath", "Hedge", "Heron", "Holly", "Ivory", "Jade",
	"Knoll", "Laurel", "Lemon", "Lilac", "Lilly", "Linden", "Lodge",
	"Magnolia", "Mango", "Maple", "Marina", "Marsh", "Mist", "Moss",
	"Mulberry", "Oasis", "Ocean", "Olive", "Orchid", "Palms",
	"Pebble", "Pecan", "Pine", "Plaza", "Point", "Prairie",
	"Quail", "Raven", "Robin", "Sage", "Sand", "Shadow", "Shell",
	"Sierra", "Silver", "Slate", "Spring", "Spruce", "Stone", "Storm",
	"Summit", "Sunset", "Swift", "Sycamore", "Terra", "Timber",
	"Trace", "Turtle", "Vine", "Violet", "Walnut", "Willow", "Wind",
	"Wren",
	// === Entity / legal terms not yet exhausted ===
	"Advisor", "Alliance", "Anchor", "Asset", "Benefit", "Board",
	"Broker", "Builder", "Charter", "Civic", "Classic", "Coastal",
	"Commerce", "Community", "Compass", "Condo", "Consult", "Corner",
	"Custom", "District", "Dynasty", "Endow", "Equity", "Federal",
	"First", "Global", "Grand", "Guardian", "Harbor", "Haven",
	"Heritage", "Horizon", "Imperial", "Landmark", "Legacy", "Liberty",
	"Manor", "Master", "Metro", "Modern", "National", "Noble",
	"Pacific", "Patriot", "Pinnacle", "Premier", "Prestige", "Prime",
	"Prospect", "Regent", "Reliant", "Republic", "Residential",
	"Royal", "Select", "Senior", "Service", "Shield", "Signature",
	"Solid", "Southern", "Sovereign", "Standard", "Sterling",
	"Succession", "Superior", "Supreme", "Trident", "Trinity",
	"United", "Universal", "Vanguard", "Venture", "Vertex",
	// === Number-based street addresses (catch apartment complexes) ===
	"1000", "1100", "1200", "1300", "1400", "1500", "1600", "1700",
	"1800", "1900", "2000", "2100", "2200", "2300", "2400", "2500",
	"2600", "2700", "2800", "2900", "3000", "3100", "3200", "3300",
	"3400", "3500", "3600", "3700", "3800", "3900", "4000", "4100",
	"4200", "4300", "4400", "4500", "4600", "4700", "4800", "4900",
	"5000", "5100", "5200", "5300", "5400", "5500", "5600", "5700",
	"5800", "5900", "6000", "6100", "6200", "6300", "6400", "6500",
	"6600", "6700", "6800", "6900", "7000", "7100", "7200", "7300",
	"7400", "7500", "7600", "7700", "7800", "7900", "8000", "8100",
	"8200", "8300", "8400", "8500", "8600", "8700", "8800", "8900",
	"9000", "9100", "9200", "9300", "9400", "9500", "9600", "9700",
	"9800", "9900", "10000", "10100", "10200", "10300", "10400",
	"10500", "10600", "10700", "10800", "10900", "11000", "11100",
	"11200", "11300", "11400", "11500", "11600", "11700", "11800",
	"11900", "12000", "12100", "12200", "12300", "12400", "12500",
	"13000", "13500", "14000", "14500", "15000", "15500", "16000",
] as const;

async function getSearchedTerms(): Promise<Set<string>> {
	const rows = await prisma.searchTermAnalytics.findMany({
		select: { searchTerm: true },
	});
	return new Set(rows.map((r) => r.searchTerm.toLowerCase()));
}

async function waitForJob(jobId: string): Promise<"completed" | "failed" | "timeout"> {
	const deadline = Date.now() + JOB_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const job = await scraperQueue.getJob(jobId);
		if (!job) return "failed";
		const state = await job.getState();
		if (state === "completed") return "completed";
		if (state === "failed") return "failed";
		await new Promise((r) => setTimeout(r, JOB_POLL_INTERVAL_MS));
	}
	return "timeout";
}

function parseLimit(): number {
	const idx = process.argv.indexOf("--limit");
	if (idx !== -1 && process.argv[idx + 1]) {
		const n = parseInt(process.argv[idx + 1], 10);
		if (n > 0) return n;
	}
	return Infinity;
}

async function run() {
	const dryRun = process.argv.includes("--dry-run");
	const noWait = process.argv.includes("--no-wait");
	const termLimit = parseLimit();
	const startCount = await prisma.property.count();
	const startTime = Date.now();

	logger.info("=== Sprint (unsearched terms) ===");
	logger.info(`Current properties: ${startCount.toLocaleString()}`);
	logger.info(`Mode: ${noWait ? "batch enqueue (no-wait)" : "monitored (wait per term)"}`);
	logger.info(`Term limit: ${termLimit === Infinity ? "none" : termLimit}`);
	if (!noWait) {
		logger.info(`Target new: ${termLimit === Infinity ? NEW_PROPERTY_TARGET.toLocaleString() : "unlimited (term-limited)"}`);
		logger.info(`Stop after: ${MAX_CONSECUTIVE_ZEROS} consecutive zero-yield terms`);
	}
	logger.info(`Term pool size: ${TERM_POOL.length}`);

	// Filter out already-searched terms
	const searched = await getSearchedTerms();
	const candidates = TERM_POOL.filter((t) => !searched.has(t.toLowerCase()));
	logger.info(`Already searched: ${searched.size} terms`);
	logger.info(`Unsearched candidates: ${candidates.length}`);

	if (candidates.length === 0) {
		logger.warn("No unsearched candidates — all terms already in analytics");
		await prisma.$disconnect();
		process.exit(1);
	}

	if (dryRun) {
		const shown = termLimit === Infinity ? candidates : candidates.slice(0, termLimit);
		for (const t of shown) logger.info(`  "${t}"`);
		logger.info(`\nDry run complete. ${shown.length} terms would be processed.`);
		await prisma.$disconnect();
		return;
	}

	// Graceful shutdown
	let running = true;
	process.on("SIGINT", () => { running = false; logger.info("Shutting down after current term..."); });
	process.on("SIGTERM", () => { running = false; });

	let termsProcessed = 0;

	if (noWait) {
		// Fire-and-forget: enqueue all terms immediately
		for (const term of candidates) {
			if (!running) break;
			if (termsProcessed >= termLimit) break;

			const job = await scraperQueue.add(
				"scrape-properties",
				{ searchTerm: term, userId: "40k-sprint", scheduled: true },
				{
					attempts: 3,
					backoff: { type: "exponential", delay: 2000 },
					priority: SPRINT_PRIORITY,
					removeOnComplete: 100,
					removeOnFail: 50,
				},
			);

			termsProcessed++;
			logger.info(`[${termsProcessed}/${Math.min(candidates.length, termLimit)}] Enqueued "${term}" — job ${String(job.id ?? "unknown")}`);
		}

		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		logger.info("\n=== Batch Enqueue Complete ===");
		logger.info(`Enqueued: ${termsProcessed} terms in ${elapsed}s`);
		logger.info(`Worker will process them in the background.`);
	} else {
		// Monitored mode: enqueue one at a time, track yield
		let totalNew = 0;
		let consecutiveZeros = 0;
		let termsWithYield = 0;

		for (const term of candidates) {
			if (!running) break;
			if (termsProcessed >= termLimit) {
				logger.info(`Term limit reached (${termLimit}).`);
				break;
			}
			if (termLimit === Infinity && totalNew >= NEW_PROPERTY_TARGET) {
				logger.info(`Target reached! ${totalNew.toLocaleString()} new properties.`);
				break;
			}
			if (consecutiveZeros >= MAX_CONSECUTIVE_ZEROS) {
				logger.info(`Stopping: ${MAX_CONSECUTIVE_ZEROS} consecutive zero-yield terms.`);
				break;
			}

			const countBefore = await prisma.property.count();

			const job = await scraperQueue.add(
				"scrape-properties",
				{ searchTerm: term, userId: "40k-sprint", scheduled: true },
				{
					attempts: 3,
					backoff: { type: "exponential", delay: 2000 },
					priority: SPRINT_PRIORITY,
					removeOnComplete: 100,
					removeOnFail: 50,
				},
			);

			termsProcessed++;
			const jobId = String(job.id ?? "unknown");
			logger.info(`[${termsProcessed}/${candidates.length}] "${term}" — job ${jobId}`);

			const result = await waitForJob(jobId);
			const countAfter = await prisma.property.count();
			const newFromTerm = countAfter - countBefore;
			totalNew += Math.max(0, newFromTerm);

			if (newFromTerm > 0) {
				consecutiveZeros = 0;
				termsWithYield++;
				logger.info(`  +${newFromTerm.toLocaleString()} new (total: +${totalNew.toLocaleString()}) [${result}]`);
			} else {
				consecutiveZeros++;
				logger.info(`  +0 new (${consecutiveZeros}/${MAX_CONSECUTIVE_ZEROS} consecutive zeros) [${result}]`);
			}
		}

		const elapsed = Math.floor((Date.now() - startTime) / 1000);
		const finalCount = await prisma.property.count();
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;

		logger.info("\n=== Sprint Complete ===");
		logger.info(`Runtime: ${minutes}m ${seconds}s`);
		logger.info(`Terms processed: ${termsProcessed} (${termsWithYield} yielded new properties)`);
		logger.info(`Properties: ${startCount.toLocaleString()} -> ${finalCount.toLocaleString()} (+${(finalCount - startCount).toLocaleString()})`);
		logger.info(`Consecutive zeros at stop: ${consecutiveZeros}`);
	}

	await prisma.$disconnect();
}

run().catch((error) => {
	logger.error(`Fatal: ${getErrorMessage(error)}`);
	process.exit(1);
});
