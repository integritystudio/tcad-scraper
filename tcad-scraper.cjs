const { Queue, Worker } = require('bullmq');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Redis connection configuration
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

// Queue for scraping jobs
const scrapingQueue = new Queue('tcad-scraping', { connection });

// Configuration
const CONFIG = {
  TCAD_URL: 'https://stage.travis.prodigycad.com/property-search',
  CONCURRENT_WORKERS: parseInt(process.env.CONCURRENT_WORKERS) || 3,
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 10,
  RETRY_ATTEMPTS: 3,
  TIMEOUT: 60000, // 60 seconds
};

/**
 * Scrape property data for a single search term
 */
async function scrapeProperty(searchTerm) {
  let browser;
  
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`🔍 Searching for: ${searchTerm}`);

    // Navigate to TCAD search page
    await page.goto(CONFIG.TCAD_URL, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.TIMEOUT,
    });

    // Wait for search input and enter search term
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', searchTerm);

    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results grid to load
    await page.waitForSelector('.ag-root', { timeout: 15000 });

    // Give extra time for all data to load
    await page.waitForTimeout(2000);

    // Get page HTML and parse with Cheerio
    const html = await page.content();
    const $ = cheerio.load(html);

    // Extract property data from results table
    const properties = [];
    $('.ag-row').each((index, element) => {
      const cells = $(element).find('.ag-cell');
      
      // Extract data from each cell
      const property = {
        searchTerm,
        ownerName: $(cells[0]).text().trim(),
        propertyType: $(cells[1]).text().trim(),
        city: $(cells[2]).text().trim(),
        propertyAddress: $(cells[3]).text().trim(),
        assessedValue: $(cells[4]).text().trim(),
        propertyId: $(cells[5]).text().trim(),
        appraisedValue: $(cells[6]).text().trim(),
        geographicId: $(cells[7]).text().trim(),
        legalDescription: $(cells[8]).text().trim(),
        scrapedAt: new Date().toISOString(),
      };

      // Only add if we have meaningful data
      if (property.ownerName || property.propertyAddress) {
        properties.push(property);
      }
    });

    console.log(`✅ Found ${properties.length} properties for "${searchTerm}"`);

    return {
      success: true,
      searchTerm,
      count: properties.length,
      properties,
    };

  } catch (error) {
    console.error(`❌ Error scraping "${searchTerm}":`, error.message);
    
    return {
      success: false,
      searchTerm,
      error: error.message,
      count: 0,
      properties: [],
    };

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Worker to process scraping jobs
 */
const worker = new Worker(
  'tcad-scraping',
  async (job) => {
    const { searchTerms, batchId } = job.data;

    console.log(`\n📦 Processing batch ${batchId} with ${searchTerms.length} search terms`);
    console.log(`Terms: ${searchTerms.join(', ')}`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each search term sequentially to avoid overwhelming the server
    for (const searchTerm of searchTerms) {
      try {
        // Update progress
        await job.updateProgress({
          current: results.length + 1,
          total: searchTerms.length,
          currentTerm: searchTerm,
        });

        const result = await scrapeProperty(searchTerm);
        results.push(result);

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Small delay between searches to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error processing "${searchTerm}":`, error);
        failureCount++;
        results.push({
          success: false,
          searchTerm,
          error: error.message,
          properties: [],
        });
      }
    }

    const summary = {
      batchId,
      totalSearches: searchTerms.length,
      successCount,
      failureCount,
      totalProperties: results.reduce((sum, r) => sum + r.count, 0),
      completedAt: new Date().toISOString(),
    };

    console.log(`\n✅ Batch ${batchId} completed:`);
    console.log(`   - Successful: ${successCount}`);
    console.log(`   - Failed: ${failureCount}`);
    console.log(`   - Total properties: ${summary.totalProperties}`);

    return {
      summary,
      results,
    };
  },
  {
    connection,
    concurrency: CONFIG.CONCURRENT_WORKERS,
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  }
);

// Worker event listeners
worker.on('completed', (job) => {
  console.log(`\n🎉 Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`\n❌ Job ${job.id} failed:`, err.message);
});

worker.on('progress', (job, progress) => {
  console.log(`📊 Job ${job.id} progress: ${progress.current}/${progress.total} - ${progress.currentTerm}`);
});

/**
 * Add a batch of search terms to the queue
 */
async function addBatch(searchTerms, options = {}) {
  // Split into batches if needed
  const batches = [];
  for (let i = 0; i < searchTerms.length; i += CONFIG.BATCH_SIZE) {
    batches.push(searchTerms.slice(i, i + CONFIG.BATCH_SIZE));
  }

  console.log(`\n📤 Adding ${batches.length} batch(es) with ${searchTerms.length} total search terms`);

  const jobs = [];
  for (let i = 0; i < batches.length; i++) {
    const batchId = `batch-${Date.now()}-${i}`;
    
    const job = await scrapingQueue.add(
      'scrape-batch',
      {
        batchId,
        searchTerms: batches[i],
      },
      {
        attempts: CONFIG.RETRY_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: false, // Keep completed jobs for history
        removeOnFail: false, // Keep failed jobs for debugging
        ...options,
      }
    );

    jobs.push(job);
    console.log(`   ✓ Added batch ${i + 1}/${batches.length} (Job ID: ${job.id})`);
  }

  return jobs;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    scrapingQueue.getWaitingCount(),
    scrapingQueue.getActiveCount(),
    scrapingQueue.getCompletedCount(),
    scrapingQueue.getFailedCount(),
    scrapingQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Example: Load search terms from file and add to queue
 */
async function processSearchTermsFromFile(filePath) {
  const fs = require('fs').promises;
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const searchTerms = content
      .split('\n')
      .map(term => term.trim())
      .filter(term => term.length > 0);

    console.log(`📄 Loaded ${searchTerms.length} search terms from ${filePath}`);
    
    return await addBatch(searchTerms);

  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await worker.close();
  await scrapingQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await worker.close();
  await scrapingQueue.close();
  process.exit(0);
});

// Export functions for use in other modules
module.exports = {
  addBatch,
  processSearchTermsFromFile,
  getQueueStats,
  scrapingQueue,
  worker,
};

// If run directly, start the worker
if (require.main === module) {
  console.log('🚀 TCAD Scraper Worker Started');
  console.log(`   - Concurrent workers: ${CONFIG.CONCURRENT_WORKERS}`);
  console.log(`   - Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log(`   - Redis: ${connection.host}:${connection.port}`);
  console.log('\n👂 Listening for jobs...');
  console.log('   Prometheus: http://localhost:9090');
  console.log('   Metrics at: http://localhost:3000/metrics\n');
}
