/**
 * API Configuration Utility
 * Handles API URL resolution with proper fallback chain:
 * 1. Server-passed config (xcontroller)
 * 2. Build-time environment variable (VITE_API_URL)
 * 3. Local development fallback (/api)
 */

import { dataController } from './xcontroller.client';

interface InitialAppData {
  apiUrl: string;
  environment: string;
  features: {
    search: boolean;
    analytics: boolean;
    monitoring: boolean;
  };
  version: string;
}

/**
 * Get the API base URL for making requests
 * @returns The API base URL to use for API calls
 */
export function getApiBaseUrl(): string {
  // Priority 1: Server-passed configuration (for SSR scenarios)
  const initialData = dataController.loadData<InitialAppData>('initial-data');
  if (initialData?.apiUrl) {
    return initialData.apiUrl;
  }

  // Priority 2: Build-time environment variable (for static deployments)
  // VITE_API_URL is set in .github/workflows/deploy.yml for GitHub Pages
  const viteApiUrl = import.meta.env.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }

  // Priority 3: Local development fallback
  // Uses relative path for local dev server proxy configuration
  return '/api';
}
