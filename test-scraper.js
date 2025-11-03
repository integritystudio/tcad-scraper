const { addBatch, getQueueStats } = require('./tcad-scraper');

async function runTest() {
  console.log('🧪 TCAD Scraper Test\n');

  // Test 1: Add a small batch of search terms
  console.log('Test 1: Adding search terms...');
  const searchTerms = ['smith', 'johnson', 'williams'];
  
  const jobs = await addBatch(searchTerms);
  console.log(`✅ Added ${jobs.length} job(s)\n`);

  // Test 2: Check queue stats
  console.log('Test 2: Queue statistics...');
  const stats = await getQueueStats();
  console.log('Current queue state:');
  console.log(`  - Waiting: ${stats.waiting}`);
  console.log(`  - Active: ${stats.active}`);
  console.log(`  - Completed: ${stats.completed}`);
  console.log(`  - Failed: ${stats.failed}\n`);

  // Test 3: Monitor job progress
  console.log('Test 3: Monitoring first job...');
  const firstJob = jobs[0];
  
  console.log(`Job ID: ${firstJob.id}`);
  console.log('Waiting for completion...\n');

  // Wait for job to complete (with timeout)
  try {
    const result = await firstJob.waitUntilFinished(
      firstJob.queueEvents,
      120000 // 2 minute timeout
    );

    console.log('✅ Job completed!');
    console.log('\nResults summary:');
    console.log(`  - Total searches: ${result.summary.totalSearches}`);
    console.log(`  - Successful: ${result.summary.successCount}`);
    console.log(`  - Failed: ${result.summary.failureCount}`);
    console.log(`  - Total properties found: ${result.summary.totalProperties}\n`);

    if (result.results.length > 0 && result.results[0].properties.length > 0) {
      console.log('Sample property:');
      const sample = result.results[0].properties[0];
      console.log(JSON.stringify(sample, null, 2));
    }

  } catch (error) {
    console.error('❌ Job failed or timed out:', error.message);
  }

  console.log('\n✅ Test complete!');
  console.log('\n💡 View live monitoring at:');
  console.log('   - Prometheus: http://localhost:9090');
  console.log('   - Metrics: http://localhost:3000/metrics\n');

  process.exit(0);
}

// Run the test
runTest().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
