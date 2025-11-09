import { Icon } from '../../../../ui/Icon';
import styles from './ExpandButton.module.css';

interface ExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  label?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ExpandButton = ({
  isExpanded,
  onToggle,
  label,
  iconOnly = false,
  size = 'md',
  className = '',
}: ExpandButtonProps) => {
  const buttonLabel = label || (isExpanded ? 'Hide Details' : 'Show Details');

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${styles.button} ${styles[size]} ${isExpanded ? styles.expanded : ''} ${className}`}
      aria-expanded={isExpanded}
      aria-label={buttonLabel}
    >
      {!iconOnly && <span className={styles.label}>{buttonLabel}</span>}
      <Icon
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20}
        className={styles.icon}
        aria-hidden={true}
      />
    </button>
  );
};