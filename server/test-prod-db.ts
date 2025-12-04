import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
	log: ["query", "info", "warn", "error"],
});

async function testDatabase() {
	try {
		console.log("Testing database connection...");
		console.log("DATABASE_URL:", process.env.DATABASE_URL);

		// Test connection
		await prisma.$connect();
		console.log("✓ Database connected");

		// Count properties
		const propertyCount = await prisma.property.count();
		console.log("✓ Property count:", propertyCount);

		// Get sample property
		const sampleProperty = await prisma.property.findFirst({
			take: 1,
		});
		console.log(
			"✓ Sample property:",
			sampleProperty
				? {
						id: sampleProperty.id,
						property_id: sampleProperty.propertyId,
						name: sampleProperty.name,
						address: sampleProperty.propertyAddress,
					}
				: "No properties found",
		);

		// Test with search query (similar to API)
		const searchResults = await prisma.property.findMany({
			take: 5,
			orderBy: { scrapedAt: "desc" },
		});
		console.log("✓ Recent properties count:", searchResults.length);

		// Test specific query that might be failing
		const queryTest = await prisma.property.findMany({
			where: {
				name: { contains: "TRUST", mode: "insensitive" },
			},
			take: 5,
		});
		console.log("✓ TRUST search results:", queryTest.length);
	} catch (error) {
		console.error("✗ Database error:", error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

testDatabase();
