import { SectionHeader } from '../components/SectionHeader';
import { TruncatedText } from '../components/TruncatedText';
import styles from './DescriptionSection.module.css';

interface DescriptionSectionProps {
  description: string | null;
}

export const DescriptionSection = ({ description }: DescriptionSectionProps) => {
  if (!description) return null;

  return (
    <section className={styles.section}>
      <SectionHeader icon="file-text" title="Description" />
      <TruncatedText text={description} maxLength={150} />
    </section>
  );
};