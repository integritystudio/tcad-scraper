# PropertyCard Extension - Developer Implementation Spec

**Status:** Ready for Development
**Priority:** High
**Target:** Phase 1 completion by end of Week 1
**Full UX Research:** [UX_RESEARCH_PROPERTY_DETAILS.md](/home/aledlie/tcad-scraper/docs/UX_RESEARCH_PROPERTY_DETAILS.md)

---

## Phase 1: Core Expansion Feature

### Overview
Extend the existing PropertyCard component to support expandable state, displaying 6 additional property fields on demand while maintaining current functionality.

---

## 1. Component Architecture Changes

### Current State
**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.tsx`

**Current Display (6 fields):**
- name (owner)
- prop_type (badge)
- property_address + city
- appraised_value
- assessed_value (conditional)
- property_id

### Target State
**New Display Strategy:**

**Collapsed (Default) - 6 fields:**
- name
- prop_type
- property_address + city
- appraised_value
- property_id
- **NEW:** data_freshness (calculated from scraped_at)

**Expanded (On Click) - 12 fields total (+6):**
- All collapsed fields PLUS:
- **NEW:** assessed_value with differential badge
- **NEW:** geo_id with copy button
- **NEW:** description (legal, truncated to 100 chars)
- **NEW:** timestamps section (scraped_at, updated_at, created_at)
- **NEW:** search_term (discovery context)

---

## 2. Component API

### Enhanced Props Interface

```typescript
interface PropertyCardProps {
  property: Property;
  defaultExpanded?: boolean;          // For testing/specific use cases
  onExpand?: (propertyId: string) => void;      // Analytics callback
  onCollapse?: (propertyId: string) => void;    // Analytics callback
  onCompare?: (property: Property) => void;     // Phase 3: Comparison
  isInComparison?: boolean;           // Phase 3: Visual indicator
  className?: string;                 // Allow parent styling
}
```

### State Management

```typescript
const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
const [timeExpanded, setTimeExpanded] = useState<number | null>(null);

// Track expansion time for analytics
useEffect(() => {
  if (isExpanded) {
    setTimeExpanded(Date.now());
  } else if (timeExpanded) {
    const duration = Date.now() - timeExpanded;
    logCardCollapsed(property.property_id, duration);
    setTimeExpanded(null);
  }
}, [isExpanded]);
```

---

## 3. Calculated Fields & Utilities

### Create Utility File
**File:** `/home/aledlie/tcad-scraper/src/utils/propertyCalculations.ts`

```typescript
/**
 * Calculate value differential between assessed and appraised values
 */
export interface ValueDifferential {
  percentage: number;
  label: string;
  variant: 'danger' | 'success' | 'neutral';
  icon: string;
}

export const calculateValueDifferential = (
  assessed: number | null,
  appraised: number
): ValueDifferential | null => {
  if (!assessed) return null;

  const diff = ((assessed - appraised) / appraised) * 100;

  if (diff < -10) {
    return {
      percentage: diff,
      label: 'Undervalued',
      variant: 'danger',
      icon: '🔻'
    };
  }

  if (diff > 10) {
    return {
      percentage: diff,
      label: 'Overvalued',
      variant: 'success',
      icon: '🔺'
    };
  }

  return {
    percentage: diff,
    label: 'Market rate',
    variant: 'neutral',
    icon: '➖'
  };
};

/**
 * Format data age with color indicator
 */
export interface DataAge {
  text: string;
  color: 'green' | 'yellow' | 'red';
  shouldWarn: boolean;
  dotColor: string;
}

export const formatDataAge = (scrapedAt: string): DataAge => {
  const age = Date.now() - new Date(scrapedAt).getTime();
  const ageInDays = Math.floor(age / (1000 * 60 * 60 * 24));

  if (ageInDays < 1) {
    return {
      text: 'Updated today',
      color: 'green',
      shouldWarn: false,
      dotColor: '#22c55e'
    };
  }

  if (ageInDays < 7) {
    return {
      text: `Updated ${ageInDays}d ago`,
      color: 'green',
      shouldWarn: false,
      dotColor: '#22c55e'
    };
  }

  if (ageInDays < 30) {
    return {
      text: `Updated ${ageInDays}d ago`,
      color: 'yellow',
      shouldWarn: false,
      dotColor: '#eab308'
    };
  }

  return {
    text: `Updated ${ageInDays}d ago`,
    color: 'red',
    shouldWarn: true,
    dotColor: '#ef4444'
  };
};

