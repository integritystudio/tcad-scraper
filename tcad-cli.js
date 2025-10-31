#!/usr/bin/env node

const {
  addBatch,
  processSearchTermsFromFile,
  getQueueStats,
  scrapingQueue,
} = require('./tcad-scraper');

const readline = require('readline');
const fs = require('fs').promises;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function displayMenu() {
  console.clear();
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║       TCAD Scraper - Job Management CLI          ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  console.log('1. Add search terms manually');
  console.log('2. Load search terms from file');
  console.log('3. View queue statistics');
  console.log('4. View recent jobs');
  console.log('5. Clear completed jobs');
  console.log('6. Clear failed jobs');
  console.log('7. Pause queue');
  console.log('8. Resume queue');
  console.log('9. Export results');
  console.log('0. Exit\n');
}

async function addManualSearchTerms() {
  console.log('\n📝 Enter search terms (comma-separated):');
  const input = await prompt('> ');
  
  const searchTerms = input
    .split(',')
    .map(term => term.trim())
    .filter(term => term.length > 0);

  if (searchTerms.length === 0) {
    console.log('❌ No valid search terms provided.');
    return;
  }

  console.log(`\n➕ Adding ${searchTerms.length} search term(s)...`);
  await addBatch(searchTerms);
  console.log('✅ Jobs added successfully!');
}

async function loadFromFile() {
  console.log('\n📁 Enter file path:');
  const filePath = await prompt('> ');

  try {
    await processSearchTermsFromFile(filePath);
    console.log('✅ Search terms loaded and queued successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function viewQueueStats() {
  console.log('\n📊 Queue Statistics:\n');
  
  const stats = await getQueueStats();
  
  console.log(`   Waiting:   ${stats.waiting}`);
  console.log(`   Active:    ${stats.active}`);
  console.log(`   Completed: ${stats.completed}`);
  console.log(`   Failed:    ${stats.failed}`);
  console.log(`   Delayed:   ${stats.delayed}`);
  console.log(`   ─────────────────────`);
  console.log(`   Total:     ${stats.total}\n`);
}

async function viewRecentJobs() {
  console.log('\n📋 Recent Jobs:\n');

  const completed = await scrapingQueue.getCompleted(0, 9);
  const failed = await scrapingQueue.getFailed(0, 4);

  if (completed.length > 0) {
    console.log('✅ Completed Jobs:');
    for (const job of completed) {
      const result = await job.returnvalue;
      if (result && result.summary) {
        console.log(`   Job ${job.id}: ${result.summary.totalProperties} properties from ${result.summary.totalSearches} searches`);
      }
    }
    console.log();
  }

  if (failed.length > 0) {
    console.log('❌ Failed Jobs:');
    for (const job of failed) {
      console.log(`   Job ${job.id}: ${job.failedReason || 'Unknown error'}`);
    }
    console.log();
  }

  if (completed.length === 0 && failed.length === 0) {
    console.log('   No recent jobs found.\n');
  }
}

async function clearCompletedJobs() {
  console.log('\n🧹 Clearing completed jobs...');
  await scrapingQueue.clean(0, 1000, 'completed');
  console.log('✅ Completed jobs cleared!\n');
}

async function clearFailedJobs() {
  console.log('\n🧹 Clearing failed jobs...');
  await scrapingQueue.clean(0, 1000, 'failed');
  console.log('✅ Failed jobs cleared!\n');
}

async function pauseQueue() {
  console.log('\n⏸️  Pausing queue...');
  await scrapingQueue.pause();
  console.log('✅ Queue paused!\n');
}

async function resumeQueue() {
  console.log('\n▶️  Resuming queue...');
  await scrapingQueue.resume();
  console.log('✅ Queue resumed!\n');
}

async function exportResults() {
  console.log('\n💾 Enter output file path (e.g., results.json):');
  const filePath = await prompt('> ');

  console.log('\n📦 Fetching completed jobs...');
  
  const completed = await scrapingQueue.getCompleted();
  const allResults = [];

  for (const job of completed) {
    const result = await job.returnvalue;
    if (result && result.results) {
      for (const searchResult of result.results) {
        if (searchResult.properties) {
          allResults.push(...searchResult.properties);
        }
      }
    }
  }

  if (allResults.length === 0) {
    console.log('❌ No results to export.\n');
    return;
  }

  await fs.writeFile(filePath, JSON.stringify(allResults, null, 2));
  console.log(`✅ Exported ${allResults.length} properties to ${filePath}\n`);
}

async function main() {
  let running = true;

  while (running) {
    await displayMenu();
    const choice = await prompt('Select an option: ');

    switch (choice.trim()) {
      case '1':
        await addManualSearchTerms();
        break;
      case '2':
        await loadFromFile();
        break;
      case '3':
        await viewQueueStats();
        break;
      case '4':
        await viewRecentJobs();
        break;
      case '5':
        await clearCompletedJobs();
        break;
      case '6':
        await clearFailedJobs();
        break;
      case '7':
        await pauseQueue();
        break;
      case '8':
        await resumeQueue();
        break;
      case '9':
        await exportResults();
        break;
      case '0':
        console.log('\n👋 Goodbye!\n');
        running = false;
        break;
      default:
        console.log('\n❌ Invalid option. Please try again.\n');
    }

    if (running) {
      await prompt('\nPress Enter to continue...');
    }
  }

  rl.close();
  await scrapingQueue.close();
  process.exit(0);
}

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
