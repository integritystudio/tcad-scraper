/**
 * Backfill 2025 TCAD properties by enqueuing high-yield terms
 * that exist in 2026 data but not yet in 2025.
 *
 * Usage: TCAD_YEAR=2025 doppler run -- npx tsx scripts/backfill-2025.ts
 */

import {
	ALPHABET,
	DENSE_AVG_RESULTS_THRESHOLD,
	DENSE_MAX_BASE_LENGTH,
	DENSE_MAX_RESULTS_THRESHOLD,
	DENSE_MIN_SUCCESS_RATE,
	MIN_TERM_LENGTH,
	SEED_MIN_AVG_RESULTS,
	SEED_MIN_SUCCESS_RATE,
} from "../utils/constants";
import { runBackfillMain } from "./lib/backfill-runner";
import { isSupersetOfAny } from "./lib/backfill-utils";
import { prisma } from "./lib/d1-prisma";
import { getSearchedTermSets } from "./lib/searched-terms";

async function getDenseExpansions(allSearched: Set<string>): Promise<string[]> {
	const dense = await prisma.searchTermAnalytics.findMany({
		where: {
			OR: [
				{ maxResults: { gte: DENSE_MAX_RESULTS_THRESHOLD } },
				{ avgResultsPerSearch: { gte: DENSE_AVG_RESULTS_THRESHOLD } },
			],
			successRate: { gte: DENSE_MIN_SUCCESS_RATE },
		},
		orderBy: { avgResultsPerSearch: "desc" },
		select: { searchTerm: true },
	});

	const expansions: string[] = [];
	const seen = new Set<string>();
	for (const row of dense) {
		if (row.searchTerm.length > DENSE_MAX_BASE_LENGTH) continue;
		for (const ch of ALPHABET) {
			const expanded = row.searchTerm + ch;
			const lower = expanded.toLowerCase();
			if (
				expanded.length < MIN_TERM_LENGTH ||
				allSearched.has(lower) ||
				seen.has(lower)
			)
				continue;
			seen.add(lower);
			expansions.push(expanded);
		}
	}
	return expansions;
}

async function getSeedExpansions(allSearched: Set<string>): Promise<string[]> {
	const highYield = await prisma.searchTermAnalytics.findMany({
		where: {
			successRate: { gte: SEED_MIN_SUCCESS_RATE },
			avgResultsPerSearch: { gte: SEED_MIN_AVG_RESULTS },
		},
		orderBy: { avgResultsPerSearch: "desc" },
		select: { searchTerm: true },
	});

	const prefixes = new Set<string>();
	for (const row of highYield) {
		if (row.searchTerm.length >= MIN_TERM_LENGTH) {
			prefixes.add(row.searchTerm.substring(0, MIN_TERM_LENGTH).toLowerCase());
		}
	}

	const expansions: string[] = [];
	const seen = new Set<string>();
	for (const prefix of prefixes) {
		for (const ch of ALPHABET) {
			const expanded = prefix + ch;
			if (allSearched.has(expanded) || seen.has(expanded)) continue;
			seen.add(expanded);
			expansions.push(expanded);
		}
	}
	return expansions;
}