/**
 * Truncate long text with ellipsis
 */
export const truncateText = (text: string | null, maxLength: number): string => {
  if (!text) return 'N/A';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Format timestamp as relative or absolute
 */
export const formatTimestamp = (
  timestamp: string,
  relative: boolean = true
): string => {
  const date = new Date(timestamp);

  if (relative) {
    const age = Date.now() - date.getTime();
    const ageInDays = Math.floor(age / (1000 * 60 * 60 * 24));
    const ageInHours = Math.floor(age / (1000 * 60 * 60));

    if (ageInHours < 1) return 'Just now';
    if (ageInHours < 24) return `${ageInHours}h ago`;
    if (ageInDays < 30) return `${ageInDays}d ago`;

    // Fallback to absolute for very old dates
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};
```

---

## 4. Component Structure

### Updated PropertyCard.tsx

```typescript
import { useState, useEffect } from 'react';
import { Property } from '../../../types';
import { useFormatting, useAnalytics } from '../../../hooks';
import { Card, CardHeader, CardBody, CardFooter } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { Button } from '../../ui/Button';
import {
  calculateValueDifferential,
  formatDataAge,
  truncateText,
  formatTimestamp
} from '../../../utils/propertyCalculations';
import styles from './PropertyCard.module.css';

interface PropertyCardProps {
  property: Property;
  defaultExpanded?: boolean;
  onExpand?: (propertyId: string) => void;
  onCollapse?: (propertyId: string) => void;
  className?: string;
}

export const PropertyCard = ({
  property,
  defaultExpanded = false,
  onExpand,
  onCollapse,
  className
}: PropertyCardProps) => {
  const { formatCurrency } = useFormatting();
  const { logPropertyView, logCardExpanded, logCardCollapsed } = useAnalytics();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [timeExpanded, setTimeExpanded] = useState<number | null>(null);

  // Calculate derived values
  const valueDiff = calculateValueDifferential(
    property.assessed_value,
    property.appraised_value
  );
  const dataAge = formatDataAge(property.scraped_at);

  // Track property view on mount
  useEffect(() => {
    logPropertyView(property.property_id, property.property_address);
  }, [property.property_id, property.property_address, logPropertyView]);

  // Track expansion time for analytics
  useEffect(() => {
    if (isExpanded && !timeExpanded) {
      setTimeExpanded(Date.now());
    } else if (!isExpanded && timeExpanded) {
      const duration = Date.now() - timeExpanded;
      logCardCollapsed(property.property_id, duration);
      setTimeExpanded(null);
    }
  }, [isExpanded, timeExpanded, property.property_id, logCardCollapsed]);

  const handleCardClick = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);

    if (newExpandedState) {
      onExpand?.(property.property_id);
      logCardExpanded(property.property_id, 'click');
    } else {
      onCollapse?.(property.property_id);
    }
  };

  const handleCopyId = async (id: string, fieldName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card expansion

    try {
      await navigator.clipboard.writeText(id);
      // TODO: Show toast notification "Copied!"
      // logFieldCopied(property.property_id, fieldName);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card
      variant="elevated"
      className={`${styles.card} ${isExpanded ? styles.expanded : ''} ${className || ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={`property-details-${property.id}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <CardHeader>
        <div className={styles.header}>
          <h3 className={styles.owner}>{property.name}</h3>
          <Badge variant="info" size="sm">
            {property.prop_type}
          </Badge>
        </div>
      </CardHeader>

      <CardBody>
        {/* Always Visible - Collapsed State */}
        <div className={styles.address}>
          <Icon name="location" size={14} />
          {property.property_address}
          {property.city && `, ${property.city}`}
        </div>

        <div className={styles.details}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Appraised Value</span>
            <span className={styles.detailValue}>
              {formatCurrency(property.appraised_value)}
            </span>
          </div>

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Property ID</span>
            <div className={styles.detailValueWithAction}>
              <span className={`${styles.detailValue} ${styles.mono}`}>
                {property.property_id}
              </span>
              <button
                className={styles.copyButton}
                onClick={(e) => handleCopyId(property.property_id, 'property_id', e)}
                aria-label="Copy property ID"
                title="Copy to clipboard"
              >
                <Icon name="copy" size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Data Freshness - Always Visible */}
        <div className={styles.dataAge}>
          <span
            className={styles.ageDot}
            style={{ backgroundColor: dataAge.dotColor }}
          />
          <span className={styles.ageText}>{dataAge.text}</span>
          {dataAge.shouldWarn && (
            <Icon name="warning" size={12} className={styles.warningIcon} />
          )}
        </div>

        {/* Expanded State - Additional Details */}
        {isExpanded && (
          <div
            id={`property-details-${property.id}`}
            className={styles.expandedContent}
          >
            {/* Assessed Value with Differential */}
            {property.assessed_value && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Assessed Value</span>
                <div className={styles.detailValueWithBadge}>
                  <span className={styles.detailValue}>
                    {formatCurrency(property.assessed_value)}
                  </span>
                  {valueDiff && (
                    <Badge
                      variant={valueDiff.variant}
                      size="sm"
                      className={styles.diffBadge}
                    >
                      {valueDiff.icon} {valueDiff.percentage.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Geographic ID */}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Geographic ID</span>
              <div className={styles.detailValueWithAction}>
                <span className={`${styles.detailValue} ${styles.mono}`}>
                  {property.geo_id || 'N/A'}
                </span>
                {property.geo_id && (
                  <button
                    className={styles.copyButton}
                    onClick={(e) => handleCopyId(property.geo_id!, 'geo_id', e)}
                    aria-label="Copy geographic ID"
                    title="Copy to clipboard"
                  >
                    <Icon name="copy" size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Legal Description */}
            <div className={styles.descriptionSection}>
              <span className={styles.descriptionLabel}>Legal Description</span>
              <p className={styles.descriptionText}>
                {truncateText(property.description, 100)}
              </p>
            </div>

            {/* Data Timeline */}
            <div className={styles.timelineSection}>
              <span className={styles.timelineLabel}>Data Timeline</span>
              <div className={styles.timelineItems}>
                <div className={styles.timelineItem}>
                  <Icon name="clock" size={12} />
                  <span>Scraped: {formatTimestamp(property.scraped_at)}</span>
                </div>
                <div className={styles.timelineItem}>
                  <Icon name="refresh" size={12} />
                  <span>Updated: {formatTimestamp(property.updated_at)}</span>
                </div>
                <div className={styles.timelineItem}>
                  <Icon name="calendar" size={12} />
                  <span>Created: {formatTimestamp(property.created_at, false)}</span>
                </div>
              </div>
            </div>

            {/* Discovery Context */}
            {property.search_term && (
              <div className={styles.discoverySection}>
                <Icon name="search" size={12} />
                <span className={styles.discoveryText}>
                  Found via: "{property.search_term}"
                </span>
              </div>
            )}
          </div>
        )}
      </CardBody>

      {/* Card Footer - Expansion Toggle */}
      <CardFooter className={styles.footer}>
        <button
          className={styles.expandButton}
          onClick={handleCardClick}
          aria-label={isExpanded ? 'Hide details' : 'Show details'}
        >
          <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} />
          <span>{isExpanded ? 'Hide Details' : 'Show Details'}</span>
        </button>
      </CardFooter>
    </Card>
  );
};
```

---

## 5. CSS Styles

### Updated PropertyCard.module.css

```css
/* Base Card Styles */
.card {
  height: auto;
  min-height: 280px;
  transition: all 0.3s ease;
  cursor: pointer;
  position: relative;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card:focus-visible {
  outline: 2px solid var(--primary-500, #3b82f6);
  outline-offset: 2px;
}

.card.expanded {
  min-height: 480px;
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

/* Header Section */
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.owner {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--neutral-900, #111827);
  margin: 0;
  flex: 1;
  line-height: 1.4;
}

/* Address Section */
.address {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--neutral-600, #4b5563);
  margin-bottom: 1rem;
}

/* Details Section */
.details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.detailItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--neutral-100, #f3f4f6);
}

.detailItem:last-child {
  border-bottom: none;
}

.detailLabel {
  font-size: 0.875rem;
  color: var(--neutral-600, #4b5563);
}

.detailValue {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--neutral-900, #111827);
}

.detailValueWithAction {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.detailValueWithBadge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mono {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
  font-size: 0.8125rem;
}

/* Copy Button */
.copyButton {
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  color: var(--neutral-500, #6b7280);
  transition: color 0.2s ease;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copyButton:hover {
  color: var(--primary-600, #2563eb);
  background-color: var(--neutral-100, #f3f4f6);
}

.copyButton:active {
  color: var(--primary-700, #1d4ed8);
}

/* Data Age Indicator */
.dataAge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--neutral-50, #f9fafb);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--neutral-600, #4b5563);
}

.ageDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ageText {
  flex: 1;
}

.warningIcon {
  color: var(--warning-500, #f59e0b);
}

/* Expanded Content */
.expandedContent {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid var(--neutral-200, #e5e7eb);
  animation: expandIn 0.3s ease-out;
}

@keyframes expandIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Value Differential Badge */
.diffBadge {
  font-size: 0.75rem;
  font-weight: 600;
}

/* Description Section */
.descriptionSection {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: var(--neutral-50, #f9fafb);
  border-radius: 6px;
}

.descriptionLabel {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--neutral-700, #374151);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.descriptionText {
  font-size: 0.8125rem;
  color: var(--neutral-700, #374151);
  line-height: 1.5;
  margin: 0;
}

/* Timeline Section */
.timelineSection {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
}

.timelineLabel {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--neutral-700, #374151);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.timelineItems {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.timelineItem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--neutral-600, #4b5563);
}

/* Discovery Section */
.discoverySection {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--primary-50, #eff6ff);
  border-left: 3px solid var(--primary-400, #60a5fa);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--neutral-700, #374151);
}

.discoveryText {
  font-style: italic;
}

/* Footer */
.footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--neutral-100, #f3f4f6);
}

.expandButton {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: none;
  border: none;
  color: var(--primary-600, #2563eb);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}

.expandButton:hover {
  background-color: var(--primary-50, #eff6ff);
}

.expandButton:active {
  background-color: var(--primary-100, #dbeafe);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .card.expanded {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    min-height: 100vh;
    margin: 0;
    border-radius: 0;
    z-index: 1000;
    overflow-y: auto;
  }

  .detailItem {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  .card,
  .expandedContent {
    animation: none;
    transition: none;
  }
}
```

---

## 6. Analytics Integration

### Add New Hook Methods

**File:** `/home/aledlie/tcad-scraper/src/hooks/useAnalytics.ts`

```typescript
// Add to existing useAnalytics hook

export const useAnalytics = () => {
  // ... existing methods

  const logCardExpanded = (
    propertyId: string,
    source: 'click' | 'hover' | 'keyboard'
  ) => {
    trackEvent('card_expanded', {
      property_id: propertyId,
      expansion_source: source,
      timestamp: Date.now()
    });
  };

  const logCardCollapsed = (
    propertyId: string,
    timeExpanded: number
  ) => {
    trackEvent('card_collapsed', {
      property_id: propertyId,
      time_expanded_ms: timeExpanded,
      timestamp: Date.now()
    });
  };

  const logFieldCopied = (
    propertyId: string,
    fieldName: 'property_id' | 'geo_id'
  ) => {
    trackEvent('field_copied', {
      property_id: propertyId,
      field_name: fieldName,
      timestamp: Date.now()
    });
  };

  return {
    // ... existing exports
    logCardExpanded,
    logCardCollapsed,
    logFieldCopied
  };
};
```

---

## 7. Testing Requirements

### Unit Tests
**File:** `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PropertyCard } from './PropertyCard';
import { Property } from '../../../types';

const mockProperty: Property = {
  id: 'test-id',
  property_id: 'R123456',
  name: 'John Smith',
  prop_type: 'REAL ESTATE',
  city: 'Austin',
  property_address: '123 Oak St',
  assessed_value: 425000,
  appraised_value: 450000,
  geo_id: 'GEO789',
  description: 'LOT 5 BLK A, OAKWOOD ESTATES',
  search_term: 'Oak St',
  scraped_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  created_at: new Date('2025-09-15').toISOString(),
  updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
};

describe('PropertyCard', () => {
  describe('Collapsed State', () => {
    it('renders basic property information', () => {
      render(<PropertyCard property={mockProperty} />);

      expect(screen.getByText('John Smith')).toBeInTheDocument();
      expect(screen.getByText('REAL ESTATE')).toBeInTheDocument();
      expect(screen.getByText(/123 Oak St/)).toBeInTheDocument();
      expect(screen.getByText(/450,000/)).toBeInTheDocument();
      expect(screen.getByText('R123456')).toBeInTheDocument();
    });

    it('displays data freshness indicator', () => {
      render(<PropertyCard property={mockProperty} />);

      expect(screen.getByText('Updated 2d ago')).toBeInTheDocument();
    });

    it('shows "Show Details" button when collapsed', () => {
      render(<PropertyCard property={mockProperty} />);

      expect(screen.getByText('Show Details')).toBeInTheDocument();
    });
  });

  describe('Expanded State', () => {
    it('expands when card is clicked', async () => {
      render(<PropertyCard property={mockProperty} />);

      const card = screen.getByRole('button', { name: /Show details/i });
      fireEvent.click(card);

      await waitFor(() => {
        expect(screen.getByText('Hide Details')).toBeInTheDocument();
      });
    });

    it('displays assessed value with differential', async () => {
      render(<PropertyCard property={mockProperty} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/425,000/)).toBeInTheDocument();
        expect(screen.getByText(/-5\.6%/)).toBeInTheDocument();
      });
    });

    it('displays geographic ID', async () => {
      render(<PropertyCard property={mockProperty} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText('GEO789')).toBeInTheDocument();
      });
    });

    it('displays legal description', async () => {
      render(<PropertyCard property={mockProperty} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/LOT 5 BLK A/)).toBeInTheDocument();
      });
    });

    it('displays timestamps', async () => {
      render(<PropertyCard property={mockProperty} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(screen.getByText(/Scraped:/)).toBeInTheDocument();
        expect(screen.getByText(/Updated:/)).toBeInTheDocument();
        expect(screen.getByText(/Created:/)).toBeInTheDocument();
      });
    });
  });

  describe('Copy Functionality', () => {
    it('copies property ID to clipboard', async () => {
      const mockClipboard = {
        writeText: jest.fn(() => Promise.resolve())
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(<PropertyCard property={mockProperty} />);

      const copyButtons = screen.getAllByTitle('Copy to clipboard');
      fireEvent.click(copyButtons[0]);

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('R123456');
      });
    });

    it('stops propagation on copy button click', async () => {
      const onExpand = jest.fn();
      render(<PropertyCard property={mockProperty} onExpand={onExpand} />);

      const copyButton = screen.getAllByTitle('Copy to clipboard')[0];
      fireEvent.click(copyButton);

      expect(onExpand).not.toHaveBeenCalled();
    });
  });

  describe('Analytics', () => {
    it('calls onExpand callback when expanded', async () => {
      const onExpand = jest.fn();
      render(<PropertyCard property={mockProperty} onExpand={onExpand} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onExpand).toHaveBeenCalledWith('R123456');
      });
    });

    it('calls onCollapse callback when collapsed', async () => {
      const onCollapse = jest.fn();
      render(<PropertyCard property={mockProperty} defaultExpanded onCollapse={onCollapse} />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() => {
        expect(onCollapse).toHaveBeenCalledWith('R123456');
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<PropertyCard property={mockProperty} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('aria-expanded', 'false');
      expect(card).toHaveAttribute('aria-controls');
    });

    it('can be expanded with keyboard', async () => {
      render(<PropertyCard property={mockProperty} />);

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: 'Enter' });

      await waitFor(() => {
        expect(card).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });
});
```

### Manual QA Checklist

- [ ] Card expands/collapses smoothly on click
- [ ] All 6 new fields visible when expanded
- [ ] Value differential calculates correctly (<-10%, >+10%, market rate)
- [ ] Data age indicator shows correct color (green/yellow/red)
- [ ] Copy buttons work for property_id and geo_id
- [ ] "N/A" shown for null geo_id
- [ ] Legal description truncated at 100 characters
- [ ] Timestamps display relative dates
- [ ] search_term shown in discovery section
- [ ] Mobile: Full-screen expansion works
- [ ] Keyboard: Tab, Enter, Escape work correctly
- [ ] Screen reader: ARIA attributes announced properly
- [ ] Analytics: Events fire for expand/collapse/copy
- [ ] Performance: Renders in <100ms
- [ ] Animation: Smooth 300ms expansion

---

## 8. Performance Considerations

### Optimization Strategies

1. **React.memo for PropertyCard**
   - Prevent re-renders when props haven't changed
   - Especially important with 100+ cards in results

2. **useMemo for Calculations**
   - Memoize value differential calculation
   - Memoize data age calculation

3. **Lazy Rendering (Future)**
   - If results exceed 50 cards, implement virtual scrolling
   - Use react-window or react-virtualized

4. **CSS GPU Acceleration**
   - Use `transform` instead of `height` for animations
   - Already implemented with `translateY` on hover

5. **Debounce Copy Feedback**
   - If adding toast notification, debounce to prevent spam

---

## 9. Acceptance Criteria

### Phase 1 Complete When:

- [ ] Cards expand/collapse with smooth animation
- [ ] 6 new fields visible in expanded state
- [ ] Value differential badge displays correctly
- [ ] Data freshness indicator always visible
- [ ] Copy buttons functional for IDs
- [ ] Mobile full-screen modal works
- [ ] Keyboard navigation fully functional
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] All analytics events firing
- [ ] Unit tests passing (>80% coverage)
- [ ] Manual QA checklist complete
- [ ] No console errors or warnings
- [ ] Performance: <100ms render time
- [ ] Cross-browser tested (Chrome, Firefox, Safari)
- [ ] Responsive on mobile, tablet, desktop

---

## 10. Deployment Plan

### Development Workflow

1. **Feature Branch**
   ```bash
   git checkout -b feature/property-card-expansion
   ```

2. **Implementation**
   - Create utility functions in `propertyCalculations.ts`
   - Update PropertyCard component
   - Update CSS module
   - Add analytics hooks

3. **Testing**
   - Write unit tests
   - Run test suite
   - Manual QA on local dev

4. **Code Review**
   - PR to `main` branch
   - Minimum 1 approval required
   - Address feedback

5. **Staging Deploy**
   - Merge to `main`
   - Deploy to staging environment
   - Smoke test on staging

6. **Production Deploy**
   - Monitor error logs
   - Check analytics events firing
   - A/B test configuration (20% of users)

### Rollback Plan

If critical issues arise:
1. Revert commit in main branch
2. Redeploy previous version
3. Investigate issue in development
4. Fix and re-deploy

---

## 11. Next Phase Preview

### Phase 2: Enhancements (Week 2)

- Toast notifications for copy actions
- Hover tooltips for quick preview (desktop)
- "Read more" expansion for long legal descriptions
- Improved mobile gestures (swipe to dismiss)

### Phase 3: Comparison Mode (Week 3-4)

- "Compare" button in expanded state
- Comparison state management
- Sticky comparison bar
- Side-by-side comparison table
- CSV export functionality

---

## 12. Questions & Support

### Common Questions

**Q: What if geo_id is null for most properties?**
A: Show "N/A" and don't render copy button. We may hide the field entirely if >80% null.

**Q: How long should legal descriptions be?**
A: Truncate at 100 chars with "..." in Phase 1. Phase 2 adds "Read more" expansion.

**Q: Should expansion state persist across sessions?**
A: Not in Phase 1. Possible future enhancement with localStorage.

**Q: Mobile full-screen blocking scroll?**
A: Yes, expanded card becomes modal overlay with body scroll lock.

---

## Quick Reference

**Files to Create:**
- `/home/aledlie/tcad-scraper/src/utils/propertyCalculations.ts`
- `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.test.tsx`

**Files to Modify:**
- `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.tsx`
- `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.module.css`
- `/home/aledlie/tcad-scraper/src/hooks/useAnalytics.ts`

**Dependencies (Already Installed):**
- React 19.2
- TypeScript
- CSS Modules
- Analytics hooks (already in project)

**Estimated Timeline:**
- Development: 2-3 days
- Testing: 1 day
- Code Review: 0.5 day
- Deployment: 0.5 day
- **Total: 4-5 days**

---

**Document Owner:** Development Team
**Last Updated:** November 8, 2025
**Status:** Ready for Sprint Planning
