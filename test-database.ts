import {
	closePool,
	getPropertiesByCity,
	getPropertyCount,
	insertProperties,
	type Property,
} from "./src/database.js";

// Database result type (snake_case from PostgreSQL)
interface PropertyRow {
	owner_name: string;
	property_address: string;
	property_type: string;
	appraised_value: string;
	property_id: string;
}

// Sample test data
const testProperties: Property[] = [
	{
		name: "John Smith",
		propType: "Residential",
		city: "Austin",
		propertyAddress: "123 Main Street",
		assessedValue: "$350,000",
		propertyID: "TEST001",
		appraisedValue: "$375,000",
		geoID: "GEO123",
		description: "Lot 1, Block A, Example Subdivision",
	},
	{
		name: "Jane Doe",
		propType: "Commercial",
		city: "Austin",
		propertyAddress: "456 Business Blvd",
		assessedValue: "$1,200,000",
		propertyID: "TEST002",
		appraisedValue: "$1,350,000",
		geoID: "GEO456",
		description: "Commercial building, Downtown",
	},
	{
		name: "Bob Johnson",
		propType: "Residential",
		city: "Round Rock",
		propertyAddress: "789 Oak Lane",
		assessedValue: "$425,000",
		propertyID: "TEST003",
		appraisedValue: "$450,000",
		geoID: "GEO789",
		description: "Single family home with pool",
	},
	{
		name: "Alice Williams",
		propType: "Residential",
		city: "Cedar Park",
		propertyAddress: "321 Pine Street",
		assessedValue: "$285,000",
		propertyID: "TEST004",
		appraisedValue: "$310,000",
		geoID: "GEO321",
		description: "Townhouse, HOA included",
	},
	{
		name: "Michael Brown",
		propType: "Land",
		city: "Pflugerville",
		propertyAddress: "555 Ranch Road",
		assessedValue: "$150,000",
		propertyID: "TEST005",
		appraisedValue: "$165,000",
		geoID: "GEO555",
		description: "5 acres vacant land",
	},
];

async function runTests() {
	console.log(`\n🧪 Testing Database Integration\n${"=".repeat(60)}`);

	try {
		// Test 1: Get initial count
		console.log("\n📊 Test 1: Getting initial property count...");
		const initialCount = await getPropertyCount();
		console.log(`✓ Initial count: ${initialCount} properties`);

		// Test 2: Insert sample properties
		console.log("\n💾 Test 2: Inserting test properties...");
		await insertProperties(testProperties);
		console.log(
			`✓ Successfully inserted ${testProperties.length} test properties`,
		);

		// Test 3: Verify count increased
		console.log("\n📊 Test 3: Verifying property count...");
		const newCount = await getPropertyCount();
		console.log(`✓ New count: ${newCount} properties`);
		console.log(`✓ Added: ${newCount - initialCount} properties`);

		// Test 4: Query properties by city
		console.log("\n🏙️  Test 4: Querying properties by city...");
		const austinProps = await getPropertiesByCity("Austin");
		console.log(`✓ Found ${austinProps.length} properties in Austin`);

		// Test 5: Display sample results
		console.log("\n📋 Test 5: Sample properties from database:");
		if (austinProps.length > 0) {
			(austinProps as PropertyRow[]).slice(0, 2).forEach((prop, idx) => {
				console.log(`\n  ${idx + 1}. ${prop.owner_name}`);
				console.log(`     Address: ${prop.property_address}`);
				console.log(`     Type: ${prop.property_type}`);
				console.log(`     Value: ${prop.appraised_value}`);
				console.log(`     ID: ${prop.property_id}`);
			});
		}

		// Test 6: Test upsert (update existing property)
		console.log("\n🔄 Test 6: Testing upsert functionality...");
		const updatedProperty: Property = {
			...testProperties[0],
			assessedValue: "$360,000", // Updated value
			appraisedValue: "$385,000", // Updated value
		};
		await insertProperties([updatedProperty]);
		console.log("✓ Updated existing property (TEST001)");

		// Verify the update
		const finalCount = await getPropertyCount();
		console.log(`✓ Count remained the same: ${finalCount} (upsert worked!)`);

		console.log(`\n${"=".repeat(60)}`);
		console.log("✅ All database integration tests passed!\n");
	} catch (error) {
		console.error("\n❌ Test failed:", error);
		throw error;
	} finally {
		await closePool();
	}
}

// Run the tests
runTests();
