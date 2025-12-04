// Scraper configuration types
export interface ScraperConfig {
	headless: boolean;
	timeout: number;
	retryAttempts: number;
	retryDelay: number;
	userAgents: string[];
	viewports: Array<{ width: number; height: number }>;
	proxyServer?: string;
	proxyUsername?: string;
	proxyPassword?: string;
}

// Property data structure matching database schema
export interface PropertyData {
	propertyId: string;
	name: string;
	propType: string;
	city: string | null;
	propertyAddress: string;
	assessedValue: number;
	appraisedValue: number;
	geoId: string | null;
	description: string | null;
}

// API request/response types
export interface ScrapeRequest {
	searchTerm: string;
	userId?: string;
}

export interface ScrapeResponse {
	jobId: string;
	message: string;
}

export interface JobStatus {
	id: string;
	status: "pending" | "processing" | "completed" | "failed";
	progress?: number;
	resultCount?: number;
	error?: string;
	data?: PropertyData[];
	createdAt: Date;
	completedAt?: Date;
}

// Queue job data types
export interface ScrapeJobData {
	searchTerm: string;
	userId?: string;
	scheduled?: boolean;
}

export interface ScrapeJobResult {
	count: number;
	properties: PropertyData[];
	searchTerm: string;
	duration: number;
}

// Re-export queue types for convenience
export * from "./queue.types";
