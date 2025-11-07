import { EXAMPLE_QUERIES } from '../../../utils/constants';
import styles from './ExampleQueries.module.css';

interface ExampleQueriesProps {
  onSelectQuery: (query: string) => void;
  disabled?: boolean;
}

export const ExampleQueries = ({
  onSelectQuery,
  disabled = false,
}: ExampleQueriesProps) => {
  return (
    <div className={styles.container}>
      <span className={styles.label}>Try:</span>
      <div className={styles.chips}>
        {EXAMPLE_QUERIES.map((example, idx) => (
          <button
            key={idx}
            onClick={() => onSelectQuery(example)}
            className={styles.chip}
            disabled={disabled}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
};
