import { useState, KeyboardEvent } from 'react';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import styles from './SearchBox.module.css';

interface SearchBoxProps {
  onSearch: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
}

export const SearchBox = ({
  onSearch,
  loading = false,
  placeholder = "Ask anything... e.g., 'properties in Austin worth over $500k'",
}: SearchBoxProps) => {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={styles.searchBox}>
      <div className={styles.searchIcon}>
        <Icon name="search" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        className={styles.searchInput}
        disabled={loading}
      />
      <Button
        onClick={handleSearch}
        disabled={loading || !query.trim()}
        variant="primary"
      >
        {loading ? 'Searching...' : 'Search'}
      </Button>
    </div>
  );
};
