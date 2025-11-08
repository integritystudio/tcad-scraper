/**
 * XController Client - Data Controller for loading server-passed data
 * Safely loads and caches JSON data from script tags in the DOM
 */

export class DataController {
  private cache: Map<string, any> = new Map();
  private debug: boolean;

  constructor(debug = false) {
    this.debug = debug;
  }

  /**
   * Load data from a JSON script tag in the DOM
   * @param id - The ID of the script tag containing JSON data
   * @returns The parsed data or null if not found/invalid
   */
  loadData<T = any>(id: string): T | null {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id) as T;
    }

    try {
      const scriptElement = document.getElementById(id);

      if (!scriptElement) {
        if (this.debug) {
          console.error(`[DataController] Script tag with id="${id}" not found`);
        }
        return null;
      }

      if (scriptElement.getAttribute('type') !== 'application/json') {
        if (this.debug) {
          console.error(
            `[DataController] Script tag with id="${id}" has wrong type attribute`
          );
        }
        return null;
      }

      const content = scriptElement.textContent;
      if (!content || content.trim() === '') {
        if (this.debug) {
          console.error(`[DataController] Script tag with id="${id}" is empty`);
        }
        return null;
      }

      const data = JSON.parse(content);

      // Validate that data is not null (null is not considered valid)
      if (data === null) {
        if (this.debug) {
          console.error(`[DataController] Data in script tag id="${id}" is null`);
        }
        return null;
      }

      // Cache the parsed data
      this.cache.set(id, data);

      return data as T;
    } catch (error) {
      if (this.debug) {
        console.error(`[DataController] Error loading data from id="${id}":`, error);
      }
      return null;
    }
  }

  /**
   * Load data with API fallback
   * @param id - The ID of the script tag
   * @param fallbackUrl - The API URL to fetch from if script tag is missing
   * @returns The data or null
   */
  async loadDataWithFallback<T = any>(
    id: string,
    fallbackUrl: string
  ): Promise<T | null> {
    // Try loading from script tag first
    const scriptData = this.loadData<T>(id);
    if (scriptData !== null) {
      return scriptData;
    }

    // Check if we already fetched this fallback
    const fallbackCacheKey = `__fallback__${fallbackUrl}`;
    if (this.cache.has(fallbackCacheKey)) {
      return this.cache.get(fallbackCacheKey) as T;
    }

    // Fallback to API
    try {
      const response = await fetch(fallbackUrl);

      if (!response.ok) {
        if (this.debug) {
          console.error(
            `[DataController] API fallback failed: ${response.status} ${response.statusText}`
          );
        }
        return null;
      }

      const data = await response.json();

      // Cache the API response
      this.cache.set(fallbackCacheKey, data);

      return data as T;
    } catch (error) {
      if (this.debug) {
        console.error(`[DataController] Error fetching fallback data:`, error);
      }
      return null;
    }
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Export a singleton instance for convenience
export const dataController = new DataController(import.meta.env.DEV);
