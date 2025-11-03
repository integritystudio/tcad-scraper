# TCAD Scraper Modernization Report

## Executive Summary

This report analyzes the current TCAD scraper implementation and provides comprehensive recommendations for modernizing the architecture using 2024-2025 best practices. The current Puppeteer-based implementation can be significantly improved by migrating to Playwright, implementing a proper API service layer with job queuing, and integrating with PostgreSQL for data persistence.

## Current State Analysis

### Existing Implementation Issues

1. **Legacy Technology Stack**
   - Using Puppeteer in non-headless mode (`headless: false`)
   - Manual DOM traversal with Cheerio (unnecessary with modern browser automation)
   - No error recovery or retry mechanisms
   - Hard-coded search terms and selectors
   - No data persistence layer

2. **Architecture Gaps**
   - Scraper runs as standalone script, not integrated with React frontend
   - No API layer between frontend and scraper
   - PostgreSQL configured but not utilized
   - No job queue for handling scraping requests
   - No rate limiting or respectful crawling implementation

3. **Code Quality Issues**
   - Commented-out code and TODOs indicating incomplete implementation
   - Browser not properly closed in error scenarios
   - No proper error handling or logging
   - Mixed concerns (scraping logic and data extraction in same file)

## Recommended Modern Architecture

### Technology Stack Recommendations

#### 1. Browser Automation: Migrate to Playwright

**Rationale:**
- **Cross-browser support**: Test against multiple browsers to ensure scraper reliability
- **Better modern framework support**: Superior handling of React/dynamic content
- **Auto-wait mechanisms**: Built-in smart waiting reduces flaky tests
- **Better debugging tools**: Trace viewer, video recording, screenshots
- **Network interception**: Can mock/modify requests for testing

**Implementation Example:**
```typescript
// scraper/lib/playwright-scraper.ts
import { chromium, Browser, Page } from 'playwright';

export class TCADScraper {
  private browser: Browser | null = null;

  async initialize() {
    this.browser = await chromium.launch({
      headless: true, // Use headless in production
      args: ['--disable-blink-features=AutomationControlled']
    });
  }

  async scrapeProperties(searchTerm: string) {
    const context = await this.browser!.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    try {
      await page.goto('https://stage.travis.prodigycad.com/property-search', {
        waitUntil: 'networkidle'
      });

      // Use Playwright's auto-waiting
      await page.fill('input[type="text"]', searchTerm);
      await page.press('input[type="text"]', 'Enter');

      // Wait for results with better selector
      await page.waitForSelector('[role="gridcell"]', { timeout: 30000 });

      // Extract data directly without Cheerio
      const properties = await page.evaluate(() => {
        const rows = document.querySelectorAll('[aria-label="Press SPACE to select this row."]');
        return Array.from(rows).map(row => ({
          name: row.querySelector('[col-id="name"]')?.textContent?.trim() || '',
          propType: row.querySelector('[col-id="propType"]')?.textContent?.trim() || '',
          city: row.querySelector('[col-id="city"]')?.textContent?.trim() || null,
          propertyAddress: row.querySelector('[col-id="streetPrimary"]')?.textContent?.trim() || '',
          propertyID: row.querySelector('[col-id="pid"]')?.textContent?.trim() || '',
          appraisedValue: row.querySelector('[col-id="appraisedValue"]')?.textContent?.trim() || '',
          geoID: row.querySelector('[col-id="geoID"]')?.textContent?.trim() || null,
          description: row.querySelector('[col-id="legalDescription"]')?.textContent?.trim() || null
        }));
      });

      return properties.filter(p => p.propertyAddress);
    } finally {
      await context.close();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
```

#### 2. Backend API Service: Express + TypeScript

**Architecture Overview:**
```typescript
// server/src/index.ts
import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { scraperQueue } from './queues/scraper.queue';
import { propertyRouter } from './routes/property.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Bull Dashboard for monitoring
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullAdapter(scraperQueue)],
  serverAdapter
});

// Routes
app.use('/api/properties', propertyRouter);
app.use('/admin/queues', serverAdapter.getRouter());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### 3. Job Queue System: Bull + Redis

**Queue Implementation:**
```typescript
// server/src/queues/scraper.queue.ts
import Bull from 'bull';
import { TCADScraper } from '../lib/tcad-scraper';
import { propertyRepository } from '../repositories/property.repository';

export const scraperQueue = new Bull('scraper-queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  }
});

// Process jobs
scraperQueue.process('scrape-properties', async (job) => {
  const { searchTerm, userId } = job.data;
  const scraper = new TCADScraper();

  try {
    await job.progress(10);
    await scraper.initialize();

    await job.progress(30);
    const properties = await scraper.scrapeProperties(searchTerm);

    await job.progress(70);
    // Save to PostgreSQL
    const savedProperties = await propertyRepository.bulkCreate(properties, searchTerm);

    await job.progress(100);
    return {
      count: savedProperties.length,
      properties: savedProperties
    };
  } finally {
    await scraper.cleanup();
  }
});

