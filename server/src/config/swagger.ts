/**
 * Swagger/OpenAPI Configuration
 *
 * Provides interactive API documentation at /api-docs
 */

import swaggerJSDoc from "swagger-jsdoc";
import { config } from "./index";

const swaggerDefinition = {
	openapi: "3.0.0",
	info: {
		title: "TCAD Property Scraper API",
		version: "1.0.0",
		description: `
Production-ready API for scraping and querying Travis Central Appraisal District property data.

## Features

- **Web Scraping**: Automated property data collection from TCAD website
- **Job Queue**: BullMQ-based asynchronous job processing
- **AI-Powered Search**: Natural language queries via Claude AI
- **Caching**: Redis-backed caching for optimal performance
- **Monitoring**: Real-time job status and statistics

## Authentication

Most endpoints support optional authentication via:
- **API Key**: Include \`X-API-Key\` header
- **JWT Token**: Include \`Authorization: Bearer <token>\` header

In development mode, authentication can be skipped.

## Rate Limiting

- API endpoints: 100 requests per 15 minutes
- Scraping endpoints: 5 requests per minute

## Caching

- Property queries: Cached for 5 minutes
- Statistics: Cached for 10 minutes
- Cache automatically invalidated when new properties are scraped
    `,
		contact: {
			name: "API Support",
			url: "https://github.com/aledlie/tcad-scraper",
		},
		license: {
			name: "MIT",
			url: "https://opensource.org/licenses/MIT",
		},
	},
	servers: [
		{
			url: `http://${config.server.host}:${config.server.port}`,
			description: "Local development server",
		},
		{
			url: "https://api.production.example.com",
			description: "Production server",
		},
	],
	components: {
		securitySchemes: {
			ApiKeyAuth: {
				type: "apiKey",
				in: "header",
				name: "X-API-Key",
				description: "API key for authentication",
			},
			BearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description: "JWT token for authentication",
			},
		},
		schemas: {
			Property: {
				type: "object",
				properties: {
					id: {
						type: "string",
						format: "uuid",
						description: "Internal database ID",
					},
					propertyId: {
						type: "string",
						description: "TCAD property ID",
						example: "12345678",
					},
					name: {
						type: "string",
						description: "Property owner name",
						example: "SMITH JOHN & MARY",
					},
					propType: {
						type: "string",
						description: "Property type",
						example: "Residential",
					},
					city: {
						type: "string",
						nullable: true,
						description: "City name",
						example: "Austin",
					},
					propertyAddress: {
						type: "string",
						description: "Property address",
						example: "123 MAIN ST",
					},
					assessedValue: {
						type: "number",
						nullable: true,
						description: "Assessed value in USD",
						example: 250000,
					},
					appraisedValue: {
						type: "number",
						description: "Appraised value in USD",
						example: 300000,
					},
					geoId: {
						type: "string",
						nullable: true,
						description: "Geographic ID",
					},
					description: {
						type: "string",
						nullable: true,
						description: "Legal description",
					},
					searchTerm: {
						type: "string",
						nullable: true,
						description: "Search term that found this property",
					},
					scrapedAt: {
						type: "string",
						format: "date-time",
						description: "When property was last scraped",
					},
					createdAt: {
						type: "string",
						format: "date-time",
						description: "When property was first added",
					},
					updatedAt: {
						type: "string",
						format: "date-time",
						description: "When property was last updated",
					},
				},
			},
			ScrapeJob: {
				type: "object",
				properties: {
					id: {
						type: "string",
						format: "uuid",
						description: "Job ID",
					},
					searchTerm: {
						type: "string",
						description: "Search term",
						example: "Smith",
					},
					status: {
						type: "string",
						enum: ["pending", "processing", "completed", "failed"],
						description: "Job status",
					},
					resultCount: {
						type: "number",
						nullable: true,
						description: "Number of properties found",
						example: 42,
					},
					error: {
						type: "string",
						nullable: true,
						description: "Error message if failed",
					},
					startedAt: {
						type: "string",
						format: "date-time",
						description: "When job started",
					},
					completedAt: {
						type: "string",
						format: "date-time",
						nullable: true,
						description: "When job completed",
					},
				},
			},
			Error: {
				type: "object",
				properties: {
					error: {
						type: "string",
						description: "Error message",
						example: "Resource not found",
					},
					message: {
						type: "string",
						description: "Detailed error message (development only)",
					},
				},
			},
		},
	},
	tags: [
		{
			name: "Health",
			description: "Health check and monitoring endpoints",
		},
		{
			name: "Scraping",
			description: "Web scraping operations",
		},
		{
			name: "Properties",
			description: "Property data queries",
		},
		{
			name: "Search",
			description: "AI-powered natural language search",
		},
		{
			name: "Statistics",
			description: "Aggregate statistics and analytics",
		},
		{
			name: "Monitoring",
			description: "Scheduled monitoring configuration",
		},
	],
};

const options: swaggerJSDoc.Options = {
	definition: swaggerDefinition,
	apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/index.ts"],
};

export const swaggerSpec = swaggerJSDoc(options);
