/**
 * XController Client Library
 * Securely load server-passed data in the client
 */

/**
 * Data Controller for loading embedded data
 */
export class DataController {
  private cache: Map<string, any> = new Map();
  private readonly debug: boolean;

  constructor(debug: boolean = false) {
    this.debug = debug;
  }

  /**
   * Load data from a JSON script tag
   * @param scriptId - ID of the script tag containing data
   * @returns Parsed data or null if not found/invalid
   */
  loadData<T>(scriptId: string): T | null {
    // Check cache first
    if (this.cache.has(scriptId)) {
      if (this.debug) {
        console.log(`[DataController] Loading from cache: ${scriptId}`);
      }
      return this.cache.get(scriptId);
    }

    const scriptTag = document.getElementById(scriptId);

    if (!scriptTag) {
      console.error(`[DataController] Script tag with id "${scriptId}" not found`);
      return null;
    }

    if (scriptTag.getAttribute('type') !== 'application/json') {
      console.error(`[DataController] Script tag "${scriptId}" is not type="application/json"`);
      return null;
    }

    try {
      const textContent = scriptTag.textContent || '';
      const data = JSON.parse(textContent) as T;

      // Validate data structure
      if (!this.validateData(data)) {
        console.error(`[DataController] Data validation failed for ${scriptId}`);
        return null;
      }

      // Cache the parsed data
      this.cache.set(scriptId, data);

      if (this.debug) {
        console.log(`[DataController] Loaded and cached: ${scriptId}`, data);
      }

      return data;
    } catch (error) {
      console.error(`[DataController] Failed to parse data from ${scriptId}:`, error);
      return null;
    }
  }

  /**
   * Load data with a fallback API call
   * @param scriptId - ID of the script tag
   * @param fallbackUrl - API endpoint to call if script tag fails
   * @returns Promise of parsed data
   */
  async loadDataWithFallback<T>(
    scriptId: string,
    fallbackUrl: string
  ): Promise<T | null> {
    // Try loading from script tag first
    const data = this.loadData<T>(scriptId);
    if (data) {
      return data;
    }

    // Fallback to API call
    if (this.debug) {
      console.log(`[DataController] Falling back to API: ${fallbackUrl}`);
    }

    try {
      const response = await fetch(fallbackUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const apiData = await response.json();

      // Cache the API data
      this.cache.set(scriptId, apiData);

      return apiData as T;
    } catch (error) {
      console.error(`[DataController] API fallback failed for ${fallbackUrl}:`, error);
      return null;
    }
  }

  /**
   * Validate data structure
   * Override this method for custom validation
   */
  protected validateData(data: any): boolean {
    // Basic validation - ensure it's an object
    if (data === null || typeof data !== 'object') {
      return false;
    }

    // Add more specific validation here if needed
    return true;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    if (this.debug) {
      console.log('[DataController] Cache cleared');
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * Global data controller instance
 */
export const dataController = new DataController(
  process.env.NODE_ENV === 'development'
);

/**
 * Hook for React to load initial data
 */
export function useInitialData<T>(scriptId: string, fallbackUrl?: string): T | null {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const result = fallbackUrl
          ? await dataController.loadDataWithFallback<T>(scriptId, fallbackUrl)
          : dataController.loadData<T>(scriptId);

        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [scriptId, fallbackUrl]);

  return data;
}

// Re-export React for the hook if needed
declare const React: any;
