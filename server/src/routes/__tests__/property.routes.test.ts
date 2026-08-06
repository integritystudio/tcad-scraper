import express, { type Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { propertyController } from "../../controllers/property.controller";
import { propertyRouter } from "../property.routes";

// Mock the controller
vi.mock("../../controllers/property.controller", () => ({
	propertyController: {
		getProperties: vi.fn(),
		naturalLanguageSearch: vi.fn(),
		testClaudeConnection: vi.fn(),
		getStats: vi.fn(),
		addMonitoredSearch: vi.fn(),
		getMonitoredSearches: vi.fn(),
	},
}));

describe("Property Routes", () => {
	let app: Express;

	beforeEach(() => {
		// Create a fresh Express app for each test
		app = express();
		app.use(express.json());
		app.use("/api/properties", propertyRouter);

		// Clear all mocks
		vi.clearAllMocks();

		// Setup default successful responses
		(propertyController.getProperties as Mock).mockImplementation((_req, res) =>
			res.json({
				data: [],
				pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
			}),
		);
		(propertyController.naturalLanguageSearch as Mock).mockImplementation(
			(req, res) =>
				res.json({ data: [], query: req.body.query, parsedFilters: {} }),
		);
		(propertyController.testClaudeConnection as Mock).mockImplementation(
			(_req, res) =>
				res.json({
					status: "success",
					message: "Claude AI connection test successful",
				}),
		);
		(propertyController.getStats as Mock).mockImplementation((_req, res) =>
			res.json({ totalProperties: 0, totalJobs: 0 }),
		);
		(propertyController.addMonitoredSearch as Mock).mockImplementation(
			(req, res) =>
				res
					.status(201)
					.json({ id: "uuid", searchTerm: req.body.searchTerm, enabled: true }),
		);
		(propertyController.getMonitoredSearches as Mock).mockImplementation(
			(_req, res) => res.json({ data: [] }),
		);
	});

	describe("GET /api/properties", () => {
		it("should retrieve properties with default filters", async () => {
			const response = await request(app).get("/api/properties").expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("pagination");
			expect(propertyController.getProperties).toHaveBeenCalled();
		});

		it("should accept city filter", async () => {
			await request(app).get("/api/properties?city=Austin").expect(200);

			expect(propertyController.getProperties).toHaveBeenCalled();
		});

		it("should accept propType filter", async () => {
			await request(app)
				.get("/api/properties?propType=Residential")
				.expect(200);

			expect(propertyController.getProperties).toHaveBeenCalled();
		});

		it("should accept value range filters", async () => {
			await request(app)
				.get("/api/properties?minValue=100000&maxValue=500000")
				.expect(200);

			expect(propertyController.getProperties).toHaveBeenCalled();
		});

		it("should accept searchTerm filter", async () => {
			await request(app).get("/api/properties?searchTerm=Smith").expect(200);

			expect(propertyController.getProperties).toHaveBeenCalled();
		});

		it("should accept combined filters", async () => {
			await request(app)
				.get(
					"/api/properties?city=Austin&propType=Residential&minValue=100000&limit=50",
				)
				.expect(200);

			expect(propertyController.getProperties).toHaveBeenCalled();
		});

		it("should reject limit exceeding maximum", async () => {
			const response = await request(app)
				.get("/api/properties?limit=1001")
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body).toHaveProperty("details");
			expect(propertyController.getProperties).not.toHaveBeenCalled();
		});

		it("should reject invalid minValue type", async () => {
			const response = await request(app)
				.get("/api/properties?minValue=invalid")
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body).toHaveProperty("details");
			expect(propertyController.getProperties).not.toHaveBeenCalled();
		});
	});

	describe("POST /api/properties/search", () => {
		it("should accept natural language search query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({
					query:
						"Find all residential properties in Austin worth more than $500k",
				})
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(response.body).toHaveProperty("query");
			expect(response.body).toHaveProperty("parsedFilters");
			expect(propertyController.naturalLanguageSearch).toHaveBeenCalled();
		});

		it("should reject request without query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body).toHaveProperty("details");
			expect(propertyController.naturalLanguageSearch).not.toHaveBeenCalled();
		});

		it("should reject request with non-string query", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: 123 })
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body).toHaveProperty("details");
			expect(propertyController.naturalLanguageSearch).not.toHaveBeenCalled();
		});

		it("should accept optional limit parameter", async () => {
			await request(app)
				.post("/api/properties/search")
				.send({ query: "Find properties", limit: 50 })
				.expect(200);

			expect(propertyController.naturalLanguageSearch).toHaveBeenCalled();
		});

		it("should reject limit exceeding maximum", async () => {
			const response = await request(app)
				.post("/api/properties/search")
				.send({ query: "Find properties", limit: 1001 })
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body).toHaveProperty("details");
			expect(propertyController.naturalLanguageSearch).not.toHaveBeenCalled();
		});
	});

	describe("GET /api/properties/search/test", () => {
		it("should test Claude AI connection", async () => {
			const response = await request(app)
				.get("/api/properties/search/test")
				.expect(200);

			expect(response.body.status).toBe("success");
			expect(response.body.message).toContain("Claude AI");
			expect(propertyController.testClaudeConnection).toHaveBeenCalled();
		});
	});

	describe("GET /api/properties/stats", () => {
		it("should retrieve property statistics", async () => {
			const response = await request(app)
				.get("/api/properties/stats")
				.expect(200);

			expect(response.body).toHaveProperty("totalProperties");
			expect(response.body).toHaveProperty("totalJobs");
			expect(propertyController.getStats).toHaveBeenCalled();
		});
	});

	describe("POST /api/properties/monitor", () => {
		it("should add monitored search term", async () => {
			const response = await request(app)
				.post("/api/properties/monitor")
				.set("x-api-key", "test-api-key")
				.send({ searchTerm: "Smith" })
				.expect(201);

			expect(response.body).toHaveProperty("id");
			expect(response.body.searchTerm).toBe("Smith");
			expect(propertyController.addMonitoredSearch).toHaveBeenCalled();
		});

		it("should reject request without searchTerm", async () => {
			const response = await request(app)
				.post("/api/properties/monitor")
				.set("x-api-key", "test-api-key")
				.send({})
				.expect(400);

			expect(response.body).toHaveProperty("error", "Invalid request data");
			expect(response.body).toHaveProperty("details");
			expect(propertyController.addMonitoredSearch).not.toHaveBeenCalled();
		});

		it("should accept optional schedule and enabled fields", async () => {
			await request(app)
				.post("/api/properties/monitor")
				.set("x-api-key", "test-api-key")
				.send({ searchTerm: "Smith", schedule: "0 0 * * *", enabled: false })
				.expect(201);

			expect(propertyController.addMonitoredSearch).toHaveBeenCalled();
		});

		it("should reject request without API key", async () => {
			const response = await request(app)
				.post("/api/properties/monitor")
				.send({ searchTerm: "Smith" })
				.expect(401);

			expect(response.body).toHaveProperty("error");
			expect(propertyController.addMonitoredSearch).not.toHaveBeenCalled();
		});
	});

	describe("GET /api/properties/monitor", () => {
		it("should retrieve monitored search terms", async () => {
			const response = await request(app)
				.get("/api/properties/monitor")
				.expect(200);

			expect(response.body).toHaveProperty("data");
			expect(Array.isArray(response.body.data)).toBe(true);
			expect(propertyController.getMonitoredSearches).toHaveBeenCalled();
		});
	});

	describe("Route Registration", () => {
		it("should have all routes registered", () => {
			const routes = propertyRouter.stack
				.filter((layer) => layer.route)
				.map((layer) => ({
					path: layer.route.path,
					methods: Object.keys(layer.route.methods),
				}));

			expect(routes).toContainEqual({ path: "/", methods: ["get"] });
			expect(routes).toContainEqual({ path: "/search", methods: ["post"] });
			expect(routes).toContainEqual({ path: "/search/test", methods: ["get"] });
			expect(routes).toContainEqual({ path: "/stats", methods: ["get"] });

			// Monitor routes are registered separately for POST and GET
			const monitorRoutes = routes.filter((r) => r.path === "/monitor");
			expect(monitorRoutes).toHaveLength(2);
			expect(monitorRoutes.some((r) => r.methods.includes("post"))).toBe(true);
			expect(monitorRoutes.some((r) => r.methods.includes("get"))).toBe(true);
		});
	});

	describe("404 Handling", () => {
		it("should return 404 for non-existent route", async () => {
			await request(app).get("/api/properties/nonexistent").expect(404);
		});

		it("should return 404 for wrong HTTP method", async () => {
			await request(app)
				.put("/api/properties/scrape")
				.send({ searchTerm: "Smith" })
				.expect(404);
		});
	});

	describe("Error Handling", () => {
		it("should handle controller errors gracefully", async () => {
			(propertyController.getStats as Mock).mockImplementation(() => {
				throw new Error("Database connection failed");
			});

			await request(app).get("/api/properties/stats").expect(500);
		});

		it("should handle async controller errors", async () => {
			(propertyController.naturalLanguageSearch as Mock).mockImplementation(
				async () => {
					throw new Error("Claude AI error");
				},
			);

			await request(app)
				.post("/api/properties/search")
				.send({ query: "test" })
				.expect(500);
		});
	});
});
