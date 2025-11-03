import { scraperQueue } from '../queues/scraper.queue';
import { prisma } from '../lib/prisma';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'continuous-scraper.log' }),
  ],
});

const TARGET_PROPERTIES = 400000;
// Using API-based scraping (1000+ results per search). Optimized for high-yield search terms.
// Batch size kept moderate since each successful search now returns 50-1000x more results.
const BATCH_SIZE = 75;
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds
const CHECK_INTERVAL = 60000; // Check every minute

// Generate diverse search patterns
class SearchPatternGenerator {
  private usedTerms = new Set<string>();
  private dbTermsLoaded = false;
  private lastDbRefresh = 0;
  private readonly DB_REFRESH_INTERVAL = 60 * 60 * 1000; // Refresh every hour

  // Common first names (top 200)
  private firstNames = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
    'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
    'Kenneth', 'Dorothy', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa',
    'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Sharon',
    'Jeffrey', 'Laura', 'Ryan', 'Cynthia', 'Jacob', 'Kathleen', 'Gary', 'Amy',
    'Nicholas', 'Shirley', 'Eric', 'Angela', 'Jonathan', 'Helen', 'Stephen', 'Anna',
    'Larry', 'Brenda', 'Justin', 'Pamela', 'Scott', 'Nicole', 'Brandon', 'Emma',
    'Benjamin', 'Samantha', 'Samuel', 'Katherine', 'Raymond', 'Christine', 'Gregory', 'Debra',
    'Frank', 'Rachel', 'Alexander', 'Catherine', 'Patrick', 'Carolyn', 'Raymond', 'Janet',
    'Jack', 'Ruth', 'Dennis', 'Maria', 'Jerry', 'Heather', 'Tyler', 'Diane',
    'Aaron', 'Virginia', 'Jose', 'Julie', 'Adam', 'Joyce', 'Henry', 'Victoria',
    'Nathan', 'Olivia', 'Douglas', 'Kelly', 'Zachary', 'Christina', 'Peter', 'Lauren',
    'Kyle', 'Joan', 'Walter', 'Evelyn', 'Ethan', 'Judith', 'Jeremy', 'Megan',
    'Harold', 'Cheryl', 'Keith', 'Andrea', 'Christian', 'Hannah', 'Roger', 'Jacqueline',
    'Noah', 'Martha', 'Gerald', 'Gloria', 'Carl', 'Teresa', 'Terry', 'Ann',
    'Sean', 'Sara', 'Austin', 'Madison', 'Arthur', 'Frances', 'Lawrence', 'Kathryn',
    'Jesse', 'Janice', 'Dylan', 'Jean', 'Bryan', 'Abigail', 'Joe', 'Sophia',
    'Jordan', 'Judy', 'Billy', 'Theresa', 'Bruce', 'Rose', 'Albert', 'Beverly',
    'Willie', 'Denise', 'Gabriel', 'Marilyn', 'Logan', 'Amber', 'Alan', 'Danielle',
    'Juan', 'Brittany', 'Wayne', 'Diana', 'Roy', 'Natalie', 'Ralph', 'Sophia',
    'Randy', 'Alexis', 'Eugene', 'Lori', 'Vincent', 'Kayla', 'Russell', 'Jane',
    'Louis', 'Grace', 'Philip', 'Judy', 'Bobby', 'Alice', 'Johnny', 'Julia',
  ];

  // Common last names (top 200)
  private lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker',
    'Cruz', 'Edwards', 'Collins', 'Reyes', 'Stewart', 'Morris', 'Morales', 'Murphy',
    'Cook', 'Rogers', 'Gutierrez', 'Ortiz', 'Morgan', 'Cooper', 'Peterson', 'Bailey',
    'Reed', 'Kelly', 'Howard', 'Ramos', 'Kim', 'Cox', 'Ward', 'Richardson',
    'Watson', 'Brooks', 'Chavez', 'Wood', 'James', 'Bennett', 'Gray', 'Mendoza',
    'Ruiz', 'Hughes', 'Price', 'Alvarez', 'Castillo', 'Sanders', 'Patel', 'Myers',
    'Long', 'Ross', 'Foster', 'Jimenez', 'Powell', 'Jenkins', 'Perry', 'Russell',
    'Sullivan', 'Bell', 'Coleman', 'Butler', 'Henderson', 'Barnes', 'Gonzales', 'Fisher',
    'Vasquez', 'Simmons', 'Romero', 'Jordan', 'Patterson', 'Alexander', 'Hamilton', 'Graham',
    'Reynolds', 'Griffin', 'Wallace', 'Moreno', 'West', 'Cole', 'Hayes', 'Bryant',
    'Herrera', 'Gibson', 'Ellis', 'Tran', 'Medina', 'Aguilar', 'Stevens', 'Murray',
    'Ford', 'Castro', 'Marshall', 'Owens', 'Harrison', 'Fernandez', 'McDonald', 'Woods',
    'Washington', 'Kennedy', 'Wells', 'Vargas', 'Henry', 'Chen', 'Freeman', 'Webb',
    'Tucker', 'Guzman', 'Burns', 'Crawford', 'Olson', 'Simpson', 'Porter', 'Hunter',
    'Gordon', 'Mendez', 'Silva', 'Shaw', 'Snyder', 'Mason', 'Dixon', 'Munoz',
    'Hunt', 'Hicks', 'Holmes', 'Palmer', 'Wagner', 'Black', 'Robertson', 'Boyd',
    'Rose', 'Stone', 'Salazar', 'Fox', 'Warren', 'Mills', 'Meyer', 'Rice',
    'Schmidt', 'Garza', 'Daniels', 'Ferguson', 'Nichols', 'Stephens', 'Soto', 'Weaver',
    'Ryan', 'Gardner', 'Payne', 'Grant', 'Dunn', 'Kelley', 'Spencer', 'Hawkins',
  ];

  // Austin/Travis County street names (expanded)
  private streetNames = [
    'Main', 'Oak', 'Lamar', 'Congress', 'Guadalupe', 'Burnet', 'Airport', 'Oltorf',
    'Anderson', 'Bee Cave', 'Slaughter', 'William Cannon', 'Research', 'Parmer', 'Braker',
    'Rundberg', 'North Loop', 'South Lamar', 'East Riverside', 'West Anderson',
    'South Congress', 'Red River', 'Rainey', 'Cesar Chavez', 'MLK', 'Dean Keeton',
    'Speedway', 'Duval', 'Shoal Creek', 'Koenig', 'Far West', 'Research Blvd',
    'South First', 'East 7th', 'West 6th', 'Barton Springs', 'Westlake', 'Exposition',
    'Windsor', 'Enfield', 'Balcones', 'Spicewood', 'Capital of Texas', 'Cameron',
    'Metric', 'Dessau', 'Lamar Blvd', 'IH 35', 'Loop 360', 'Wells Branch',
    'McNeil', 'Howard', 'Jollyville', 'Mopac', 'Manchaca', 'Riverside',
    'Guadalupe', 'Rio Grande', 'Nueces', 'San Antonio', 'Lavaca', 'Colorado',
    'Brazos', 'San Jacinto', 'Trinity', 'Neches', 'Sabine', 'Blanco',
    'Manor', 'Martin Luther King', 'Airport', 'Pleasant Valley', 'Springdale',
    'Loyola', 'Berkman', 'Mueller', 'Cherrywood', 'Hancock',
  ];

  // Property types and building names (expanded)
  private propertyTypes = [
    'Apartments', 'Condos', 'Townhomes', 'Office', 'Retail', 'Plaza', 'Center',
    'Building', 'Tower', 'Park', 'Ranch', 'Estates', 'Village', 'Square',
    'Commons', 'Crossing', 'Landing', 'Pointe', 'Ridge', 'Creek', 'Hills',
    'Woods', 'Grove', 'Meadows', 'Terrace', 'Court', 'Place',
    'Lofts', 'Flats', 'Studios', 'Villas', 'Gardens', 'Heights', 'Trails',
    'Vista', 'Reserve', 'Springs', 'Oaks', 'Pines', 'Palms', 'Lake',
  ];

  // Business/Company suffixes (expanded)
  private businessSuffixes = [
    'LLC', 'Inc', 'Corp', 'LTD', 'Company', 'Properties', 'Investments',
    'Holdings', 'Ventures', 'Group', 'Partners', 'Trust', 'Foundation',
    'Realty', 'Real Estate', 'Development', 'Developers', 'Capital',
    'Management', 'Equity', 'Assets', 'Portfolio',
  ];

  // Austin neighborhoods and subdivisions
  private neighborhoods = [
    'Hyde Park', 'Clarksville', 'Bouldin Creek', 'Travis Heights', 'Zilker',
    'Allandale', 'Crestview', 'Rosedale', 'North Loop', 'Mueller',
    'East Austin', 'South Congress', 'Barton Hills', 'Tarrytown', 'West Lake',
    'Circle C', 'Steiner Ranch', 'Avery Ranch', 'Anderson Mill', 'Brushy Creek',
    'Wells Branch', 'Walnut Creek', 'Windsor Park', 'Cherrywood', 'Hancock',
    'Brentwood', 'North Shoal Creek', 'Gracywoods', 'Balcones', 'Great Hills',
  ];

  // Common property descriptors
  private propertyDescriptors = [
    'Home', 'House', 'Property', 'Land', 'Lot', 'Parcel', 'Tract',
    'Residence', 'Unit', 'Suite', 'Space', 'Commercial', 'Residential',
  ];

  // Load all previously used search terms from database to avoid duplicates
  async loadUsedTermsFromDatabase(forceRefresh = false): Promise<void> {
    const now = Date.now();

    // Check if we need to refresh
    if (!forceRefresh && this.dbTermsLoaded && (now - this.lastDbRefresh) < this.DB_REFRESH_INTERVAL) {
      return; // Already loaded and not time to refresh yet
    }

    const isRefresh = this.dbTermsLoaded;
    logger.info(isRefresh ? '🔄 Refreshing search terms from database...' : '📚 Loading previously used search terms from database...');

    try {
      const previousCount = this.usedTerms.size;

      // Get all unique search terms from scrape jobs
      const existingTerms = await prisma.scrapeJob.findMany({
        select: {
          searchTerm: true,
        },
        distinct: ['searchTerm'],
      });

      // Add all terms to the set (Set automatically handles duplicates)
      existingTerms.forEach(job => {
        this.usedTerms.add(job.searchTerm);
      });

      const currentCount = this.usedTerms.size;
      const newTermsFound = currentCount - previousCount;

      if (isRefresh) {
        logger.info(`✅ Refreshed: ${currentCount.toLocaleString()} total terms (${newTermsFound} new since last check)`);
      } else {
        logger.info(`✅ Loaded ${currentCount.toLocaleString()} previously used search terms`);
        logger.info(`   Will avoid duplicates like: "Estate", "Family", "Trust", etc.`);
      }

      this.dbTermsLoaded = true;
      this.lastDbRefresh = now;
    } catch (error) {
      logger.error('❌ Failed to load used terms from database:', error);
      throw error;
    }
  }

  async getNextBatch(batchSize: number): Promise<string[]> {
    // Load or refresh database terms (automatic hourly refresh)
    await this.loadUsedTermsFromDatabase();
    const batch: string[] = [];

    // Weighted strategies - OPTIMIZED FOR VOLUME based on actual performance data:
    // Analysis of 3,754 successful searches found:
    //   - Single Last Names: 70.3 avg properties (BEST)
    //   - Street Names: 24.4 avg properties (GREAT)
    //   - Short Codes: 12.6 avg properties (GOOD)
    //   - Business Names: 6.7 avg properties (OK)
    //   - Full Names: 4.4 avg properties (INEFFICIENT - removed)
    //   - Street Addresses: 2.1 avg properties (WORST - removed)
    const strategies = [
      { fn: () => this.generateLastNameOnly(), weight: 45 },          // 70.3 avg props - BEST PERFORMER
      { fn: () => this.generateStreetNameOnly(), weight: 25 },        // 24.4 avg props - GREAT
      { fn: () => this.generateCompoundName(), weight: 15 },          // Trusts/Families/Estates - HIGH YIELD
      { fn: () => this.generateBusinessName(), weight: 15 },          // 6.7 avg props - DECENT
      { fn: () => this.generateNeighborhood(), weight: 8 },           // Good for area coverage
      { fn: () => this.generatePropertyType(), weight: 5 },           // Moderate yield
      { fn: () => this.generateFourLetterWord(), weight: 3 },         // Short terms work well
      { fn: () => this.generatePropertyWithDescriptor(), weight: 2 }, // Low priority
      { fn: () => this.generateTwoLetterCombo(), weight: 1 },         // Alphanumeric codes - minimal
      { fn: () => this.generateThreeLetterCombo(), weight: 1 },       // Alphanumeric codes - minimal
      // REMOVED inefficient strategies based on data analysis:
      // - generateFullName() - only 4.4 avg props (16x worse than last names)
      // - generateStreetAddress() - only 2.1 avg props (33x worse than last names)
      // - generatePartialAddress() - still has numbers, inefficient
      // - generateStreetNumber() - pure numbers removed as inefficient
      // - generateNumberPattern() - pure numbers removed as inefficient
    ];

    // Create weighted array
    const weightedStrategies: (() => string)[] = [];
    strategies.forEach(s => {
      for (let i = 0; i < s.weight; i++) {
        weightedStrategies.push(s.fn);
      }
    });

    let attempts = 0;
    let duplicatesSkipped = 0;
    const maxAttempts = batchSize * 10;

    while (batch.length < batchSize && attempts < maxAttempts) {
      attempts++;
      const strategy = weightedStrategies[Math.floor(Math.random() * weightedStrategies.length)];
      const term = strategy();

      // Check if term is valid and not a duplicate
      if (term && term.length >= 4) {
        if (!this.usedTerms.has(term)) {
          this.usedTerms.add(term);
          batch.push(term);
        } else {
          duplicatesSkipped++;
        }
      }
    }

    // Log statistics about duplicates
    if (duplicatesSkipped > 0) {
      logger.info(`   ⚠️  Skipped ${duplicatesSkipped} duplicates (e.g., already used terms)`);
    }

    return batch;
  }

  private generateFullName(): string {
    const first = this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    const last = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    return `${first} ${last}`;
  }

  private generateLastNameOnly(): string {
    return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
  }

  private generateStreetAddress(): string {
    const number = Math.floor(Math.random() * 9999) + 1;
    const street = this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
    return `${number} ${street}`;
  }

  private generatePropertyType(): string {
    return this.propertyTypes[Math.floor(Math.random() * this.propertyTypes.length)];
  }

  private generateBusinessName(): string {
    const name = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    const suffix = this.businessSuffixes[Math.floor(Math.random() * this.businessSuffixes.length)];
    return `${name} ${suffix}`;
  }

  private generateStreetNameOnly(): string {
    return this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
  }

  private generateNumberPattern(): string {
    const patterns = ['1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000'];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  private generateTwoLetterCombo(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const l1 = letters[Math.floor(Math.random() * letters.length)];
    const l2 = letters[Math.floor(Math.random() * letters.length)];
    const number = Math.floor(Math.random() * 99) + 1;
    return `${l1}${l2} ${number}`;
  }

  private generateThreeLetterCombo(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const l1 = letters[Math.floor(Math.random() * letters.length)];
    const l2 = letters[Math.floor(Math.random() * letters.length)];
    const l3 = letters[Math.floor(Math.random() * letters.length)];
    return `${l1}${l2}${l3}${Math.floor(Math.random() * 9)}`;
  }

  private generateFourLetterWord(): string {
    const words = ['Park', 'Lake', 'Hill', 'Wood', 'Glen', 'Dale', 'View', 'Rock', 'Pine', 'Sage'];
    return words[Math.floor(Math.random() * words.length)];
  }

  // NEW: Generate neighborhood name
  private generateNeighborhood(): string {
    return this.neighborhoods[Math.floor(Math.random() * this.neighborhoods.length)];
  }

  // NEW: Generate property type with descriptor
  private generatePropertyWithDescriptor(): string {
    const type = this.propertyTypes[Math.floor(Math.random() * this.propertyTypes.length)];
    const descriptor = this.propertyDescriptors[Math.floor(Math.random() * this.propertyDescriptors.length)];
    return Math.random() > 0.5 ? `${type} ${descriptor}` : type;
  }

  // NEW: Generate partial street address (just number + street, more common)
  private generatePartialAddress(): string {
    const number = Math.floor(Math.random() * 9999) + 1;
    const street = this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
    const words = street.split(' ');
    // Sometimes use just first word of street name for broader matches
    return Math.random() > 0.3 ? `${number} ${street}` : `${number} ${words[0]}`;
  }

  // NEW: Generate compound name patterns (common in trusts/estates)
  private generateCompoundName(): string {
    const last1 = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    const last2 = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    const patterns = [
      `${last1} & ${last2}`,
      `${last1} Family`,
      `${last1} Estate`,
      `${last1} Trust`,
      `${last1}-${last2}`,
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
  }

  // NEW: Generate just street numbers (catches all properties on that block)
  private generateStreetNumber(): string {
    // Focus on common street number ranges in Austin
    const ranges = [
      () => Math.floor(Math.random() * 1000) + 1,       // 1-1000
      () => Math.floor(Math.random() * 1000) + 1000,    // 1000-2000
      () => Math.floor(Math.random() * 1000) + 2000,    // 2000-3000
      () => Math.floor(Math.random() * 2000) + 3000,    // 3000-5000
      () => Math.floor(Math.random() * 5000) + 5000,    // 5000-10000
    ];
    const rangeGenerator = ranges[Math.floor(Math.random() * ranges.length)];
    return rangeGenerator().toString();
  }
}

class ContinuousBatchScraper {
  private generator = new SearchPatternGenerator();
  private stats = {
    totalQueued: 0,
    batchesProcessed: 0,
    startTime: Date.now(),
    startingPropertyCount: 0,
  };
  private running = true;

  async run() {
    logger.info('╔════════════════════════════════════════════════════════╗');
    logger.info('║   CONTINUOUS BATCH SCRAPER - VOLUME OPTIMIZED         ║');
    logger.info('║   Target: 400,000 | Focus: High-Yield Search Terms    ║');
    logger.info('╚════════════════════════════════════════════════════════╝\n');

    // Get starting property count
    this.stats.startingPropertyCount = await prisma.property.count();
    logger.info(`Starting property count: ${this.stats.startingPropertyCount.toLocaleString()}`);
    logger.info(`Target: ${TARGET_PROPERTIES.toLocaleString()}`);
    logger.info(`Remaining: ${(TARGET_PROPERTIES - this.stats.startingPropertyCount).toLocaleString()}\n`);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    // Start monitoring in background
    this.startMonitoring();

    // Main loop
    while (this.running) {
      const currentCount = await prisma.property.count();

      if (currentCount >= TARGET_PROPERTIES) {
        logger.info(`\n🎉 TARGET REACHED! Current count: ${currentCount.toLocaleString()}`);
        break;
      }

      // Check queue status
      const [waiting, active] = await Promise.all([
        scraperQueue.getWaitingCount(),
        scraperQueue.getActiveCount(),
      ]);

      // Queue threshold reduced from 500 to 100 because API method returns 50x more results
      // With old method: 500 searches * 20 results = 10,000 potential properties
      // With new method: 100 searches * 1000 results = 100,000 potential properties
      if (waiting + active < 100) {
        await this.queueBatch();
      } else {
        logger.info(`Queue full (${waiting} waiting, ${active} active). Waiting...`);
      }

      // Wait before next batch
      await this.delay(DELAY_BETWEEN_BATCHES);
    }

    await this.printFinalReport();
    process.exit(0);
  }

  private async queueBatch() {
    const searchTerms = await this.generator.getNextBatch(BATCH_SIZE);
    this.stats.batchesProcessed++;

    logger.info(`\n📦 Batch #${this.stats.batchesProcessed} (${searchTerms.length} terms)`);

    for (const searchTerm of searchTerms) {
      try {
        await scraperQueue.add(
          'scrape-properties',
          {
            searchTerm,
            userId: 'continuous-batch',
            scheduled: true,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: 100,
            removeOnFail: 50,
          }
        );

        this.stats.totalQueued++;
      } catch (error) {
        logger.error(`Failed to queue ${searchTerm}:`, error);
      }
    }

    logger.info(`✓ Queued ${searchTerms.length} jobs (Total: ${this.stats.totalQueued})`);
  }

  private startMonitoring() {
    setInterval(async () => {
      try {
        const [currentCount, waiting, active, completed, failed] = await Promise.all([
          prisma.property.count(),
          scraperQueue.getWaitingCount(),
          scraperQueue.getActiveCount(),
          scraperQueue.getCompletedCount(),
          scraperQueue.getFailedCount(),
        ]);

        const newProperties = currentCount - this.stats.startingPropertyCount;
        const progress = (currentCount / TARGET_PROPERTIES) * 100;
        const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const rate = newProperties / (elapsed / 60); // properties per minute

        logger.info(`
┌─────────────────────────────────────────────────────────┐
│ Runtime: ${hours}h ${minutes}m | Progress: ${progress.toFixed(2)}%
├─────────────────────────────────────────────────────────┤
│ Database:
│   📊 Current:     ${currentCount.toLocaleString().padStart(10)}
│   🆕 New:         ${newProperties.toLocaleString().padStart(10)}
│   🎯 Target:      ${TARGET_PROPERTIES.toLocaleString().padStart(10)}
│   📈 Remaining:   ${(TARGET_PROPERTIES - currentCount).toLocaleString().padStart(10)}
│   ⚡ Rate:        ${rate.toFixed(1)} props/min
├─────────────────────────────────────────────────────────┤
│ Queue:
│   ⏳ Waiting:     ${waiting.toString().padStart(6)}
│   🔄 Active:      ${active.toString().padStart(6)}
│   ✅ Completed:   ${completed.toString().padStart(6)}
│   ❌ Failed:      ${failed.toString().padStart(6)}
│   📦 Batches:     ${this.stats.batchesProcessed.toString().padStart(6)}
└─────────────────────────────────────────────────────────┘
        `);

        // Estimate time to completion
        if (rate > 0) {
          const remaining = TARGET_PROPERTIES - currentCount;
          const minutesRemaining = remaining / rate;
          const hoursRemaining = minutesRemaining / 60;
          logger.info(`⏱️  Estimated time to target: ${hoursRemaining.toFixed(1)} hours`);
        }
      } catch (error) {
        logger.error('Monitoring error:', error);
      }
    }, CHECK_INTERVAL);
  }

  private async printFinalReport() {
    const finalCount = await prisma.property.count();
    const elapsed = Math.floor((Date.now() - this.stats.startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);

    logger.info(`
╔══════════════════════════════════════════════════════════╗
║         CONTINUOUS SCRAPER FINAL REPORT                  ║
╚══════════════════════════════════════════════════════════╝

⏱️  Total Runtime: ${hours}h ${minutes}m

📊 Properties:
   • Starting:     ${this.stats.startingPropertyCount.toLocaleString()}
   • Final:        ${finalCount.toLocaleString()}
   • Added:        ${(finalCount - this.stats.startingPropertyCount).toLocaleString()}
   • Target:       ${TARGET_PROPERTIES.toLocaleString()}

📦 Jobs:
   • Total Queued: ${this.stats.totalQueued.toLocaleString()}
   • Batches:      ${this.stats.batchesProcessed}

╔══════════════════════════════════════════════════════════╗
║  🎉 SCRAPING SESSION COMPLETED! 🎉                       ║
╚══════════════════════════════════════════════════════════╝
    `);
  }

  private stop() {
    logger.info('\n🛑 Stopping continuous scraper...');
    this.running = false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the continuous scraper
const scraper = new ContinuousBatchScraper();
scraper.run().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
