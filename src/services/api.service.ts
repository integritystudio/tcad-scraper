import axios, { type AxiosInstance } from "axios";
import { API_CLIENT_TIMEOUT_MS } from "../../utils/constants";
import logger from "../lib/logger";
import type { Property } from "../types";

// API configuration
const API_BASE_URL =
	import.meta.env.VITE_API_URL || "https://api.alephatx.info/api";

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
	timeout: API_CLIENT_TIMEOUT_MS,
});

// Request interceptor for auth token (if needed in future)
apiClient.interceptors.request.use(
	(config) => {
		// Add auth token if available
		const token = localStorage.getItem("authToken");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response) {
			// Handle specific error statuses
			switch (error.response.status) {
				case 401:
					localStorage.removeItem("authToken");
					logger.error("Unauthorized request (401)", error.response.data);
					break;
				case 429:
					// Handle rate limiting
					logger.error("Rate limit exceeded:", error.response.data);
					break;
				default:
					logger.error("API Error:", error.response.data);
			}
		} else if (error.request) {
			logger.error("Network Error:", error.message);
		}
		return Promise.reject(error);
	},
);

// Types for API responses
export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		total: number;
		limit: number;
		offset: number;
		hasMore: boolean;
	};
}

export interface PropertyFilters {
	searchTerm?: string;
	city?: string;
	propType?: string;
	minValue?: number;
	maxValue?: number;
	limit?: number;
	offset?: number;
}

export interface PropertyStats {
	totalProperties: number;
	totalJobs: number;
	recentJobs: number;
	cityDistribution: Array<{
		city: string;
		_count: number;
	}>;
	propertyTypeDistribution: Array<{
		propType: string;
		_count: number;
		_avg: {
			appraisedValue: number;
		};
	}>;
}

// API service methods
export const propertyAPI = {
	// Get properties from database
	async getProperties(
		filters?: PropertyFilters,
	): Promise<PaginatedResponse<Property>> {
		const response = await apiClient.get<PaginatedResponse<Property>>(
			"/properties",
			{
				params: filters,
			},
		);
		return response.data;
	},

	// Get total property count (efficient - only fetches count from pagination)
	async getPropertyCount(): Promise<number> {
		const response = await apiClient.get<PaginatedResponse<Property>>(
			"/properties",
			{
				params: { limit: 1 },
			},
		);
		return response.data.pagination.total;
	},

	// Get all properties (handle pagination automatically)
	async getAllProperties(
		filters?: Omit<PropertyFilters, "limit" | "offset">,
	): Promise<Property[]> {
		const allProperties: Property[] = [];
		let offset = 0;
		const limit = 100;
		let hasMore = true;

		while (hasMore) {
			const response = await this.getProperties({
				...filters,
				limit,
				offset,
			});

			allProperties.push(...response.data);
			hasMore = response.pagination.hasMore;
			offset += limit;
		}

		return allProperties;
	},

	// Get statistics
	async getStats(): Promise<PropertyStats> {
		const response = await apiClient.get<PropertyStats>("/properties/stats");
		return response.data;
	},

};

// Health check service
export const healthAPI = {
	async checkHealth(): Promise<boolean> {
		try {
			const response = await apiClient.get("/health");
			return response.status === 200;
		} catch {
			return false;
		}
	},

};

export default propertyAPI;
