import { ReactNode } from 'react';
import { Icon, IconName } from '../../../../../ui/Icon';
import styles from './SectionHeader.module.css';

interface SectionHeaderProps {
  icon: IconName;
  title: string;
  badge?: ReactNode;
  className?: string;
}

export const SectionHeader = ({
  icon,
  title,
  badge,
  className = '',
}: SectionHeaderProps) => {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.titleContainer}>
        <Icon name={icon} size={16} className={styles.icon} aria-hidden={true} />
        <h4 className={styles.title}>{title}</h4>
      </div>
      {badge && <div className={styles.badge}>{badge}</div>}
    </div>
  );
};