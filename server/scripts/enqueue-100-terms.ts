/**
 * Enqueue next 100 most useful unsearched terms via Cloudflare Workers API.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_KEY = process.env.TCAD_API_KEY;
const API_URL = "https://api.alephatx.info/api/properties/scrape";

if (!API_KEY) {
  console.error("TCAD_API_KEY not set");
  process.exit(1);
}

async function main() {
  // Get all searched terms
  const searchedTerms = await prisma.searchTermAnalytics.findMany({
    select: { searchTerm: true },
  });
  const searchedSet = new Set(searchedTerms.map((r) => r.searchTerm.toLowerCase()));

  // Candidate unsearched terms (from batch configs and analytics)
  const allTerms = [
    // High-yield proven terms (to re-scrape for 2025)
    "Trust", "Boulevard", "Pflugerville", "John", "Robert", "James", "JOSE", "Mary", "West", "Maria",
    "Estate", "TEXAS", "Homes", "CITY", "William", "Michael", "Thomas", "David", "River", "Court",
    // Unsearched geographic/entity terms
    "Leander", "Cedar Park", "Round Rock", "Georgetown", "Hutto", "Taylor", "Jarrell", "Liberty",
    "Bastrop", "Smithville", "Elgin", "Granger", "Thrall", "Webberville", "Del Valle", "Spicewood",
    "Lakeway", "Bee Cave", "West Lake", "Dripping Springs", "Marble Falls", "Burnet",
    // Unsearched names (high frequency in Travis County)
    "Patricia", "Patricia", "Sandra", "Jessica", "Karen", "Nancy", "Susan", "Lisa", "Betty", "Margaret",
    "Daniel", "Paul", "Mark", "Donald", "Steven", "Andrew", "Kenneth", "Joshua", "Edward", "Kevin",
    "Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Sanchez", "Perez", "Torres", "Ramirez",
    "Chavez", "Gutierrez", "Morales", "Castro", "Mendoza", "Ortiz", "Aguilar", "Medina", "Ramos",
    // Unsearched commercial/entity types
    "Holdings", "Partners", "Group", "Capital", "Financial", "Ventures", "Solutions", "Services",
    "Management", "Consulting", "Development", "Investments", "Mortgage", "Finance", "Credit", "Bank",
    "Real Estate", "Property Management", "Investment Trust", "Holding Company", "Partnership",
    // Unsearched street/area patterns
    "Hills", "Oak", "Ash", "Elm", "Maple", "Pine", "Cedar", "Spring", "Creek", "Shade",
    "Ranch", "Park", "Ridge", "Valley", "Mount", "Stone", "Sand", "Silver", "Golden", "Desert",
  ];

  const unsearched = allTerms.filter((t) => !searchedSet.has(t.toLowerCase()));
  const toEnqueue = unsearched.slice(0, 100);

  console.log(`Found ${unsearched.length} unsearched terms, enqueueing ${toEnqueue.length}`);

  let successCount = 0;
  let errorCount = 0;

  for (const term of toEnqueue) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify({ searchTerm: term }),
      });

      if (res.ok) {
        successCount++;
        console.log(`✓ ${term}`);
      } else {
        errorCount++;
        console.log(`✗ ${term} (${res.status})`);
      }
    } catch (err) {
      errorCount++;
      console.log(`✗ ${term} (${err})`);
    }
  }

  console.log(`\nEnqueued ${successCount}/${toEnqueue.length} terms`);
  if (errorCount > 0) console.log(`${errorCount} errors`);

  await prisma.$disconnect();
  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(console.error);