// Static high-yield terms (full names/neighborhoods, 5-12 chars, avoid API truncation)
const STATIC_TERMS = [
	// First names
	"Michael",
	"Christopher",
	"Paul",
	"Patrick",
	"Jerry",
	"Tyler",
	"Aaron",
	"Peter",
	"Nathan",
	"Arthur",
	"Roger",
	"Eugene",
	"Roy",
	"Ralph",
	"Randy",
	"Jennifer",
	"Jessica",
	"Amanda",
	"Melissa",
	"Michelle",
	"Stephanie",
	"Nicole",
	"Angela",
	"Christina",
	"Samantha",
	"Katherine",
	"Christine",
	"Deborah",
	"Rachel",
	"Laura",
	"Carolyn",
	"Janet",
	"Catherine",
	"Frances",
	"Joyce",
	"Diane",
	"Alice",
	"Julie",
	"Heather",
	"Teresa",
	"Gloria",
	"Evelyn",
	"Cheryl",
	"Mildred",
	"Martha",
	"Donna",
	"Dorothy",
	"Sharon",
	"Betty",
	"Helen",
	"Sandra",
	"Kimberly",
	"Emily",
	"Brenda",
	"Amy",
	"Anna",
	"Rebecca",
	"Virginia",
	"Pamela",
	"Cynthia",
	"Ruth",
	"Kathleen",
	"Linda",
	"Nancy",
	"Karen",
	"Margaret",
	"Marie",
	"Frank",
	"Raymond",
	"Jack",
	"Dennis",
	"Henry",
	"Douglas",
	"Gerald",
	"Lawrence",
	"Bruce",
	"Russell",
	"Louis",
	"Philip",
	"Johnny",
	"Harry",
	"Vincent",
	"Billy",
	"Howard",
	"Carl",
	"Terry",
	"Sean",
	"Austin",
	"Jesse",
	"Ethan",
	"Dylan",
	"Bryan",
	"Jordan",
	"Miguel",
	"Carlos",
	"Rafael",
	"Angel",
	"Oscar",
	"Fernando",
	"Manuel",
	"Ricardo",
	"Roberto",
	"Eduardo",
	"Pedro",
	"Alejandro",
	"Sergio",
	// Last names
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
	"West",
	"Owens",
	"Reynolds",
	"Fisher",
	"Ellis",
	"Harrison",
	"Gibson",
	"McDonald",
	"Marshall",
	"Ortega",
	"Burns",
	"Kelley",
	"Dunn",
	"Crawford",
	"Vasquez",
	"Dean",
	"Lane",
	"Soto",
	"Lynch",
	"Stone",
	"Dixon",
	"Hicks",
	"Weaver",
	"Hart",
	"Hunt",
	"Palmer",
	"Robertson",
	"Holmes",
	"Spencer",
	"Francis",
	"Stephens",
	"Vargas",
	"Herrera",
	"Medina",
	"Aguilar",
	"Salazar",
	"Delgado",
	"Vega",
	"Rios",
	"Romero",
	"Guerrero",
	"Castro",
	"Estrada",
	"Contreras",
	"Fuentes",
	"Leon",
	"Acosta",
	"Maldonado",
	"Rosales",
	"Barnes",
	"Coleman",
	"Cox",
	"Ward",
	// Geo/street/neighborhood
	"Slaughter",
	"Lamar",
	"Manchaca",
	"Round Rock",
	"Cedar Park",
	"Pflugerville",
	"Lakeway",
	"Woodland",
	"Greenwood",
	"Sunset",
	"Wells Branch",
	"Ben White",
	"Dessau",
	"Steiner",
	"Avery",
	"Circle C",
	"Dripping Springs",
	"Onion Creek",
	"Shady Hollow",
	"Travis Country",
	"Barton Creek",
	"Westover",
	"Bryker Woods",
	"North Loop",
	"South Congress",
	"East Riverside",
	"South Lamar",
	"North Austin",
	"Bee Cave",
	"Lakeline",
	"Brushy Creek",
	"Leander",
	"Highland",
	"Clarksville",
	"Old West Austin",
	"Bouldin Creek",
	"Travis Heights",
	"South Austin",
	"North Lamar",
	"East Austin",
	"Anderson Mill",
	"Braker",
	"Rundberg",
	"Oltorf",
	"Stassney",
	"William Cannon",
	"Buda",
	// Entity/business
	"Ventures",
	"Services",
	"Solutions",
	"International",
	"National",
	"Resources",
	"Global",
	"Enterprises",
	"Partners",
	"Advisors",
	"Consulting",
	"Management",
	"Alliance",
	"Network",
	"Labs",
	"Studio",
	"Works",
	"Builders",
	"Communities",
	"Rentals",
	"Housing",
	"Leasing",
	"Mortgage",
	// Geo features
	"Bend",
	"Trace",
	"Crossing",
	"Circle",
	"Court",
	"Place",
	"Hollow",
	"Branch",
	"Pass",
	"Point",
	"Island",
	"Terrace",
	"Stone",
	"Cedar",
	"Pine",
	"Cypress",
	"Willow",
	"Birch",
	"Holly",
	"Sage",
	"Laurel",
	"Magnolia",
	"Pecan",
	"Mesquite",
	"Live Oak",
	"Post Oak",
	"Oaks",
	"Pines",
	"Hills",
	"Springs",
	"Falls",
	"Shores",
	"Estates",
	"Landing",
	"Overlook",
	"Retreat",
	"Haven",
	"Commons",
	"Gardens",
	"Heights",
	"Pointe",
];

async function getTermsToBackfill(): Promise<string[]> {
	const { searched2025, allSearched, successful } = await getSearchedTermSets();

	// Source 1: High-yield 2026 terms not yet in 2025
	const terms2026 = await prisma.$queryRaw<
		Array<{ search_term: string; cnt: number }>
	>`
    SELECT search_term, COUNT(*) as cnt
    FROM properties
    WHERE year = 2026
    GROUP BY search_term
    ORDER BY cnt DESC
    LIMIT 300`;

	// Source 2: High-yield analytics terms
	const analytics = await prisma.searchTermAnalytics.findMany({
		where: { totalResults: { gt: 500 } },
		orderBy: { totalResults: "desc" },
		select: { searchTerm: true, totalResults: true },
	});

	// Source 3: Dense term prefix expansions
	const denseExpansions = await getDenseExpansions(allSearched);

	// Source 4: Analytics seed prefix expansions
	const seedExpansions = await getSeedExpansions(allSearched);

	const seen = new Set<string>();
	const result: string[] = [];

	function addTerm(term: string): void {
		const lower = term.toLowerCase();
		if (searched2025.has(lower) || seen.has(lower)) return;
		if (term.length < MIN_TERM_LENGTH) return;
		if (isSupersetOfAny(lower, successful)) return;
		seen.add(lower);
		result.push(term);
	}

	// Priority: proven 2026 > analytics > STATIC FULL TERMS > dense > seed expansions
	for (const r of terms2026) addTerm(r.search_term);
	for (const r of analytics) addTerm(r.searchTerm);
	console.log(`  Known high-yield terms: ${result.length}`);
	for (const t of STATIC_TERMS) addTerm(t);
	console.log(`  After static terms: ${result.length}`);
	for (const t of denseExpansions) addTerm(t);
	console.log(`  After dense expansions: ${result.length}`);
	for (const t of seedExpansions) addTerm(t);
	console.log(`  After seed expansions: ${result.length}`);

	return result;
}

runBackfillMain({
	getTerms: getTermsToBackfill,
	userId: "backfill-2025",
	label: "High-Yield Terms",
});
