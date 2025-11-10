import { SectionHeader } from '../components/SectionHeader';
import styles from './IdentifiersSection.module.css';

interface IdentifiersSectionProps {
  propertyId: string;
  geoId: string | null;
}

export const IdentifiersSection = ({
  propertyId,
  geoId,
}: IdentifiersSectionProps) => {
  return (
    <section className={styles.section}>
      <SectionHeader icon="hash" title="Identifiers" />
      <div className={styles.identifierList}>
        <div className={styles.identifierItem}>
          <span className={styles.label}>Property ID</span>
          <code className={styles.code}>{propertyId}</code>
        </div>
        {geoId && (
          <div className={styles.identifierItem}>
            <span className={styles.label}>Geo ID</span>
            <code className={styles.code}>{geoId}</code>
          </div>
        )}
        {!geoId && (
          <div className={styles.identifierItem}>
            <span className={styles.label}>Geo ID</span>
            <span className={styles.noData}>Not available</span>
          </div>
        )}
      </div>
    </section>
  );
};