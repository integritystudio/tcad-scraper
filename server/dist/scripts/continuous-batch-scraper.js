"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const scraper_queue_1 = require("../queues/scraper.queue");
const prisma_1 = require("../lib/prisma");
const winston_1 = __importDefault(require("winston"));
const search_term_deduplicator_1 = require("../lib/search-term-deduplicator");
const search_term_optimizer_1 = require("../services/search-term-optimizer");
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.simple()),
    transports: [
        new winston_1.default.transports.Console(),
        new winston_1.default.transports.File({ filename: 'logs/continuous-scraper.log' }),
    ],
});
const TARGET_PROPERTIES = 451339;
// Using API-based scraping (1000+ results per search). Optimized for high-yield search terms.
// Batch size reduced to enable more frequent optimizations (every 50 jobs = ~2-3 batches)
const BATCH_SIZE = 25; // Reduced from 75 to 25 for faster optimization cycles
const DELAY_BETWEEN_BATCHES = 30000; // 30 seconds
const CHECK_INTERVAL = 60000; // Check every minute
// Generate diverse search patterns
class SearchPatternGenerator {
    usedTerms = new Set();
    deduplicator; // Initialized in loadUsedTerms
    dbTermsLoaded = false;
    lastDbRefresh = 0;
    DB_REFRESH_INTERVAL = 60 * 60 * 1000; // Refresh every hour
    optimizer;
    jobsProcessedSinceLastOptimization = 0;
    OPTIMIZATION_INTERVAL = 50; // Optimize after every 50 jobs
    // Common first names (top 200)
    firstNames = [
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
    // Common last names (expanded to 500+)
    lastNames = [
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
        // Additional 300+ names
        'Lawson', 'Pierce', 'Hart', 'Elliott', 'Cunningham', 'Knight', 'Bradley', 'Carroll',
        'Hudson', 'Duncan', 'Armstrong', 'Berry', 'Andrews', 'Johnston', 'Ray', 'Lane',
        'Riley', 'Carpenter', 'Perkins', 'Williamson', 'Hanson', 'Austin', 'Newman', 'Oliver',
        'Howell', 'Dean', 'Wells', 'Fleming', 'French', 'Cannon', 'Barker', 'Watts',
        'McCoy', 'McLaughlin', 'Caldwell', 'Chandler', 'Lambert', 'Norton', 'Blake', 'Maxwell',
        'Carr', 'Walsh', 'Little', 'Park', 'Hodges', 'Haynes', 'Burgess', 'Benson',
        'Bishop', 'Todd', 'Norris', 'Fuller', 'Barber', 'Lamb', 'Parsons', 'Sutton',
        'Welch', 'Paul', 'Schwartz', 'Newman', 'Manning', 'Goodman', 'Watkins', 'Lyons',
        'Dawson', 'Powers', 'Figueroa', 'Nash', 'McKenzie', 'Booth', 'Shelton', 'Moran',
        'Rojas', 'Frank', 'Conner', 'Brock', 'Hogan', 'Brady', 'McCormick', 'Parks',
        'Floyd', 'Steele', 'Townsend', 'Valdez', 'Dennis', 'Hale', 'Delgado', 'Sutherland',
        'Buchanan', 'Marsh', 'Cummings', 'Patton', 'Rowe', 'Hampton', 'Lang', 'Gross',
        'Garner', 'Vincent', 'Doyle', 'Ramsey', 'Thornton', 'Wolfe', 'Glass', 'McCarthy',
        'Bowman', 'Luna', 'Norman', 'Pearson', 'Floyd', 'Mullins', 'Gregory', 'Schwartz',
        'Singleton', 'Wilkins', 'Schneider', 'Bowen', 'Hoffman', 'Logan', 'Cross', 'Moss',
        'Richards', 'Harmon', 'Brady', 'Rodgers', 'Duran', 'Hubbard', 'Bates', 'Reeves',
        'Klein', 'Frazier', 'Gibbs', 'Craig', 'Cochran', 'Chase', 'Moss', 'McKinney',
        'Bauer', 'Robbins', 'Curry', 'Sawyer', 'Powers', 'Jensen', 'Walters', 'Huff',
        'Aguilar', 'Glover', 'Browning', 'Carson', 'Mack', 'Clayton', 'Fritz', 'Hansen',
        'Schultz', 'Rich', 'Webster', 'Malone', 'Hammond', 'Flowers', 'Cobb', 'Moody',
        'Quinn', 'Randall', 'Brewer', 'Hutchinson', 'Holden', 'Wiley', 'Rowland', 'Mejia',
        'Sweeney', 'Dale', 'Frederick', 'Dalton', 'Logan', 'Sellers', 'Monroe', 'Hickman',
        'Gill', 'Cannon', 'Savage', 'Ballard', 'Joseph', 'Crosby', 'Drake', 'Vaughn',
        'Walls', 'Bolton', 'Chan', 'Stokes', 'Bentley', 'Skinner', 'Woodward', 'Brennan',
        'Hayden', 'Hancock', 'Huang', 'Pearce', 'Ingram', 'Reese', 'Lang', 'Spence',
        'Carey', 'Bird', 'Hess', 'Morse', 'Santiago', 'Leon', 'Krueger', 'Cochran',
        'Pratt', 'Valencia', 'Jarvis', 'Sharp', 'Oconnor', 'Levine', 'Flynn', 'Chang',
        'Yates', 'Nolan', 'Zuniga', 'Maddox', 'Whitehead', 'Gallagher', 'Michael', 'Cooke',
        'Sanford', 'Pitts', 'Haley', 'Hanna', 'Hatfield', 'Hoover', 'Decker', 'Davila',
        'Vega', 'Stafford', 'Cain', 'Dillon', 'Wiggins', 'Mathews', 'Krause', 'McMillan',
        'Kent', 'Holt', 'Shaffer', 'Dyer', 'Koch', 'Blackburn', 'Riddle', 'Shields',
        'Hendrix', 'Mahoney', 'Morrow', 'Collier', 'Stein', 'Best', 'Blanchard', 'Melton',
        'Maynard', 'Mercer', 'Osborne', 'Albert', 'Acosta', 'Petty', 'Winters', 'Trujillo',
        'Jennings', 'Conley', 'Prince', 'McGuire', 'Waller', 'Barr', 'Dickson', 'Stuart',
        'Potts', 'Valentine', 'Frost', 'Gentry', 'Hester', 'Cantrell', 'Ayers', 'Blevins',
        'Holman', 'Donovan', 'Bradshaw', 'English', 'Hahn', 'Aaron', 'Barton', 'Hendricks',
        'Church', 'Rosales', 'Howe', 'Everett', 'Gould', 'Harrington', 'Oneal', 'Bean',
        'Villanueva', 'Schroeder', 'Solomon', 'Summers', 'Dougherty', 'Livingston', 'Pace', 'Avila',
        'Knox', 'Dunlap', 'Saunders', 'Alvarado', 'Hayden', 'Greer', 'Roman', 'Buck',
        'Hines', 'Weeks', 'Witt', 'Navarro', 'Juarez', 'Cervantes', 'Carey', 'Garrett',
        'Lowe', 'Dodd', 'Duke', 'Pena', 'Costa', 'Galloway', 'Tate', 'Mayer',
        'Meyers', 'Schaefer', 'Noel', 'Kruger', 'Giles', 'Crosby', 'Sloan', 'Wyatt',
        'Johns', 'Ramsey', 'Ibarra', 'Escobar', 'Whitaker', 'Joyce', 'Burnett', 'Wall',
        'Barlow', 'Randolph', 'Atkinson', 'Horn', 'Clements', 'Floyd', 'Dodson', 'Lowery',
        'Ashley', 'Moon', 'Buchanan', 'Nava', 'Proctor', 'Pruitt', 'Phelps', 'Hinton',
    ];
    // Austin/Travis County street names (expanded to 150+)
    streetNames = [
        'Main', 'Oak', 'Lamar', 'Congress', 'Guadalupe', 'Burnet', 'Airport', 'Oltorf',
        'Anderson', 'Cave', 'Slaughter', 'Cannon', 'Research', 'Parmer', 'Braker',
        'Rundberg', 'Loop', 'Lamar', 'Riverside', 'Anderson',
        'Congress', 'Red R', 'Rainey', 'Chavez', 'MLK', 'Dean',
        'Speedway', 'Duval', 'Shoal', 'Koenig', 'Far W', 'Research', 'Blvd',
        'First', 'East 7th', 'West 6th', 'Barton Springs', 'Westlake', 'Exposition',
        'Windsor', 'Enfield', 'Balcones', 'Spicewood', 'Capital of Texas', 'Cameron',
        'Metric', 'Dessau', 'Lamar Blvd', 'IH 35', 'Loop 360', 'Wells Branch',
        'McNeil', 'Howard', 'Jollyville', 'Mopac', 'Manchaca', 'Riverside',
        'Guadalupe', 'Rio Grande', 'Nueces', 'San Antonio', 'Lavaca', 'Colorado',
        'Brazos', 'San Jacinto', 'Trinity', 'Neches', 'Sabine', 'Blanco',
        'Manor', 'Martin Luther King', 'Airport', 'Pleasant Valley', 'Springdale',
        'Loyola', 'Berkman', 'Mueller', 'Cherrywood', 'Hancock',
        // Additional Austin streets
        'Burnet Road', 'South 1st', 'East 6th', 'West 5th', 'East 11th', 'West 12th',
        'Guadalupe', 'Street', 'Avenue', 'Lavaca', 'Street', 'Brazos', 'Boulevard',
        'Red River', 'Trinity', 'Neches', 'Sabine', 'Waller Street',
        'San Marcos', 'Cesar Chavez', 'East Cesar Chavez', 'Drive', 'Town Lake',
        'Manor', 'Airport', 'Koenig Lane', 'North Lamar', 'South Lamar Boulevard',
        'Mopac Expressway', 'Loop 1', 'Highway 183', 'Ben White', 'Highway 290',
        'FM 620', 'FM 2222', 'RM 2244', 'RM 620', 'Lakeline Boulevard',
        'Cedar Park', 'Anderson Lane', 'Steck Avenue', 'Spicewood Springs', 'Mesa Drive',
        'Hill', 'Boulevard', 'Lane', 'Burnet', 'Drive', 'Road', "East", "West", "Avenue", "Ave.",
        'Dittmar', 'Montopolis', 'South', 'North', 'Crossing', 'Fall',
        'Del Valle', 'Webberville', 'Creek', 'Johnny Morris', 'Cameron Road', 'Airport', 'Springdale', 'General',
        '4th S', '5th S', '2nd S', '3rd S', 'Square',
        'West Lynn', 'Park', 'Square', 'Place', 'San G',
    ];
    // Property types and building names (expanded)
    propertyTypes = [
        'Apartments', 'Condos', 'Townhomes', 'Office', 'Retail', 'Plaza', 'Center',
        'Building', 'Tower', 'Park', 'Ranch', 'Estates', 'Village', 'Square',
        'Commons', 'Crossing', 'Landing', 'Pointe', 'Ridge', 'Creek', 'Hills',
        'Woods', 'Grove', 'Meadows', 'Terrace', 'Court', 'Place',
        'Lofts', 'Flats', 'Studios', 'Villas', 'Gardens', 'Heights', 'Trails',
        'Vista', 'Reserve', 'Springs', 'Oaks', 'Pines', 'Palms', 'Lake',
        'Ranch', 'Farm', 'Pecan', 'Walnut', 'River', 'Lake', 'Mount', 'Ridge',
    ];
    // Business/Company suffixes (optimized for high success rate)
    // ONLY legal entity types and proven real estate terms
    // Removed generic terms that cause zero-results: Ventures, Development, Developers,
    // Real Estate, Management, Equity, Assets, Portfolio (26% zero-result rate)
    businessSuffixes = [
        'LLC', // Legal entity - high reliability
        'Inc', // Legal entity - high reliability
        'Corp', // Legal entity - high reliability
        'Partner', // Legal entity
        'Develop', // Covers 'Developers'/'Development'/etc.
        'LTD', // Legal entity - high reliability
        'Company', // Legal entity - high reliability
        'Properties', // Real estate specific - proven
        'Trust', // Real estate specific - proven
        'Real', // Real estate specific - proven
        'Holding', // Investment specific - proven
        'Assoc', // Association/Associates, etc.
    ];
    // Austin neighborhoods and subdivisions (expanded to 75+)
    neighborhoods = [
        'Hyde', 'Park', 'Clark', 'ville', 'Bouldin', 'Creek', 'Travis', 'Heights', 'Zilker',
        'Allandale', 'Crestview', 'Rosedale', 'Loop', 'Mueller',
        'East Austin', 'South Congress', 'Barton', 'Tarrytown', 'West Lake',
        'Circle C', 'Ranch', 'Avery', 'Anderson Mill', 'Brushy Creek',
        'Wells Branch', 'Creek', 'Windsor Park', 'Cherrywood', 'Hancock',
        'Brentwood', 'Walnut', 'Gracywoods', 'Balcones', 'Great Hills',
        // Additional neighborhoods
        'Onion Creek', 'Barton Creek', 'Oak Hill', 'Sunset Valley', 'Rollingwood',
        'West Campus', 'East Cesar Chavez', 'Holly', 'Govalle', 'Riverside',
        'Montopolis', 'Pleasant Valley', 'Del Valle', 'Dove Springs', 'Southpark Meadows',
        'St. Edwards', 'St. Johns', 'North University', 'Wooten', 'Highland',
        'Heritage', 'Pemberton Heights', 'Old West Austin', 'Bryker Woods', 'Old Enfield',
        'Judges', 'Crest', 'Northwest', 'Estates', 'Ridgetop',
        'Spicewood', 'Bull', 'Mesa Park', 'Westover Hills', 'Rollingwood West', 'Lost Creek',
        'Senna', 'Ranch at Cypress Creek', 'Sendero Springs', 'Falconhead', 'Shady Hollow',
        'Eanes', 'Rob Roy', 'Courtyard', 'Sendera',
        'Belterra', 'Canyon', 'Maple Run', 'Common', 'Acres', 'Spring',
    ];
    // Common property descriptors
    propertyDescriptors = [
        'Home', 'House', 'Property', 'Land', 'Lot', 'Parcel', 'Tract',
        'Residence', 'Unit', 'Suite', 'Space', 'Commercial', 'Residential',
        'Condo', 'Comm', 'Ste.'
    ];
    constructor() {
        this.optimizer = search_term_optimizer_1.searchTermOptimizer;
    }
    // Load all previously used search terms from database to avoid duplicates
    async loadUsedTermsFromDatabase(forceRefresh = false) {
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
            const existingTerms = await prisma_1.prisma.scrapeJob.findMany({
                select: {
                    searchTerm: true,
                },
                distinct: ['searchTerm'],
            });
            // Add all terms to the set (Set automatically handles duplicates)
            existingTerms.forEach(job => {
                this.usedTerms.add(job.searchTerm);
            });
            // Initialize or update the deduplicator with current terms
            if (!this.deduplicator) {
                this.deduplicator = new search_term_deduplicator_1.SearchTermDeduplicator(this.usedTerms);
            }
            const currentCount = this.usedTerms.size;
            const newTermsFound = currentCount - previousCount;
            if (isRefresh) {
                logger.info(`✅ Refreshed: ${currentCount.toLocaleString()} total terms (${newTermsFound} new since last check)`);
            }
            else {
                logger.info(`✅ Loaded ${currentCount.toLocaleString()} previously used search terms`);
                logger.info(`   Will avoid duplicates like: "Estate", "Family", "Trust", etc.`);
            }
            this.dbTermsLoaded = true;
            this.lastDbRefresh = now;
        }
        catch (error) {
            logger.error({ err: error }, '❌ Failed to load used terms from database:');
            throw error;
        }
    }
    generateLastNameOnly() {
        return this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
    }
    generateStreetAddress() {
        const number = Math.floor(Math.random() * 9999) + 1;
        const street = this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
        return `${number} ${street}`;
    }
    generatePropertyType() {
        return this.propertyTypes[Math.floor(Math.random() * this.propertyTypes.length)];
    }
    generateBusinessName() {
        const name = this.lastNames[Math.floor(Math.random() * this.lastNames.length)];
        const suffix = this.businessSuffixes[Math.floor(Math.random() * this.businessSuffixes.length)];
        return `${name} ${suffix}`;
    }
    generateStreetNameOnly() {
        return this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
    }
    generateFourLetterWord() {
        const words = ['Park', 'Lake', 'Hill', 'Wood', 'Glen', 'Dale', 'View', 'Rock', 'Pine', 'Sage'];
        return words[Math.floor(Math.random() * words.length)];
    }
    // NEW: Generate neighborhood name
    generateNeighborhood() {
        return this.neighborhoods[Math.floor(Math.random() * this.neighborhoods.length)];
    }
    // NEW: Generate property type with descriptor
    generatePropertyWithDescriptor() {
        const type = this.propertyTypes[Math.floor(Math.random() * this.propertyTypes.length)];
        const descriptor = this.propertyDescriptors[Math.floor(Math.random() * this.propertyDescriptors.length)];
        return Math.random() > 0.5 ? `${type} ${descriptor}` : type;
    }
    // NEW: Generate partial street address (just number + street, more common)
    generatePartialAddress() {
        const number = Math.floor(Math.random() * 9999) + 1;
        const street = this.streetNames[Math.floor(Math.random() * this.streetNames.length)];
        const words = street.split(' ');
        // Sometimes use just first word of street name for broader matches
        return Math.random() > 0.3 ? `${number} ${street}` : `${number} ${words[0]}`;
    }
    // OPTIMIZED: Generate first names only (HIGH YIELD - avg 426+ properties)
    generateFirstNameOnly() {
        return this.firstNames[Math.floor(Math.random() * this.firstNames.length)];
    }
    // OPTIMIZED: Generate common street suffixes (VERY HIGH YIELD - avg 637+ properties)
    generateStreetSuffix() {
        const suffixes = ['Avenue', 'Boulevard', 'Court', 'Drive', 'Lane', 'Circle',
            'Place', 'Way', 'Trail', 'Path', 'Bend', 'Loop', 'Terrace',
            'Parkway', 'Ridge', 'Hill', 'Manor'];
        return suffixes[Math.floor(Math.random() * suffixes.length)];
    }
    // OPTIMIZED: Generate 4-letter geographic terms (HIGH YIELD - avg 637+ properties)
    generateGeographicTerm() {
        const terms = ['Hill', 'Lake', 'Cave', 'Park', 'Glen', 'Dale', 'Ford',
            'Cove', 'Rock', 'Wood', 'Farm', 'Mill', 'Pond', 'Peak'];
        return terms[Math.floor(Math.random() * terms.length)];
    }
    // OPTIMIZED: Generate Hispanic/Asian surnames (HIGH YIELD - avg 2000+ properties each)
    generateHispanicAsianSurname() {
        const names = ['Garcia', 'Hernandez', 'Lopez', 'Gonzalez', 'Perez', 'Sanchez',
            'Rivera', 'Torres', 'Ramirez', 'Flores', 'Gomez', 'Cruz',
            'Lee', 'Chen', 'Wang', 'Kim', 'Patel', 'Singh', 'Chang', 'Nguyen'];
        return names[Math.floor(Math.random() * names.length)];
    }
    /**
     * Optimize search strategy based on actual performance data every 50 jobs
     * This analyzes completed jobs and suggests high-performing terms
     */
    async optimizeStrategy() {
        logger.info('\n🔧 Optimizing search strategy based on performance data...');
        try {
            // Get performance stats
            const stats = await this.optimizer.getPerformanceStats();
            logger.info(`📊 Analyzed ${stats.totalSearchTerms} unique search terms`);
            logger.info(`   Avg efficiency: ${stats.avgEfficiency.toFixed(2)}`);
            logger.info(`   Avg success rate: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
            logger.info(`   Avg results per search: ${stats.avgResultsPerSearch.toFixed(1)}`);
            // Get top performers
            if (stats.topPerformers.length > 0) {
                logger.info(`\n🏆 Top 5 performing search terms:`);
                stats.topPerformers.slice(0, 5).forEach((term, i) => {
                    logger.info(`   ${i + 1}. "${term.searchTerm}" - ${term.avgResultsPerSearch.toFixed(0)} avg results, ${(term.successRate * 100).toFixed(0)}% success`);
                });
            }
            // Get optimized terms for next batch
            const optimizedTerms = await this.optimizer.getOptimizedTerms({
                minEfficiency: 5.0,
                minSuccessRate: 0.5,
                maxTermsToReturn: 30,
                excludeRecentlyUsed: true,
                recentDays: 1, // Only exclude terms used in last 24 hours
            });
            // Get suggested new terms based on successful patterns
            const suggestedTerms = await this.optimizer.suggestNewTerms(20);
            logger.info(`✨ Generated ${optimizedTerms.length} high-efficiency terms to prioritize`);
            logger.info(`💡 Suggested ${suggestedTerms.length} new terms based on successful patterns\n`);
            // Reset the counter
            this.jobsProcessedSinceLastOptimization = 0;
            // Combine optimized and suggested terms
            return [...optimizedTerms, ...suggestedTerms];
        }
        catch (error) {
            logger.error({ err: error }, '❌ Failed to optimize strategy:');
            return [];
        }
    }
    async getNextBatch(batchSize) {
        // Load or refresh database terms (automatic hourly refresh)
        await this.loadUsedTermsFromDatabase();
        // Check if we should optimize strategy every 50 jobs
        this.jobsProcessedSinceLastOptimization++;
        let optimizedTerms = [];
        if (this.jobsProcessedSinceLastOptimization >= this.OPTIMIZATION_INTERVAL) {
            optimizedTerms = await this.optimizeStrategy();
        }
        const batch = [];
        // Weighted strategies - OPTIMIZED based on actual performance (286K+ properties analyzed):
        // Real-world results from database analysis:
        //   - Street Suffixes: 637.7 avg properties per term (4-char words) - BEST!
        //   - Common Names: 474.6 avg (6-char), 467.7 avg (5-char) - EXCELLENT
        //   - First Names: 426.4 avg properties - EXCELLENT (James, John, Robert, etc)
        //   - Hispanic/Asian Names: 2000-2700 avg each (Garcia, Rodriguez, Lee, Kim, etc)
        //   - Geographic Terms: 2000-6000 each (Hill, Lake, Cave, etc)
        //   - Business Entities: Only 2.8 avg - VERY POOR
        //
        // Strategy: Focus 85% on 4-6 character single words (proven winners)
        const strategies = [
            { fn: () => this.generateStreetSuffix(), weight: 50 }, // INCREASED! 1000+ avg - Boulevard, Drive, Lane untried
            { fn: () => this.generateFirstNameOnly(), weight: 35 }, // INCREASED! 1132 avg last hour - John: 13,393!
            { fn: () => this.generateLastNameOnly(), weight: 30 }, // REDUCED - Most high-yield names exhausted
            { fn: () => this.generateGeographicTerm(), weight: 25 }, // GREAT! Rock: 4,615, Mill: 3,778
            { fn: () => this.generateNeighborhood(), weight: 20 }, // Good for area coverage
            { fn: () => this.generateHispanicAsianSurname(), weight: 15 }, // 2000+ avg - Garcia, Lee, Kim, etc
            { fn: () => this.generatePropertyType(), weight: 10 }, // REDUCED - Moderate yield
            { fn: () => this.generateStreetNameOnly(), weight: 5 }, // REDUCED - Many covered
            { fn: () => this.generateBusinessName(), weight: 0 }, // ELIMINATED! 13% success, wasted 83% of last hour
            // REMOVED inefficient strategies:
            // - generatePropertyWithDescriptor() - 26% zero-result rate
            // - generateTwoLetterCombo() - 73.9% failure rate
            // - generateThreeLetterCombo() - 73.9% failure rate
            // - generateFourLetterWord() - 73.9% failure rate (now covered by generateGeographicTerm)
            // - generateFullName() - only 4.4 avg props, 26% zero-result rate
            // - generateStreetAddress() - 44.8% zero-result rate
            // - generateCompoundName() - causes JSON parse errors
        ];
        // Create weighted array
        const weightedStrategies = [];
        strategies.forEach(s => {
            for (let i = 0; i < s.weight; i++) {
                weightedStrategies.push(s.fn);
            }
        });
        let attempts = 0;
        const maxAttempts = batchSize * 10;
        // Reset deduplicator stats for this batch
        this.deduplicator.resetStats();
        // First, prioritize optimized terms (if available)
        if (optimizedTerms.length > 0) {
            logger.info(`🎯 Prioritizing ${optimizedTerms.length} high-performing terms in this batch`);
            for (const term of optimizedTerms) {
                if (batch.length >= batchSize)
                    break;
                // Use the deduplicator to check if we should skip this term
                if (!this.deduplicator.shouldSkipTerm(term)) {
                    this.deduplicator.markTermAsUsed(term);
                    this.usedTerms.add(term);
                    batch.push(term);
                }
            }
        }
        // Fill remaining slots with random strategy-generated terms
        while (batch.length < batchSize && attempts < maxAttempts) {
            attempts++;
            const strategy = weightedStrategies[Math.floor(Math.random() * weightedStrategies.length)];
            const term = strategy();
            // Use the deduplicator to check if we should skip this term
            if (!this.deduplicator.shouldSkipTerm(term)) {
                // Term is unique enough - add it to the batch
                this.deduplicator.markTermAsUsed(term);
                this.usedTerms.add(term); // Also update local set for backwards compatibility
                batch.push(term);
            }
        }
        // Log deduplication statistics
        const stats = this.deduplicator.getStats();
        if (stats.exactDuplicates > 0) {
            logger.info(`   ⚠️  Skipped ${stats.exactDuplicates} exact duplicates`);
        }
        if (stats.tooCommonTerms > 0) {
            logger.info(`   ⏱️  Skipped ${stats.tooCommonTerms} too-common terms (cause API timeouts)`);
        }
        if (stats.businessSupersets > 0) {
            logger.info(`   🏢 Skipped ${stats.businessSupersets} business entity supersets`);
        }
        if (stats.twoWordSupersets > 0) {
            logger.info(`   📝 Skipped ${stats.twoWordSupersets} two-word supersets`);
        }
        if (stats.multiWordSupersets > 0) {
            logger.info(`   📚 Skipped ${stats.multiWordSupersets} multi-word supersets`);
        }
        return batch;
    }
}
class ContinuousBatchScraper {
    generator = new SearchPatternGenerator();
    stats = {
        totalQueued: 0,
        batchesProcessed: 0,
        startTime: Date.now(),
        startingPropertyCount: 0,
    };
    running = true;
    async run() {
        logger.info('╔════════════════════════════════════════════════════════╗');
        logger.info('║   CONTINUOUS BATCH SCRAPER - VOLUME OPTIMIZED         ║');
        logger.info('║   Target: 400,000 | Focus: High-Yield Search Terms    ║');
        logger.info('╚════════════════════════════════════════════════════════╝\n');
        // Clear pending jobs from queue to start fresh with optimized strategy
        logger.info('🧹 Clearing pending jobs from queue...');
        const pendingCount = await scraper_queue_1.scraperQueue.getWaitingCount();
        if (pendingCount > 0) {
            await scraper_queue_1.scraperQueue.clean(0, 'wait'); // Remove all waiting jobs
            logger.info(`✓ Cleared ${pendingCount} pending jobs\n`);
        }
        else {
            logger.info('✓ No pending jobs to clear\n');
        }
        // Get starting property count
        this.stats.startingPropertyCount = await prisma_1.prisma.property.count();
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
            const currentCount = await prisma_1.prisma.property.count();
            if (currentCount >= TARGET_PROPERTIES) {
                logger.info(`\n🎉 TARGET REACHED! Current count: ${currentCount.toLocaleString()}`);
                break;
            }
            // Check queue status
            const [waiting, active] = await Promise.all([
                scraper_queue_1.scraperQueue.getWaitingCount(),
                scraper_queue_1.scraperQueue.getActiveCount(),
            ]);
            // Queue threshold reduced from 500 to 100 because API method returns 50x more results
            // With old method: 500 searches * 20 results = 10,000 potential properties
            // With new method: 100 searches * 1000 results = 100,000 potential properties
            if (waiting + active < 100) {
                await this.queueBatch();
            }
            else {
                logger.info(`Queue full (${waiting} waiting, ${active} active). Waiting...`);
            }
            // Wait before next batch
            await this.delay(DELAY_BETWEEN_BATCHES);
        }
        await this.printFinalReport();
        process.exit(0);
    }
    async queueBatch() {
        const searchTerms = await this.generator.getNextBatch(BATCH_SIZE);
        this.stats.batchesProcessed++;
        logger.info(`\n📦 Batch #${this.stats.batchesProcessed} (${searchTerms.length} terms)`);
        for (const searchTerm of searchTerms) {
            try {
                await scraper_queue_1.scraperQueue.add('scrape-properties', {
                    searchTerm,
                    userId: 'continuous-batch',
                    scheduled: true,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                    removeOnComplete: 100,
                    removeOnFail: 50,
                });
                this.stats.totalQueued++;
            }
            catch (error) {
                logger.error({ err: error }, `Failed to queue ${searchTerm}:`);
            }
        }
        logger.info(`✓ Queued ${searchTerms.length} jobs (Total: ${this.stats.totalQueued})`);
    }
    startMonitoring() {
        setInterval(async () => {
            try {
                const [currentCount, waiting, active, completed, failed] = await Promise.all([
                    prisma_1.prisma.property.count(),
                    scraper_queue_1.scraperQueue.getWaitingCount(),
                    scraper_queue_1.scraperQueue.getActiveCount(),
                    scraper_queue_1.scraperQueue.getCompletedCount(),
                    scraper_queue_1.scraperQueue.getFailedCount(),
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
            }
            catch (error) {
                logger.error({ err: error }, 'Monitoring error:');
            }
        }, CHECK_INTERVAL);
    }
    async printFinalReport() {
        const finalCount = await prisma_1.prisma.property.count();
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
    stop() {
        logger.info('\n🛑 Stopping continuous scraper...');
        this.running = false;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
// Run the continuous scraper
const scraper = new ContinuousBatchScraper();
scraper.run().catch((error) => {
    logger.error({ err: error }, 'Fatal error:');
    process.exit(1);
});
//# sourceMappingURL=continuous-batch-scraper.js.map