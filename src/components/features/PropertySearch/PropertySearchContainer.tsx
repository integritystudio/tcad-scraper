import { useState, useEffect } from 'react';
import { usePropertySearch, useAnalytics } from '../../../hooks';
import { SearchBox } from './SearchBox';
import { ExampleQueries } from './ExampleQueries';
import { SearchResults } from './SearchResults';
import { BUILD_CONSTANTS } from '../../../constants/build';
import styles from './PropertySearchContainer.module.css';

export const PropertySearchContainer = () => {
  const { results, loading, error, totalResults, explanation, search } =
    usePropertySearch();
  const { logSearch, logSearchResults, logError } = useAnalytics();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    // Track search initiation
    logSearch(query);

    await search(query);
  };

  // Track search results when they change
  useEffect(() => {
    if (results.length > 0 && searchQuery) {
      logSearchResults(searchQuery, totalResults, !!explanation);
    }
  }, [results, totalResults, explanation, searchQuery, logSearchResults]);

  // Track errors
  useEffect(() => {
    if (error) {
      logError(error, 'property_search');
    }
  }, [error, logError]);

  // Use build-time constant for property count (calculated during build)
  const propertyCount = BUILD_CONSTANTS.TOTAL_PROPERTIES;
  const formattedCount = BUILD_CONSTANTS.TOTAL_PROPERTIES_FORMATTED;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.header}>
          <h1>TCAD Property Explorer</h1>
          <p className={styles.subtitle}>
            {propertyCount !== null ? (
              <>Search {formattedCount} Travis County properties using natural language</>
            ) : (
              <>Search Travis County properties using natural language</>
            )}
          </p>
        </div>

        <div className={styles.searchContainer}>
          <SearchBox onSearch={handleSearch} loading={loading} />
          <ExampleQueries
            onSelectQuery={handleSearch}
            disabled={loading}
          />
        </div>
      </div>

      <SearchResults
        results={results}
        totalResults={totalResults}
        explanation={explanation}
        error={error}
        loading={loading}
        searchQuery={searchQuery}
      />
    </div>
  );
};
