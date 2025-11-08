# Component Implementation Guide

## Quick Start Reference

This guide provides code templates and implementation patterns for extending the PropertyCard UI. Use this alongside the Visual Design Plan for complete implementation details.

---

## File Structure to Create

```
src/components/features/PropertySearch/
│
├── PropertyCard.tsx                    (UPDATE - add expansion logic)
├── PropertyCard.module.css             (UPDATE - add new styles)
│
├── components/                         (NEW FOLDER)
│   └── ExpandButton/
│       ├── index.ts
│       ├── ExpandButton.tsx
│       └── ExpandButton.module.css
│
└── PropertyDetails/                    (NEW FOLDER)
    ├── index.ts
    ├── PropertyDetails.tsx
    ├── PropertyDetails.module.css
    │
    ├── sections/                       (NEW FOLDER)
    │   ├── FinancialSection.tsx
    │   ├── FinancialSection.module.css
    │   ├── IdentifiersSection.tsx
    │   ├── IdentifiersSection.module.css
    │   ├── DescriptionSection.tsx
    │   ├── DescriptionSection.module.css
    │   ├── MetadataSection.tsx
    │   └── MetadataSection.module.css
    │
    └── components/                     (NEW FOLDER)
        ├── SectionHeader.tsx
        ├── SectionHeader.module.css
        ├── ValueComparison.tsx
        ├── ValueComparison.module.css
        ├── TruncatedText.tsx
        ├── TruncatedText.module.css
        ├── TimestampList.tsx
        ├── TimestampList.module.css
        ├── FreshnessIndicator.tsx
        └── FreshnessIndicator.module.css
```

---

## Phase 1: Core Components

### 1. ExpandButton Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/components/ExpandButton/ExpandButton.tsx`

```typescript
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
        aria-hidden="true"
      />
    </button>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/components/ExpandButton/ExpandButton.module.css`

```css
.button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--neutral-200, #e5e7eb);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--neutral-700, #374151);
  font-size: 0.875rem;
  font-weight: 500;
}

.button:hover {
  background: var(--neutral-50, #f9fafb);
  border-color: var(--neutral-300, #d1d5db);
}

.button:active {
  background: var(--neutral-100, #f3f4f6);
  transform: scale(0.98);
}

.button:focus-visible {
  outline: 2px solid var(--primary-500, #3b82f6);
  outline-offset: 2px;
}

.icon {
  transition: transform 0.3s ease;
}

.expanded .icon {
  transform: rotate(180deg);
}

/* Size variants */
.sm {
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
}

.lg {
  padding: 0.625rem 1rem;
  font-size: 1rem;
}

.label {
  user-select: none;
}
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/components/ExpandButton/index.ts`

```typescript
export { ExpandButton } from './ExpandButton';
```

---

### 2. PropertyDetails Container

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/PropertyDetails.tsx`

```typescript
import { Property } from '../../../../types';
import { FinancialSection } from './sections/FinancialSection';
import { IdentifiersSection } from './sections/IdentifiersSection';
import { DescriptionSection } from './sections/DescriptionSection';
import { MetadataSection } from './sections/MetadataSection';
import styles from './PropertyDetails.module.css';

interface PropertyDetailsProps {
  property: Property;
  isExpanded: boolean;
  sections?: ('financial' | 'identifiers' | 'description' | 'metadata')[];
}

const DEFAULT_SECTIONS = ['financial', 'identifiers', 'description', 'metadata'] as const;

