import axios, { AxiosInstance } from 'axios';
import { Property } from '../types';
import logger from '../lib/logger';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance with default config
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});



// Request interceptor for auth token (if needed in future)
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle specific error statuses
      switch (error.response.status) {
        case 401:
          // Handle unauthorized
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          break;
        case 429:
          // Handle rate limiting
          logger.error('Rate limit exceeded:', error.response.data);
          break;
        default:
          logger.error('API Error:', error.response.data);
      }
    } else if (error.request) {
      logger.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Types for API responses
export interface ScrapeJobResponse {
  jobId: string;
  message: string;
}

export interface JobStatus {
  id: string;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'delayed' | 'waiting';
  progress?: number;
  resultCount?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

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

export interface ScrapeHistory {
  id: string;
  searchTerm: string;
  status: string;
  resultCount: number | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
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

export interface MonitoredSearch {
  id: string;
  searchTerm: string;
  active: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastRun: string | null;
  createdAt: string;
  updatedAt: string;
}

// API service methods
export const propertyAPI = {
  // Trigger a new scrape job
  async triggerScrape(searchTerm: string): Promise<ScrapeJobResponse> {
    const response = await apiClient.post<ScrapeJobResponse>('/properties/scrape', {
      searchTerm,
    });
    return response.data;
  },

  // Check job status
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await apiClient.get<JobStatus>(`/properties/jobs/${jobId}`);
    return response.data;
  },

  // Poll job status until completion
  async pollJobStatus(
    jobId: string,
    onProgress?: (status: JobStatus) => void,
    pollInterval: number = 2000
  ): Promise<JobStatus> {
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const status = await this.getJobStatus(jobId);

          if (onProgress) {
            onProgress(status);
          }

          if (status.status === 'completed' || status.status === 'failed') {
            resolve(status);
          } else {
            setTimeout(checkStatus, pollInterval);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkStatus();
    });
  },

  // Get properties from database
  async getProperties(filters?: PropertyFilters): Promise<PaginatedResponse<Property>> {
    const response = await apiClient.get<PaginatedResponse<Property>>('/properties', {
      params: filters,
    });
    return response.data;
  },

  // Get total property count (efficient - only fetches count from pagination)
  async getPropertyCount(): Promise<number> {
    const response = await apiClient.get<PaginatedResponse<Property>>('/properties', {
      params: { limit: 1 },
    });
    return response.data.pagination.total;
  },

  // Get all properties (handle pagination automatically)
  async getAllProperties(filters?: Omit<PropertyFilters, 'limit' | 'offset'>): Promise<Property[]> {
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

  // Get scrape history
  async getScrapeHistory(limit: number = 20, offset: number = 0): Promise<PaginatedResponse<ScrapeHistory>> {
    const response = await apiClient.get<PaginatedResponse<ScrapeHistory>>('/properties/history', {
      params: { limit, offset },
    });
    return response.data;
  },

  // Get statistics
  async getStats(): Promise<PropertyStats> {
    const response = await apiClient.get<PropertyStats>('/properties/stats');
    return response.data;
  },

  // Add monitored search
  async addMonitoredSearch(searchTerm: string, frequency: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<MonitoredSearch> {
    const response = await apiClient.post<{ message: string; data: MonitoredSearch }>('/properties/monitor', {
      searchTerm,
      frequency,
    });
    return response.data.data;
  },

  // Get monitored searches
  async getMonitoredSearches(): Promise<MonitoredSearch[]> {
    const response = await apiClient.get<{ data: MonitoredSearch[] }>('/properties/monitor');
    return response.data.data;
  },
};

// Health check service
export const healthAPI = {
  async checkHealth(): Promise<boolean> {
    try {
      const response = await apiClient.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  },

  async checkQueueHealth(): Promise<any> {
    const response = await apiClient.get('/health/queue');
    return response.data;
  },
};

export default propertyAPI;
