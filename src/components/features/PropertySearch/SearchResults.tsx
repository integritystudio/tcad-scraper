import { Property, AnswerStatistics, AnswerBoxState } from '../../../types';
import { PropertyCard } from './PropertyCard';
import { AnswerBox } from './AnswerBox';
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
  answer?: string;
  answerState?: AnswerBoxState;
  statistics?: AnswerStatistics;
}

export const SearchResults = ({
  results,
  totalResults,
  explanation,
  error,
  loading,
  searchQuery,
  onLoadMore,
  answer,
  answerState = 'idle',
  statistics,
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
      {/* Answer Box for quantitative queries */}
      {(answer || answerState === 'loading') && (
        <AnswerBox
          answer={answer || ''}
          totalResults={totalResults}
          statistics={statistics}
          searchQuery={searchQuery || ''}
          state={answerState}
          error={error}
        />
      )}

      {/* Explanation for non-quantitative queries (only show if no answer) */}
      {explanation && !answer && answerState !== 'loading' && (
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