export const PropertyDetails = ({
  property,
  isExpanded,
  sections = DEFAULT_SECTIONS,
}: PropertyDetailsProps) => {
  if (!isExpanded) return null;

  return (
    <div className={styles.container}>
      {sections.includes('financial') && (
        <FinancialSection
          appraisedValue={property.appraised_value}
          assessedValue={property.assessed_value}
        />
      )}

      {sections.includes('identifiers') && (
        <IdentifiersSection
          propertyId={property.property_id}
          geoId={property.geo_id}
        />
      )}

      {sections.includes('description') && property.description && (
        <DescriptionSection description={property.description} />
      )}

      {sections.includes('metadata') && (
        <MetadataSection
          scrapedAt={property.scraped_at}
          updatedAt={property.updated_at}
          createdAt={property.created_at}
        />
      )}
    </div>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/PropertyDetails.module.css`

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobile optimization */
@media (max-width: 640px) {
  .container {
    gap: 0.75rem;
  }
}
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/index.ts`

```typescript
export { PropertyDetails } from './PropertyDetails';
export { FinancialSection } from './sections/FinancialSection';
export { IdentifiersSection } from './sections/IdentifiersSection';
export { DescriptionSection } from './sections/DescriptionSection';
export { MetadataSection } from './sections/MetadataSection';
```

---

### 3. SectionHeader Component (Reusable)

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/SectionHeader.tsx`

```typescript
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
        <Icon name={icon} size={16} className={styles.icon} aria-hidden="true" />
        <h4 className={styles.title}>{title}</h4>
      </div>
      {badge && <div className={styles.badge}>{badge}</div>}
    </div>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/SectionHeader.module.css`

```css
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--neutral-200, #e5e7eb);
  margin-bottom: 0.75rem;
}

.titleContainer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.icon {
  color: var(--neutral-600, #4b5563);
}

.title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--neutral-700, #374151);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge {
  display: flex;
  align-items: center;
}
```

---

### 4. FinancialSection Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/FinancialSection.tsx`

```typescript
import { useFormatting } from '../../../../../hooks';
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
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/FinancialSection.module.css`

```css
.section {
  padding: 0.75rem;
  background: var(--neutral-50, #f9fafb);
  border: 1px solid var(--neutral-200, #e5e7eb);
  border-radius: 0.375rem;
  transition: all 0.2s ease;
}

.section:hover {
  background: var(--neutral-100, #f3f4f6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
```

---

### 5. ValueComparison Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/ValueComparison.tsx`

```typescript
import { useMemo } from 'react';
import { useFormatting } from '../../../../../hooks';
import styles from './ValueComparison.module.css';

interface ValueComparisonProps {
  appraisedValue: number;
  assessedValue: number | null;
  showChart?: boolean;
}

export const ValueComparison = ({
  appraisedValue,
  assessedValue,
  showChart = false,
}: ValueComparisonProps) => {
  const { formatCurrency } = useFormatting();

  const difference = useMemo(() => {
    if (!assessedValue) return null;
    return assessedValue - appraisedValue;
  }, [appraisedValue, assessedValue]);

  const percentageDiff = useMemo(() => {
    if (!difference || !appraisedValue) return null;
    return (difference / appraisedValue) * 100;
  }, [difference, appraisedValue]);

  const getDifferenceClass = () => {
    if (!difference) return styles.neutral;
    return difference > 0 ? styles.positive : styles.negative;
  };

  const getDifferenceIcon = () => {
    if (!difference) return '➖';
    return difference > 0 ? '🔺' : '🔻';
  };

  return (
    <div className={styles.container}>
      <div className={styles.valueRow}>
        <span className={styles.label}>Appraised Value</span>
        <span className={styles.value}>{formatCurrency(appraisedValue)}</span>
      </div>

      {assessedValue !== null && (
        <>
          <div className={styles.valueRow}>
            <span className={styles.label}>Assessed Value</span>
            <span className={styles.value}>{formatCurrency(assessedValue)}</span>
          </div>

          {difference !== null && (
            <>
              <div className={styles.divider} />
              <div className={`${styles.valueRow} ${styles.differenceRow}`}>
                <span className={styles.label}>Difference</span>
                <span className={`${styles.value} ${getDifferenceClass()}`}>
                  {formatCurrency(Math.abs(difference))}
                  {percentageDiff !== null && (
                    <span className={styles.percentage}>
                      ({percentageDiff > 0 ? '+' : ''}{percentageDiff.toFixed(1)}%)
                    </span>
                  )}
                  <span className={styles.icon} aria-hidden="true">
                    {getDifferenceIcon()}
                  </span>
                </span>
              </div>

              {showChart && (
                <div className={styles.chartContainer}>
                  <div className={styles.chartBar}>
                    <div className={styles.chartLabel}>Appraised</div>
                    <div className={styles.barBackground}>
                      <div className={styles.barFill} style={{ width: '100%' }} />
                    </div>
                    <div className={styles.chartValue}>100%</div>
                  </div>
                  <div className={styles.chartBar}>
                    <div className={styles.chartLabel}>Assessed</div>
                    <div className={styles.barBackground}>
                      <div
                        className={styles.barFill}
                        style={{
                          width: `${((assessedValue / appraisedValue) * 100).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className={styles.chartValue}>
                      {((assessedValue / appraisedValue) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {assessedValue === null && (
        <div className={styles.noData}>
          <span className={styles.label}>Assessed Value</span>
          <span className={styles.noDataText}>Not available</span>
        </div>
      )}
    </div>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/ValueComparison.module.css`

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.valueRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.label {
  font-size: 0.875rem;
  color: var(--neutral-600, #4b5563);
}

.value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--neutral-900, #111827);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.divider {
  height: 1px;
  background: var(--neutral-200, #e5e7eb);
  margin: 0.25rem 0;
}

.differenceRow {
  margin-top: 0.25rem;
}

/* Color variants for difference */
.positive {
  color: var(--financial-positive, #10b981);
}

.negative {
  color: var(--financial-negative, #ef4444);
}

.neutral {
  color: var(--neutral-600, #6b7280);
}

.percentage {
  font-size: 0.8125rem;
  font-weight: 500;
  margin-left: 0.25rem;
}

.icon {
  font-size: 1rem;
}

.noData {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.noDataText {
  font-size: 0.875rem;
  color: var(--neutral-400, #9ca3af);
  font-style: italic;
}

/* Chart styles */
.chartContainer {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--neutral-200, #e5e7eb);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chartBar {
  display: grid;
  grid-template-columns: 5rem 1fr 3rem;
  align-items: center;
  gap: 0.75rem;
}

.chartLabel {
  font-size: 0.75rem;
  color: var(--neutral-600, #4b5563);
  text-align: right;
}

.barBackground {
  height: 1.5rem;
  background: var(--neutral-200, #e5e7eb);
  border-radius: 0.25rem;
  overflow: hidden;
}

.barFill {
  height: 100%;
  background: var(--primary-500, #3b82f6);
  transition: width 0.5s ease;
}

.chartValue {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--neutral-700, #374151);
}
```

---

### 6. Updated PropertyCard Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.tsx` (UPDATED)

```typescript
import { useEffect, useState } from 'react';
import { Property } from '../../../types';
import { useFormatting, useAnalytics } from '../../../hooks';
import { Card, CardHeader, CardBody } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { ExpandButton } from './components/ExpandButton';
import { PropertyDetails } from './PropertyDetails';
import styles from './PropertyCard.module.css';

interface PropertyCardProps {
  property: Property;
  defaultExpanded?: boolean;
}

export const PropertyCard = ({ property, defaultExpanded = false }: PropertyCardProps) => {
  const { formatCurrency } = useFormatting();
  const { logPropertyView } = useAnalytics();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Track property view when card is rendered
  useEffect(() => {
    logPropertyView(property.property_id, property.property_address);
  }, [property.property_id, property.property_address, logPropertyView]);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card variant="elevated" className={styles.card}>
      <CardHeader>
        <div className={styles.header}>
          <h3 className={styles.owner}>{property.name}</h3>
          <Badge variant="info" size="sm">
            {property.prop_type}
          </Badge>
        </div>
      </CardHeader>

      <CardBody>
        <div className={styles.address}>
          <Icon name="location" size={14} />
          {property.property_address}
          {property.city && `, ${property.city}`}
        </div>

        <div className={styles.summary}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Appraised Value</span>
            <span className={styles.detailValue}>
              {formatCurrency(property.appraised_value)}
            </span>
          </div>

          <div className={styles.expandButtonContainer}>
            <ExpandButton
              isExpanded={isExpanded}
              onToggle={handleToggleExpand}
              size="sm"
            />
          </div>
        </div>

        <PropertyDetails
          property={property}
          isExpanded={isExpanded}
        />
      </CardBody>
    </Card>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.module.css` (ADD TO EXISTING)

```css
/* ... existing styles ... */

/* New styles for expansion */
.summary {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.expandButtonContainer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .owner {
    font-size: 1rem;
  }

  .expandButtonContainer {
    width: 100%;
  }

  .expandButtonContainer button {
    width: 100%;
    justify-content: center;
  }
}
```

---

## Phase 2: Additional Sections

### 7. IdentifiersSection Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/IdentifiersSection.tsx`

```typescript
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
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/IdentifiersSection.module.css`

```css
.section {
  padding: 0.75rem;
  background: var(--neutral-50, #f9fafb);
  border: 1px solid var(--neutral-200, #e5e7eb);
  border-radius: 0.375rem;
}

.identifierList {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.identifierItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.label {
  font-size: 0.875rem;
  color: var(--neutral-600, #4b5563);
}

.code {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--neutral-900, #111827);
  background: var(--neutral-100, #f3f4f6);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid var(--neutral-200, #e5e7eb);
}

.noData {
  font-size: 0.875rem;
  color: var(--neutral-400, #9ca3af);
  font-style: italic;
}
```

---

### 8. DescriptionSection Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/DescriptionSection.tsx`

```typescript
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
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/DescriptionSection.module.css`

```css
.section {
  padding: 0.75rem;
  background: var(--neutral-50, #f9fafb);
  border: 1px solid var(--neutral-200, #e5e7eb);
  border-radius: 0.375rem;
}
```

---

### 9. TruncatedText Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/TruncatedText.tsx`

```typescript
import { useState } from 'react';
import styles from './TruncatedText.module.css';

interface TruncatedTextProps {
  text: string | null;
  maxLength?: number;
  expandLabel?: string;
  collapseLabel?: string;
}

export const TruncatedText = ({
  text,
  maxLength = 150,
  expandLabel = 'Show more',
  collapseLabel = 'Show less',
}: TruncatedTextProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) {
    return (
      <p className={styles.noData}>
        No description available for this property.
      </p>
    );
  }

  const needsTruncation = text.length > maxLength;
  const displayText = needsTruncation && !isExpanded
    ? `${text.slice(0, maxLength)}...`
    : text;

  return (
    <div className={styles.container}>
      <p className={styles.text}>{displayText}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={styles.toggleButton}
        >
          {isExpanded ? collapseLabel : expandLabel}
        </button>
      )}
    </div>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/TruncatedText.module.css`

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--neutral-700, #374151);
  white-space: pre-wrap;
}

.toggleButton {
  align-self: flex-start;
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--primary-600, #2563eb);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggleButton:hover {
  color: var(--primary-700, #1d4ed8);
  text-decoration: underline;
}

.toggleButton:focus-visible {
  outline: 2px solid var(--primary-500, #3b82f6);
  outline-offset: 2px;
  border-radius: 0.25rem;
}

.noData {
  margin: 0;
  font-size: 0.875rem;
  color: var(--neutral-400, #9ca3af);
  font-style: italic;
}
```

---

### 10. MetadataSection Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/MetadataSection.tsx`

```typescript
import { SectionHeader } from '../components/SectionHeader';
import { TimestampList } from '../components/TimestampList';
import { FreshnessIndicator } from '../components/FreshnessIndicator';
import styles from './MetadataSection.module.css';

interface MetadataSectionProps {
  scrapedAt: string;
  updatedAt: string;
  createdAt: string;
}

export const MetadataSection = ({
  scrapedAt,
  updatedAt,
  createdAt,
}: MetadataSectionProps) => {
  return (
    <section className={styles.section}>
      <SectionHeader
        icon="clock"
        title="Data Freshness"
        badge={<FreshnessIndicator timestamp={scrapedAt} />}
      />
      <TimestampList
        scrapedAt={scrapedAt}
        updatedAt={updatedAt}
        createdAt={createdAt}
      />
    </section>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/MetadataSection.module.css`

```css
.section {
  padding: 0.75rem;
  background: var(--neutral-50, #f9fafb);
  border: 1px solid var(--neutral-200, #e5e7eb);
  border-radius: 0.375rem;
}
```

---

### 11. TimestampList Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/TimestampList.tsx`

```typescript
import { useMemo } from 'react';
import styles from './TimestampList.module.css';

interface TimestampListProps {
  scrapedAt: string;
  updatedAt: string;
  createdAt: string;
  showRelative?: boolean;
}

export const TimestampList = ({
  scrapedAt,
  updatedAt,
  createdAt,
  showRelative = true,
}: TimestampListProps) => {
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const formatAbsoluteTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const relativeScraped = useMemo(() => formatRelativeTime(scrapedAt), [scrapedAt]);
  const relativeUpdated = useMemo(() => formatRelativeTime(updatedAt), [updatedAt]);

  return (
    <div className={styles.container}>
      <div className={styles.timestampItem}>
        <span className={styles.label}>Last Scraped</span>
        <div className={styles.timeContainer}>
          {showRelative && (
            <span className={styles.relativeTime}>{relativeScraped}</span>
          )}
          <span className={styles.absoluteTime}>
            ({formatAbsoluteTime(scrapedAt)})
          </span>
        </div>
      </div>

      <div className={styles.timestampItem}>
        <span className={styles.label}>Last Updated</span>
        <div className={styles.timeContainer}>
          {showRelative && (
            <span className={styles.relativeTime}>{relativeUpdated}</span>
          )}
          <span className={styles.absoluteTime}>
            ({formatAbsoluteTime(updatedAt)})
          </span>
        </div>
      </div>

      <div className={styles.timestampItem}>
        <span className={styles.label}>Created</span>
        <span className={styles.absoluteTime}>
          {formatAbsoluteTime(createdAt)}
        </span>
      </div>
    </div>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/TimestampList.module.css`

```css
.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.timestampItem {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--neutral-100, #f3f4f6);
}

.timestampItem:last-child {
  border-bottom: none;
}

.label {
  font-size: 0.875rem;
  color: var(--neutral-600, #4b5563);
  flex-shrink: 0;
}

.timeContainer {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.125rem;
}

.relativeTime {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--neutral-900, #111827);
}

.absoluteTime {
  font-size: 0.75rem;
  color: var(--neutral-400, #9ca3af);
}

/* Mobile responsive */
@media (max-width: 640px) {
  .timestampItem {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .timeContainer {
    align-items: flex-start;
  }
}
```

---

### 12. FreshnessIndicator Component

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/FreshnessIndicator.tsx`

```typescript
import { useMemo } from 'react';
import { Badge } from '../../../../../ui/Badge';
import styles from './FreshnessIndicator.module.css';

interface FreshnessIndicatorProps {
  timestamp: string;
  thresholds?: {
    fresh: number;
    aging: number;
  };
  variant?: 'dot' | 'badge';
}

const DEFAULT_THRESHOLDS = {
  fresh: 7,   // days
  aging: 30,  // days
};

export const FreshnessIndicator = ({
  timestamp,
  thresholds = DEFAULT_THRESHOLDS,
  variant = 'badge',
}: FreshnessIndicatorProps) => {
  const { status, label } = useMemo(() => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= thresholds.fresh) {
      return { status: 'fresh', label: 'Fresh' };
    } else if (diffDays <= thresholds.aging) {
      return { status: 'aging', label: 'Aging' };
    } else {
      return { status: 'stale', label: 'Stale' };
    }
  }, [timestamp, thresholds]);

  if (variant === 'dot') {
    return (
      <span
        className={`${styles.dot} ${styles[status]}`}
        aria-label={`Data freshness: ${label}`}
        title={label}
      />
    );
  }

  const badgeVariant = status === 'fresh' ? 'success' : status === 'aging' ? 'warning' : 'error';

  return (
    <Badge variant={badgeVariant} size="sm">
      {label}
    </Badge>
  );
};
```

**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/FreshnessIndicator.module.css`

```css
.dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.fresh {
  background-color: var(--status-fresh, #10b981);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.dot.aging {
  background-color: var(--status-aging, #d97706);
  box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.2);
}

.dot.stale {
  background-color: var(--status-stale, #ef4444);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}
```

---

## Quick Implementation Checklist

### Phase 1 (Week 1) - Core Expansion
- [ ] Create `ExpandButton` component
- [ ] Create `PropertyDetails` container
- [ ] Create `SectionHeader` reusable component
- [ ] Create `FinancialSection` with `ValueComparison`
- [ ] Update `PropertyCard` to integrate expansion
- [ ] Test expansion animation (should be smooth, < 300ms)
- [ ] Test keyboard accessibility (Tab, Enter, Space)
- [ ] Test on mobile (< 640px width)

### Phase 2 (Week 2) - Additional Sections
- [ ] Create `IdentifiersSection`
- [ ] Create `DescriptionSection` with `TruncatedText`
- [ ] Create `MetadataSection` with `TimestampList`
- [ ] Create `FreshnessIndicator`
- [ ] Test null/missing data handling
- [ ] Test responsive layouts (mobile, tablet, desktop)
- [ ] Add analytics tracking for section views

### Phase 3 (Optional) - Enhancements
- [ ] Add mini chart to `ValueComparison`
- [ ] Add copy-to-clipboard to identifiers
- [ ] Add map integration (if geo_id available)
- [ ] Add loading skeletons
- [ ] Performance optimization (React.memo, lazy loading)
- [ ] A/B testing setup

---

## Testing Guide

### Unit Tests Example

```typescript
// PropertyCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PropertyCard } from './PropertyCard';

const mockProperty = {
  id: '1',
  property_id: 'R123456',
  name: 'John Smith',
  prop_type: 'RESIDENTIAL',
  city: 'Austin',
  property_address: '123 Main Street',
  assessed_value: 435000,
  appraised_value: 450000,
  geo_id: null,
  description: null,
  search_term: null,
  scraped_at: '2025-01-15T10:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
};

describe('PropertyCard', () => {
  it('renders collapsed by default', () => {
    render(<PropertyCard property={mockProperty} />);
    expect(screen.getByText('Show Details')).toBeInTheDocument();
    expect(screen.queryByText('FINANCIAL BREAKDOWN')).not.toBeInTheDocument();
  });

  it('expands when button is clicked', () => {
    render(<PropertyCard property={mockProperty} />);
    fireEvent.click(screen.getByText('Show Details'));
    expect(screen.getByText('Hide Details')).toBeInTheDocument();
    expect(screen.getByText('FINANCIAL BREAKDOWN')).toBeInTheDocument();
  });

  it('calculates value difference correctly', () => {
    render(<PropertyCard property={mockProperty} defaultExpanded />);
    expect(screen.getByText('-$15,000')).toBeInTheDocument();
    expect(screen.getByText('(-3.3%)')).toBeInTheDocument();
  });
});
```

---

## Performance Tips

1. **Use React.memo for sections:**
```typescript
export const FinancialSection = memo(FinancialSectionComponent);
```

2. **Lazy load details:**
```typescript
const PropertyDetails = lazy(() => import('./PropertyDetails'));
```

3. **Debounce expand/collapse:**
```typescript
const debouncedToggle = useMemo(
  () => debounce(handleToggle, 100),
  []
);
```

4. **Use CSS transitions (faster than JS animations)**

5. **Optimize re-renders with useCallback:**
```typescript
const handleToggle = useCallback(() => {
  setIsExpanded(prev => !prev);
}, []);
```

---

## Accessibility Checklist

- [ ] All interactive elements have proper ARIA labels
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Screen reader announces state changes
- [ ] Animations can be disabled (prefers-reduced-motion)
- [ ] Touch targets are at least 44x44px on mobile

---

## File Path Summary

All new files will be created in:
```
/home/aledlie/tcad-scraper/src/components/features/PropertySearch/
```

Key files to create:
1. `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/components/ExpandButton/ExpandButton.tsx`
2. `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/PropertyDetails.tsx`
3. `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/sections/FinancialSection.tsx`
4. `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyDetails/components/ValueComparison.tsx`

(Plus corresponding CSS modules for each)

Key files to update:
1. `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.tsx`
2. `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.module.css`

---

**Ready to implement!** Start with ExpandButton and PropertyDetails container, then build sections incrementally.