// Rate limiting and retry configuration
scraperQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
});

scraperQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with ${result.count} properties`);
});
```

#### 4. Database Integration: PostgreSQL with Prisma

**Schema Definition:**
```prisma
// server/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Property {
  id              String   @id @default(uuid())
  propertyId      String   @map("property_id") @unique
  name            String
  propType        String   @map("prop_type")
  city            String?
  propertyAddress String   @map("property_address")
  assessedValue   Float?   @map("assessed_value")
  appraisedValue  Float    @map("appraised_value")
  geoId           String?  @map("geo_id")
  description     String?
  searchTerm      String?  @map("search_term")
  scrapedAt       DateTime @default(now()) @map("scraped_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([searchTerm, scrapedAt])
  @@index([propertyId])
  @@map("properties")
}

model ScrapeJob {
  id          String   @id @default(uuid())
  searchTerm  String   @map("search_term")
  status      String   // pending, processing, completed, failed
  resultCount Int?     @map("result_count")
  error       String?
  startedAt   DateTime @default(now()) @map("started_at")
  completedAt DateTime? @map("completed_at")

  @@index([status, startedAt])
  @@map("scrape_jobs")
}
```

#### 5. React Frontend Integration

**API Service:**
```typescript
// src/services/api.service.ts
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const propertyAPI = {
  // Trigger a new scrape job
  async triggerScrape(searchTerm: string) {
    const response = await axios.post(`${API_BASE_URL}/properties/scrape`, {
      searchTerm
    });
    return response.data;
  },

  // Check job status
  async getJobStatus(jobId: string) {
    const response = await axios.get(`${API_BASE_URL}/properties/jobs/${jobId}`);
    return response.data;
  },

  // Get properties from database
  async getProperties(filters?: {
    searchTerm?: string;
    city?: string;
    minValue?: number;
    maxValue?: number;
  }) {
    const response = await axios.get(`${API_BASE_URL}/properties`, { params: filters });
    return response.data;
  },

  // Get scrape history
  async getScrapeHistory() {
    const response = await axios.get(`${API_BASE_URL}/properties/history`);
    return response.data;
  }
};
```

**React Component with Job Status:**
```tsx
// src/components/ScrapeManager.tsx
import { useState } from 'react';
import { propertyAPI } from '../services/api.service';

export function ScrapeManager() {
  const [searchTerm, setSearchTerm] = useState('');
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleScrape = async () => {
    setLoading(true);
    try {
      const { jobId } = await propertyAPI.triggerScrape(searchTerm);

      // Poll for job status
      const interval = setInterval(async () => {
        const status = await propertyAPI.getJobStatus(jobId);
        setJobStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setLoading(false);

          if (status.status === 'completed') {
            // Refresh property list
            window.location.reload();
          }
        }
      }, 2000);
    } catch (error) {
      console.error('Scrape failed:', error);
      setLoading(false);
    }
  };

  return (
    <div className="scrape-manager">
      <div className="search-bar">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter search term (e.g., owner name, address)"
        />
        <button onClick={handleScrape} disabled={loading || !searchTerm}>
          {loading ? 'Scraping...' : 'Start Scraping'}
        </button>
      </div>

      {jobStatus && (
        <div className="job-status">
          <h3>Job Status: {jobStatus.status}</h3>
          {jobStatus.progress && (
            <progress value={jobStatus.progress} max="100" />
          )}
          {jobStatus.resultCount && (
            <p>Found {jobStatus.resultCount} properties</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Best Practices Implementation

### 1. Rate Limiting & Respectful Scraping

```typescript
// server/src/middleware/rate-limiter.ts
export const scrapeRateLimiter = {
  // Delay between requests to the same domain
  requestDelay: 2000, // 2 seconds

  // Maximum concurrent scrapers
  maxConcurrency: 2,

  // Respect robots.txt
  respectRobotsTxt: true,

  // User agent rotation
  userAgents: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  ],

  // Implement exponential backoff for retries
  retryStrategy: {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 10000
  }
};
```

### 2. Error Handling & Monitoring

```typescript
// server/src/lib/error-handler.ts
export class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
  }
}

