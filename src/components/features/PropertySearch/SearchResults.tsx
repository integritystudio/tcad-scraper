import { Property } from '../../../types';
import { PropertyCard } from './PropertyCard';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';
import styles from './SearchResults.module.css';

interface SearchResultsProps {
  results: Property[];
  totalResults: number;
  explanation?: string;
  error?: string;
  loading?: boolean;
  searchQuery?: string;
  onLoadMore?: () => void;
}

export const SearchResults = ({
  results,
  totalResults,
  explanation,
  error,
  loading,
  searchQuery,
  onLoadMore,
}: SearchResultsProps) => {
  if (error) {
    return (
      <div className={styles.errorMessage}>
        <Icon name="alertCircle" />
        <div>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!loading && results.length === 0 && searchQuery) {
    return (
      <div className={styles.noResults}>
        <Icon name="search" size={48} />
        <h3>No properties found</h3>
        <p>Try adjusting your search query or using one of the examples above</p>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {explanation && (
        <div className={styles.explanation}>
          <div className={styles.explanationIcon}>
            <Icon name="chevronRight" size={16} />
          </div>
          <span>{explanation}</span>
          <span className={styles.resultCount}>({totalResults} results)</span>
        </div>
      )}

      <div className={styles.resultsGrid}>
        {results.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>

      {results.length < totalResults && onLoadMore && (
        <div className={styles.loadMore}>
          <p>
            Showing {results.length} of {totalResults} results
          </p>
          <Button onClick={onLoadMore} variant="outline">
            Load More
          </Button>
        </div>
      )}
    </div>
  );
};
