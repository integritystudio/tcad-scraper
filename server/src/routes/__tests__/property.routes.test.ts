import request from 'supertest';
import express, { Express } from 'express';
import { propertyRouter } from '../property.routes';
import { propertyController } from '../../controllers/property.controller';

// Mock the controller
jest.mock('../../controllers/property.controller', () => ({
  propertyController: {
    scrapeProperties: jest.fn(),
    getJobStatus: jest.fn(),
    getScrapeHistory: jest.fn(),
    getProperties: jest.fn(),
    naturalLanguageSearch: jest.fn(),
    testClaudeConnection: jest.fn(),
    getStats: jest.fn(),
    addMonitoredSearch: jest.fn(),
    getMonitoredSearches: jest.fn(),
  },
}));

describe('Property Routes', () => {
  let app: Express;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/api/properties', propertyRouter);

    // Clear all mocks
    jest.clearAllMocks();

    // Setup default successful responses
    (propertyController.scrapeProperties as jest.Mock).mockImplementation(
      (req, res) => res.status(202).json({ jobId: '123', message: 'Scrape job queued successfully' })
    );
    (propertyController.getJobStatus as jest.Mock).mockImplementation(
      (req, res) => res.json({ id: '123', status: 'completed' })
    );
    (propertyController.getScrapeHistory as jest.Mock).mockImplementation(
      (req, res) => res.json({ data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } })
    );
    (propertyController.getProperties as jest.Mock).mockImplementation(
      (req, res) => res.json({ data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } })
    );
    (propertyController.naturalLanguageSearch as jest.Mock).mockImplementation(
      (req, res) => res.json({ data: [], query: req.body.query, parsedFilters: {} })
    );
    (propertyController.testClaudeConnection as jest.Mock).mockImplementation(
      (req, res) => res.json({ status: 'success', message: 'Claude AI connection test successful' })
    );
    (propertyController.getStats as jest.Mock).mockImplementation(
      (req, res) => res.json({ totalProperties: 0, totalJobs: 0 })
    );
    (propertyController.addMonitoredSearch as jest.Mock).mockImplementation(
      (req, res) => res.status(201).json({ id: 'uuid', searchTerm: req.body.searchTerm, enabled: true })
    );
    (propertyController.getMonitoredSearches as jest.Mock).mockImplementation(
      (req, res) => res.json({ data: [] })
    );
  });

  describe('POST /api/properties/scrape', () => {
    it('should accept valid scrape request', async () => {
      const response = await request(app)
        .post('/api/properties/scrape')
        .send({ searchTerm: 'Smith' })
        .expect(202);

      expect(response.body).toHaveProperty('jobId');
      expect(response.body.message).toBe('Scrape job queued successfully');
      expect(propertyController.scrapeProperties).toHaveBeenCalled();
    });

    it('should reject request without searchTerm', async () => {
      const response = await request(app)
        .post('/api/properties/scrape')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.scrapeProperties).not.toHaveBeenCalled();
    });

    it('should reject request with invalid searchTerm type', async () => {
      const response = await request(app)
        .post('/api/properties/scrape')
        .send({ searchTerm: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.scrapeProperties).not.toHaveBeenCalled();
    });

    it('should accept optional userId and scheduled fields', async () => {
      await request(app)
        .post('/api/properties/scrape')
        .send({ searchTerm: 'Smith', userId: 'user123', scheduled: true })
        .expect(202);

      expect(propertyController.scrapeProperties).toHaveBeenCalled();
    });
  });

  describe('GET /api/properties/jobs/:jobId', () => {
    it('should retrieve job status', async () => {
      const response = await request(app)
        .get('/api/properties/jobs/123')
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('status');
      expect(propertyController.getJobStatus).toHaveBeenCalled();
    });

    it('should pass jobId parameter to controller', async () => {
      await request(app)
        .get('/api/properties/jobs/test-job-id')
        .expect(200);

      expect(propertyController.getJobStatus).toHaveBeenCalled();
    });
  });

  describe('GET /api/properties/history', () => {
    it('should retrieve scrape history with default pagination', async () => {
      const response = await request(app)
        .get('/api/properties/history')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(propertyController.getScrapeHistory).toHaveBeenCalled();
    });

    it('should accept valid pagination parameters', async () => {
      await request(app)
        .get('/api/properties/history?limit=10&offset=5')
        .expect(200);

      expect(propertyController.getScrapeHistory).toHaveBeenCalled();
    });

    it('should accept valid status filter', async () => {
      await request(app)
        .get('/api/properties/history?status=completed')
        .expect(200);

      expect(propertyController.getScrapeHistory).toHaveBeenCalled();
    });

    it('should reject invalid limit (too large)', async () => {
      const response = await request(app)
        .get('/api/properties/history?limit=101')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.getScrapeHistory).not.toHaveBeenCalled();
    });

    it('should reject invalid limit (negative)', async () => {
      const response = await request(app)
        .get('/api/properties/history?limit=-1')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.getScrapeHistory).not.toHaveBeenCalled();
    });

    it('should reject invalid offset (negative)', async () => {
      const response = await request(app)
        .get('/api/properties/history?offset=-1')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.getScrapeHistory).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/properties', () => {
    it('should retrieve properties with default filters', async () => {
      const response = await request(app)
        .get('/api/properties')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(propertyController.getProperties).toHaveBeenCalled();
    });

    it('should accept city filter', async () => {
      await request(app)
        .get('/api/properties?city=Austin')
        .expect(200);

      expect(propertyController.getProperties).toHaveBeenCalled();
    });

    it('should accept propType filter', async () => {
      await request(app)
        .get('/api/properties?propType=Residential')
        .expect(200);

      expect(propertyController.getProperties).toHaveBeenCalled();
    });

    it('should accept value range filters', async () => {
      await request(app)
        .get('/api/properties?minValue=100000&maxValue=500000')
        .expect(200);

      expect(propertyController.getProperties).toHaveBeenCalled();
    });

    it('should accept searchTerm filter', async () => {
      await request(app)
        .get('/api/properties?searchTerm=Smith')
        .expect(200);

      expect(propertyController.getProperties).toHaveBeenCalled();
    });

    it('should accept combined filters', async () => {
      await request(app)
        .get('/api/properties?city=Austin&propType=Residential&minValue=100000&limit=50')
        .expect(200);

      expect(propertyController.getProperties).toHaveBeenCalled();
    });

    it('should reject limit exceeding maximum', async () => {
      const response = await request(app)
        .get('/api/properties?limit=1001')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.getProperties).not.toHaveBeenCalled();
    });

    it('should reject invalid minValue type', async () => {
      const response = await request(app)
        .get('/api/properties?minValue=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.getProperties).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/properties/search', () => {
    it('should accept natural language search query', async () => {
      const response = await request(app)
        .post('/api/properties/search')
        .send({ query: 'Find all residential properties in Austin worth more than $500k' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('query');
      expect(response.body).toHaveProperty('parsedFilters');
      expect(propertyController.naturalLanguageSearch).toHaveBeenCalled();
    });

    it('should reject request without query', async () => {
      const response = await request(app)
        .post('/api/properties/search')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.naturalLanguageSearch).not.toHaveBeenCalled();
    });

    it('should reject request with non-string query', async () => {
      const response = await request(app)
        .post('/api/properties/search')
        .send({ query: 123 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.naturalLanguageSearch).not.toHaveBeenCalled();
    });

    it('should accept optional limit parameter', async () => {
      await request(app)
        .post('/api/properties/search')
        .send({ query: 'Find properties', limit: 50 })
        .expect(200);

      expect(propertyController.naturalLanguageSearch).toHaveBeenCalled();
    });

    it('should reject limit exceeding maximum', async () => {
      const response = await request(app)
        .post('/api/properties/search')
        .send({ query: 'Find properties', limit: 1001 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.naturalLanguageSearch).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/properties/search/test', () => {
    it('should test Claude AI connection', async () => {
      const response = await request(app)
        .get('/api/properties/search/test')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.message).toContain('Claude AI');
      expect(propertyController.testClaudeConnection).toHaveBeenCalled();
    });
  });

  describe('GET /api/properties/stats', () => {
    it('should retrieve property statistics', async () => {
      const response = await request(app)
        .get('/api/properties/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalProperties');
      expect(response.body).toHaveProperty('totalJobs');
      expect(propertyController.getStats).toHaveBeenCalled();
    });
  });

  describe('POST /api/properties/monitor', () => {
    it('should add monitored search term', async () => {
      const response = await request(app)
        .post('/api/properties/monitor')
        .send({ searchTerm: 'Smith' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.searchTerm).toBe('Smith');
      expect(propertyController.addMonitoredSearch).toHaveBeenCalled();
    });

    it('should reject request without searchTerm', async () => {
      const response = await request(app)
        .post('/api/properties/monitor')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid request data');
      expect(response.body).toHaveProperty('details');
      expect(propertyController.addMonitoredSearch).not.toHaveBeenCalled();
    });

    it('should accept optional schedule and enabled fields', async () => {
      await request(app)
        .post('/api/properties/monitor')
        .send({ searchTerm: 'Smith', schedule: '0 0 * * *', enabled: false })
        .expect(201);

      expect(propertyController.addMonitoredSearch).toHaveBeenCalled();
    });
  });

  describe('GET /api/properties/monitor', () => {
    it('should retrieve monitored search terms', async () => {
      const response = await request(app)
        .get('/api/properties/monitor')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(propertyController.getMonitoredSearches).toHaveBeenCalled();
    });
  });

  describe('Route Registration', () => {
    it('should have all routes registered', () => {
      const routes = propertyRouter.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      expect(routes).toContainEqual({ path: '/scrape', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/jobs/:jobId', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/history', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/search', methods: ['post'] });
      expect(routes).toContainEqual({ path: '/search/test', methods: ['get'] });
      expect(routes).toContainEqual({ path: '/stats', methods: ['get'] });

      // Monitor routes are registered separately for POST and GET
      const monitorRoutes = routes.filter(r => r.path === '/monitor');
      expect(monitorRoutes).toHaveLength(2);
      expect(monitorRoutes.some(r => r.methods.includes('post'))).toBe(true);
      expect(monitorRoutes.some(r => r.methods.includes('get'))).toBe(true);
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for non-existent route', async () => {
      await request(app)
        .get('/api/properties/nonexistent')
        .expect(404);
    });

    it('should return 404 for wrong HTTP method', async () => {
      await request(app)
        .put('/api/properties/scrape')
        .send({ searchTerm: 'Smith' })
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle controller errors gracefully', async () => {
      (propertyController.getStats as jest.Mock).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await request(app)
        .get('/api/properties/stats')
        .expect(500);
    });

    it('should handle async controller errors', async () => {
      (propertyController.naturalLanguageSearch as jest.Mock).mockImplementation(async () => {
        throw new Error('Claude AI error');
      });

      await request(app)
        .post('/api/properties/search')
        .send({ query: 'test' })
        .expect(500);
    });
  });
});