export const errorHandler = {
  handleScrapeError(error: any) {
    if (error.message.includes('timeout')) {
      return new ScraperError('Page load timeout', 'TIMEOUT', true);
    }
    if (error.message.includes('blocked')) {
      return new ScraperError('IP blocked', 'BLOCKED', false);
    }
    return new ScraperError('Unknown error', 'UNKNOWN', true);
  }
};
```

### 3. Anti-Detection Strategies

```typescript
// server/src/lib/stealth-config.ts
export const stealthConfig = {
  // Randomize viewport sizes
  viewports: [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 }
  ],

  // Add random delays to mimic human behavior
  humanizeActions: {
    typeDelay: { min: 50, max: 150 }, // ms between keystrokes
    clickDelay: { min: 100, max: 300 }, // ms before clicking
    scrollDelay: { min: 500, max: 1500 } // ms between scrolls
  },

  // Browser fingerprint randomization
  fingerprintOptions: {
    languages: ['en-US', 'en-GB', 'en'],
    platform: ['Win32', 'MacIntel', 'Linux x86_64'],
    hardwareConcurrency: [4, 8, 16],
    deviceMemory: [4, 8, 16]
  }
};
```

### 4. Scheduling & Automation

```typescript
// server/src/schedulers/scrape-scheduler.ts
import cron from 'node-cron';
import { scraperQueue } from '../queues/scraper.queue';

// Schedule daily scrapes for monitored properties
cron.schedule('0 2 * * *', async () => {
  console.log('Starting scheduled scrape');

  const monitoredSearchTerms = await getMonitoredSearchTerms();

  for (const term of monitoredSearchTerms) {
    await scraperQueue.add('scrape-properties', {
      searchTerm: term,
      scheduled: true
    }, {
      delay: Math.random() * 60000 // Random delay up to 1 minute
    });
  }
});
```

## Migration Plan

### Phase 1: Backend Infrastructure (Week 1)
1. Set up Express + TypeScript server
2. Configure PostgreSQL with Prisma
3. Set up Redis for job queuing
4. Implement basic API endpoints

### Phase 2: Scraper Migration (Week 2)
1. Port scraper logic to Playwright
2. Implement job queue processing
3. Add error handling and retries
4. Test rate limiting and anti-detection

### Phase 3: Frontend Integration (Week 3)
1. Create API service layer in React
2. Implement scrape triggering UI
3. Add job status monitoring
4. Connect to real data instead of mock

### Phase 4: Production Readiness (Week 4)
1. Add comprehensive logging
2. Implement monitoring and alerts
3. Add authentication if needed
4. Deploy to production environment

## Required Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "playwright": "^1.41.0",
    "bull": "^4.12.0",
    "redis": "^4.6.0",
    "@prisma/client": "^5.8.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0",
    "@bull-board/api": "^5.10.0",
    "@bull-board/express": "^5.10.0",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "prisma": "^5.8.0",
    "@types/express": "^4.17.21",
    "@types/bull": "^4.10.0",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.2"
  }
}
```

## Environment Configuration

```env
# .env
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://localhost:5432/tcad_scraper

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Scraper Config
SCRAPER_CONCURRENCY=2
SCRAPER_TIMEOUT=30000
SCRAPER_RETRY_ATTEMPTS=3
SCRAPER_RATE_LIMIT_DELAY=2000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

## Security Considerations

1. **API Authentication**: Implement JWT or session-based auth for API endpoints
2. **Rate Limiting**: Use express-rate-limit for API endpoints
3. **Input Validation**: Validate and sanitize all user inputs
4. **CORS Configuration**: Properly configure CORS for production
5. **Environment Variables**: Never commit sensitive data, use proper secrets management
6. **SQL Injection**: Use parameterized queries (handled by Prisma)

## Monitoring & Observability

1. **Logging**: Use Winston for structured logging
2. **Metrics**: Track scrape success rate, duration, error rates
3. **Alerts**: Set up alerts for high failure rates or blocked IPs
4. **Dashboard**: Use Bull Board for queue monitoring
5. **APM**: Consider using tools like New Relic or DataDog for production

## Cost Optimization

1. **Caching**: Cache frequently accessed data in Redis
2. **Database Indexing**: Proper indexes on frequently queried columns
3. **Resource Pooling**: Reuse browser contexts when possible
4. **Batch Processing**: Process multiple searches in single browser session
5. **Data Retention**: Implement data archival strategy for old records

## Conclusion

This modernization plan transforms the TCAD scraper from a simple script into a robust, scalable microservice architecture. The migration to Playwright provides better reliability and cross-browser support, while the job queue system enables asynchronous processing and better user experience. The integration with PostgreSQL ensures data persistence, and the Express API provides a clean interface between the frontend and backend.

Key improvements include:
- 🚀 **Performance**: Async processing with job queues
- 🛡️ **Reliability**: Retry mechanisms and error handling
- 📊 **Scalability**: Microservice architecture with queue-based processing
- 🔍 **Observability**: Comprehensive logging and monitoring
- 🎯 **User Experience**: Real-time job status updates
- ⚖️ **Ethics**: Rate limiting and respectful scraping practices

The architecture is designed to be production-ready, maintainable, and compliant with modern web scraping best practices for 2025.