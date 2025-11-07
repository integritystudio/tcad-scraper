import { useState } from 'react';
import { usePropertySearch } from '../../../hooks';
import { SearchBox } from './SearchBox';
import { ExampleQueries } from './ExampleQueries';
import { SearchResults } from './SearchResults';
import styles from './PropertySearchContainer.module.css';

export const PropertySearchContainer = () => {
  const { results, loading, error, totalResults, explanation, search } =
    usePropertySearch();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    await search(query);
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.header}>
          <h1>TCAD Property Explorer</h1>
          <p className={styles.subtitle}>
            Search 122,000+ Travis County properties using natural language
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
