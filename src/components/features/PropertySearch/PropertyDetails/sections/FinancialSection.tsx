import { SectionHeader } from '../components/SectionHeader';
import { ValueComparison } from '../components/ValueComparison';
import styles from './FinancialSection.module.css';

interface FinancialSectionProps {
  appraisedValue: number;
  assessedValue: number | null;
}

export const FinancialSection = ({
  appraisedValue,
  assessedValue,
}: FinancialSectionProps) => {
  return (
    <section className={styles.section}>
      <SectionHeader icon="dollar-sign" title="Financial Breakdown" />
      <ValueComparison
        appraisedValue={appraisedValue}
        assessedValue={assessedValue}
      />
    </section>
  );
};