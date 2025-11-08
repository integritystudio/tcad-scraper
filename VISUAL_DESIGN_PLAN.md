# Visual Design Plan: Extended Property Card UI

## Executive Summary

This document outlines a modular, progressive disclosure approach to displaying additional property details while maintaining visual clarity and code maintainability. The recommended solution uses **expandable cards with internal sections** for optimal modularity and user experience.

---

## 1. Visual Information Hierarchy

### Priority Tiers

```
TIER 1 - MUST SEE (Always Visible)
├── Owner Name (Primary identifier)
├── Property Type Badge (Category)
├── Address + City (Location)
└── Appraised Value (Key financial)

TIER 2 - SHOULD SEE (Expand to reveal)
├── Financial Comparison
│   ├── Appraised Value (repeated with context)
│   ├── Assessed Value
│   └── Value Difference/Ratio
├── Property Identifiers
│   ├── Property ID
│   └── Geo ID (if available)
└── Additional Context
    └── Description (if available)

TIER 3 - NICE TO HAVE (Secondary expansion or tooltip)
├── Temporal Data
│   ├── Last Scraped
│   ├── Last Updated
│   └── Data Freshness Indicator
└── Technical Metadata
    └── Search Term (debug/context)
```

### Visual Weight Distribution

```
Font Weight Guide:
- Owner Name: 600 (semi-bold) - Primary attention
- Values: 600 (semi-bold) - Decision-making data
- Labels: 400 (regular) - Supporting context
- Metadata: 400 (regular) - Background info

Font Size Guide:
- Owner Name: 18px (1.125rem) - Headline
- Financial Values: 16px (1rem) - Key data
- Labels: 14px (0.875rem) - Standard
- Metadata: 12px (0.75rem) - Diminished
```

---

## 2. Layout Options Analysis

### OPTION A: Expandable Card (RECOMMENDED)

```
┌─────────────────────────────────────────────────┐
│ John Smith                        [RESIDENTIAL] │  ← TIER 1
│                                                 │
│ 📍 123 Main Street, Austin                     │
│                                                 │
│ Appraised Value          $450,000              │
│ Property ID              R123456         [▼]   │  ← Expand button
└─────────────────────────────────────────────────┘

COLLAPSED STATE (Default)
- 4 lines of content
- Quick scan across multiple properties
- Clear expand affordance


┌─────────────────────────────────────────────────┐
│ John Smith                        [RESIDENTIAL] │
│                                                 │
│ 📍 123 Main Street, Austin                     │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 💰 FINANCIAL BREAKDOWN               [▲]    │ │  ← TIER 2
│ ├─────────────────────────────────────────────┤ │
│ │ Appraised Value          $450,000           │ │
│ │ Assessed Value           $435,000           │ │
│ │ Difference               -$15,000 (-3.3%)   │ │  ← Calculated insight
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔍 IDENTIFIERS                              │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Property ID    R123456                      │ │
│ │ Geo ID         GEO789                       │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📝 DESCRIPTION                              │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Single family residence, built 1995...      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🕐 METADATA                          [...]  │ │  ← TIER 3
│ └─────────────────────────────────────────────┘ │  ← Tooltip or nested expand
└─────────────────────────────────────────────────┘

EXPANDED STATE
- Sectioned layout with visual grouping
- Collapsible sections for progressive disclosure
- Maintains card-based grid layout
```

**Pros:**
- Maintains spatial consistency in grid
- Progressive disclosure without navigation
- Easy to scan multiple properties
- Familiar interaction pattern

**Cons:**
- Long cards when expanded
- Mobile scrolling overhead

---

### OPTION B: Side Drawer Detail Panel

```
GRID VIEW                          DETAIL DRAWER
┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐
│ Property 1   │ │ Property 2   │ │ John Smith      [✕]  │
│              │ │              │ │ [RESIDENTIAL]        │
│ $450,000     │ │ $380,000     │ │                      │
│       [View] │ │       [View] │ │ 📍 123 Main St       │
└──────────────┘ └──────────────┘ │                      │
┌──────────────┐ ┌──────────────┐ │ 💰 FINANCIAL         │
│ Property 3   │ │ Property 4   │ │ Appraised: $450k     │
│              │ │              │ │ Assessed:  $435k     │
│ $520,000     │ │ $290,000     │ │                      │
│       [View] │ │       [View] │ │ 🔍 IDENTIFIERS       │
└──────────────┘ └──────────────┘ │ Property ID: R123    │
                                  │                      │
                                  │ 📝 DESCRIPTION       │
                                  │ Single family...     │
                                  │                      │
                                  │ 🕐 METADATA          │
                                  │ Updated: 2 days ago  │
                                  └──────────────────────┘
```

**Pros:**
- Dedicated space for details
- Keeps grid compact and scannable
- Good for comparing properties
- Desktop-optimized

**Cons:**
- Requires click to see details
- Less mobile-friendly
- Additional state management complexity

---

### OPTION C: Modal Overlay

```
GRID VIEW (with overlay trigger)

┌─────────────────────────────────────────────────┐
│ John Smith                        [RESIDENTIAL] │
│ 📍 123 Main Street, Austin                     │
│ Appraised Value          $450,000       [View] │
└─────────────────────────────────────────────────┘
                    ↓ CLICK
        ┌───────────────────────────────────────┐
        │ ╔═══════════════════════════════════╗ │
        │ ║  Property Details            [✕]  ║ │
        │ ╠═══════════════════════════════════╣ │
        │ ║  John Smith    [RESIDENTIAL]      ║ │
        │ ║  📍 123 Main Street, Austin       ║ │
        │ ║                                   ║ │
        │ ║  💰 FINANCIAL BREAKDOWN           ║ │
        │ ║  Appraised Value    $450,000      ║ │
        │ ║  Assessed Value     $435,000      ║ │
        │ ║  Difference         -$15,000      ║ │
        │ ║                                   ║ │
        │ ║  🔍 IDENTIFIERS                   ║ │
        │ ║  Property ID    R123456           ║ │
        │ ║  Geo ID         GEO789            ║ │
        │ ║                                   ║ │
        │ ║  [View on Map] [Export Details]   ║ │
        │ ╚═══════════════════════════════════╝ │
        └───────────────────────────────────────┘
```

**Pros:**
- Maximum detail space
- Can include rich interactions (maps, charts)
- Good for deep dives

**Cons:**
- Interrupts browsing flow
- Highest interaction cost
- Overkill for simple data

---

## 3. Recommended Component Architecture

### Component Hierarchy

```
PropertyCard (Container)
├── CardHeader (existing)
│   ├── PropertyOwner (text)
│   └── PropertyTypeBadge (Badge component)
├── CardBody (existing)
│   ├── PropertyAddress (Icon + text)
│   ├── PropertySummary (collapsed state)
│   │   ├── AppraisedValue (formatted currency)
│   │   └── ExpandButton (toggle)
│   └── PropertyDetails (expanded state) *NEW*
│       ├── FinancialSection *NEW*
│       │   ├── SectionHeader (icon + title + collapse)
│       │   ├── ValueComparison *NEW*
│       │   │   ├── ValueItem (label + value)
│       │   │   ├── ValueItem
│       │   │   └── ValueDifference *NEW* (calculated, styled)
│       │   └── optional: MiniChart *FUTURE*
│       ├── IdentifiersSection *NEW*
│       │   ├── SectionHeader
│       │   └── IdentifierList *NEW*
│       │       ├── IdentifierItem (mono font)
│       │       └── CopyButton *FUTURE*
│       ├── DescriptionSection *NEW*
│       │   ├── SectionHeader
│       │   └── TruncatedText *NEW* (show more/less)
│       └── MetadataSection *NEW*
│           ├── SectionHeader
│           └── TimestampList *NEW*
│               ├── RelativeTime *NEW* (e.g., "2 days ago")
│               └── FreshnessIndicator *NEW* (color-coded)
└── CardFooter (optional) *FUTURE*
    └── ActionButtons (View Map, Export, etc.)
```

### New Component Specifications

#### 1. **PropertyDetails** (Expanded Content Container)

```typescript
interface PropertyDetailsProps {
  property: Property;
  isExpanded: boolean;
  sections?: ('financial' | 'identifiers' | 'description' | 'metadata')[];
}

// Usage:
<PropertyDetails
  property={property}
  isExpanded={isExpanded}
  sections={['financial', 'identifiers', 'description']}
/>
```

**Responsibilities:**
- Manages expanded state rendering
- Orchestrates section components
- Handles section visibility configuration

---

#### 2. **FinancialSection**

```typescript
interface FinancialSectionProps {
  appraisedValue: number;
  assessedValue: number | null;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
}

// Internal calculation:
const valueDifference = assessedValue
  ? appraisedValue - assessedValue
  : null;
const differencePercent = valueDifference && assessedValue
  ? (valueDifference / assessedValue) * 100
  : null;
```

**Visual Features:**
- Value difference with color coding:
  - Green: Assessed > Appraised (better for tax)
  - Red: Assessed < Appraised (check for discrepancy)
  - Neutral: Same or no assessed value
- Optional bar chart visualization
- Collapsible section with persist state

---

#### 3. **ValueComparison** (Financial Data Display)

```typescript
interface ValueComparisonProps {
  appraisedValue: number;
  assessedValue: number | null;
  showDifference?: boolean;
  showChart?: boolean;
}
```

**Layout:**
```
┌───────────────────────────────────────────┐
│ Appraised Value           $450,000        │
│ Assessed Value            $435,000        │
│ ═══════════════════════════════════════   │
│ Difference      -$15,000  (-3.3%)  🔻    │  ← Color coded
│                                           │
│ [Optional: Mini bar comparison chart]    │
│ ████████████████████████████████ 100%    │  ← Appraised
│ ███████████████████████████████  96.7%   │  ← Assessed
└───────────────────────────────────────────┘
```

---

#### 4. **ExpandButton** (Interaction Component)

```typescript
interface ExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  label?: string;
  iconOnly?: boolean;
}
```

**States:**
- Collapsed: "Show Details" + Down chevron
- Expanded: "Hide Details" + Up chevron
- Animated rotation: 180deg transition (0.3s ease)

**Visual Specs:**
- Size: 32px x 32px (touch-friendly)
- Icon: Chevron (existing Icon component)
- Position: Right-aligned in summary row
- Hover: Background color change
- Active: Scale down slightly (0.95)

---

#### 5. **SectionHeader** (Reusable Section Component)

```typescript
interface SectionHeaderProps {
  icon: IconName;
  title: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  badge?: ReactNode; // Optional count or status badge
}
```

**Layout:**
```
┌─────────────────────────────────────────┐
│ 💰 FINANCIAL BREAKDOWN         [▼]      │  ← Collapsible
├─────────────────────────────────────────┤
│ [Section content...]                    │
└─────────────────────────────────────────┘

Or:

┌─────────────────────────────────────────┐
│ 🔍 IDENTIFIERS                          │  ← Non-collapsible
├─────────────────────────────────────────┤
│ [Section content...]                    │
└─────────────────────────────────────────┘
```

---

#### 6. **TruncatedText** (Description Handler)

```typescript
interface TruncatedTextProps {
  text: string | null;
  maxLength?: number; // Default: 150 chars
  expandLabel?: string; // Default: "Show more"
  collapseLabel?: string; // Default: "Show less"
}
```

**Behavior:**
- Show first `maxLength` characters + "..." when collapsed
- Expand inline on click
- Smooth height transition (max-height animation)

---

#### 7. **TimestampList** (Metadata Display)

```typescript
interface TimestampListProps {
  scrapedAt: string;
  updatedAt: string;
  createdAt?: string;
  showRelative?: boolean; // "2 days ago" vs "2025-01-15"
}
```

**Visual Treatment:**
```
┌─────────────────────────────────────────┐
│ 🕐 DATA FRESHNESS                       │
├─────────────────────────────────────────┤
│ Last Scraped     2 days ago    🟢       │  ← Fresh
│ Last Updated     2 days ago             │
│ Created          Jan 15, 2025           │
└─────────────────────────────────────────┘

Freshness Indicators:
🟢 Green: < 7 days (Fresh)
🟡 Yellow: 7-30 days (Aging)
🔴 Red: > 30 days (Stale)
```

---

#### 8. **FreshnessIndicator** (Data Quality Signal)

```typescript
interface FreshnessIndicatorProps {
  timestamp: string;
  thresholds?: {
    fresh: number;  // Default: 7 days
    aging: number;  // Default: 30 days
  };
}
```

**Visual Options:**
- Option A: Colored dot (🟢🟡🔴)
- Option B: Text badge ("Fresh", "Aging", "Stale")
- Option C: Progress bar showing days until stale

---

## 4. Visual Design Tokens

### Color Palette Extensions

```css
/* Financial Colors */
--financial-positive: #10b981; /* Green-500 - assessed > appraised */
--financial-negative: #ef4444; /* Red-500 - assessed < appraised */
--financial-neutral: #6b7280;  /* Gray-500 - no difference */
--financial-bg-positive: #d1fae5; /* Green-100 */
--financial-bg-negative: #fee2e2; /* Red-100 */

/* Section Colors */
--section-border: #e5e7eb;      /* Gray-200 */
--section-bg: #f9fafb;          /* Gray-50 - subtle background */
--section-hover: #f3f4f6;       /* Gray-100 */

/* Status Colors (Freshness) */
--status-fresh: #10b981;        /* Green-500 */
--status-aging: #f59e0b;        /* Amber-500 */
--status-stale: #ef4444;        /* Red-500 */

/* Interactive Elements */
--expand-hover: #f3f4f6;        /* Gray-100 */
--expand-active: #e5e7eb;       /* Gray-200 */
```

### Typography Scale

```css
/* Existing (maintain consistency) */
--font-size-owner: 1.125rem;    /* 18px - Existing */
--font-size-value: 0.875rem;    /* 14px - Existing */
--font-size-label: 0.875rem;    /* 14px - Existing */

/* New additions */
--font-size-section-title: 0.8125rem; /* 13px - Section headers */
--font-size-metadata: 0.75rem;  /* 12px - Timestamps */
--font-size-caption: 0.6875rem; /* 11px - Helper text */

/* Font weights */
--font-weight-owner: 600;       /* Semi-bold */
--font-weight-value: 600;       /* Semi-bold */
--font-weight-section: 500;     /* Medium */
--font-weight-label: 400;       /* Regular */
--font-weight-metadata: 400;    /* Regular */
```

### Spacing Scale (Maintain existing + additions)

```css
/* Existing */
--spacing-xs: 0.25rem;   /* 4px */
--spacing-sm: 0.5rem;    /* 8px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.5rem;    /* 24px */
--spacing-xl: 2rem;      /* 32px */

/* Section-specific */
--section-padding: 0.75rem;     /* 12px - Internal padding */
--section-gap: 1rem;            /* 16px - Between sections */
--detail-item-gap: 0.5rem;      /* 8px - Between detail rows */
```

### Transitions

```css
/* Expansion animations */
--transition-expand: max-height 0.3s ease-in-out, opacity 0.3s ease;
--transition-rotate: transform 0.3s ease;
--transition-color: background-color 0.2s ease, color 0.2s ease;

/* Hover states */
--transition-hover: all 0.2s ease;
```

### Border Radius (Maintain consistency)

```css
--radius-card: 0.5rem;        /* 8px - Main card */
--radius-section: 0.375rem;   /* 6px - Sections */
--radius-button: 0.25rem;     /* 4px - Buttons */
```

### Shadows (For section depth)

```css
--shadow-section: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-section-hover: 0 1px 3px rgba(0, 0, 0, 0.1);
```

---

## 5. Data Visualization Concepts

### Financial Value Comparison

**Option 1: Side-by-Side Bars**
```
Appraised  ████████████████████████████████  $450,000
Assessed   ███████████████████████████████   $435,000
           ↑
       Difference: -$15,000 (-3.3%)
```

**Option 2: Stacked Indicator**
```
┌──────────────────────────────────────────┐
│ Appraised Value          $450,000        │
├──────────────────────────────────────────┤
│ █████████████████████████████████████    │  ← 100% bar
│ ████████████████████████████████         │  ← 96.7% (assessed)
│                                          │
│ Assessed is 3.3% lower than appraised   │
└──────────────────────────────────────────┘
```

**Option 3: Delta Badge (Minimal)**
```
Appraised Value     $450,000
Assessed Value      $435,000  [-$15k | -3.3%] 🔻
```

**Recommendation:** Start with Option 3 (minimal) for Phase 1, add Option 2 (visual bars) in Phase 2.

---

### Geographic Data Visualization (Future Enhancement)

**When geo_id is available:**
```
┌─────────────────────────────────────────┐
│ 🗺️  LOCATION                            │
├─────────────────────────────────────────┤
│ 📍 123 Main Street, Austin              │
│ 🔗 Geo ID: GEO789                       │
│                                         │
│ [Mini map thumbnail]                    │
│ ┌─────────────────────┐                │
│ │     •               │                │
│ │   ╱   ╲             │                │
│ │ [  •  ] ← Property  │                │
│ │   ╲   ╱             │                │
│ │     •               │                │
│ └─────────────────────┘                │
│                                         │
│ [View Full Map] [Get Directions]       │
└─────────────────────────────────────────┘
```

**Integration:** Leaflet.js or Mapbox GL for interactive maps

---

### Temporal Data Visualization

**Option 1: Timeline (for properties with history)**
```
┌─────────────────────────────────────────┐
│ 📊 PROPERTY TIMELINE                    │
├─────────────────────────────────────────┤
│                                         │
│ Created ─────────●─────────●────────●  │
│         Jan 2020   Scraped  Updated    │
│                    Jan 2025  2 days ago│
│                                         │
│ ⚡ Last activity: 2 days ago           │
└─────────────────────────────────────────┘
```

**Option 2: Freshness Gauge**
```
┌─────────────────────────────────────────┐
│ 🕐 DATA FRESHNESS                       │
├─────────────────────────────────────────┤
│                                         │
│     Fresh  ●━━━━━━━━━━━━━━○  Stale     │
│            ↑                            │
│          2 days                         │
│                                         │
│ Last scraped: Jan 15, 2025             │
│ Updates daily at 2:00 AM               │
└─────────────────────────────────────────┘
```

---

### Search Term Context (Debug View)

```
┌─────────────────────────────────────────┐
│ 🔍 SEARCH CONTEXT                       │
├─────────────────────────────────────────┤
│ Found via: "Austin residential homes"  │
│                                         │
│ Related searches:                       │
│ • Austin homes near downtown           │
│ • Residential properties under 500k    │
└─────────────────────────────────────────┘
```

**Use Case:** Developer mode or admin interface only.

---

## 6. State Management & Interaction Patterns

### Expand/Collapse States

```typescript
// Local state for individual card
const [isExpanded, setIsExpanded] = useState(false);

// Persisted state (optional - remember user preference)
const [expandedSections, setExpandedSections] = useLocalStorage(
  'property-card-sections',
  {
    financial: true,
    identifiers: false,
    description: false,
    metadata: false,
  }
);
```

### Loading States

**Scenario:** Additional data loaded on expansion

```
┌─────────────────────────────────────────┐
│ 💰 FINANCIAL BREAKDOWN          [▲]    │
├─────────────────────────────────────────┤
│                                         │
│   ⏳ Loading financial details...       │
│   [Progress spinner]                    │
│                                         │
└─────────────────────────────────────────┘

After load:
┌─────────────────────────────────────────┐
│ 💰 FINANCIAL BREAKDOWN          [▲]    │
├─────────────────────────────────────────┤
│ Appraised Value          $450,000       │
│ Assessed Value           $435,000       │
│ Difference               -$15,000       │
└─────────────────────────────────────────┘
```

**Implementation:**
```typescript
<FinancialSection
  isLoading={isLoadingFinancials}
  data={financialData}
  skeleton={<DetailSkeleton rows={3} />}
/>
```

---

### Empty/Null States

**Missing Description:**
```
┌─────────────────────────────────────────┐
│ 📝 DESCRIPTION                          │
├─────────────────────────────────────────┤
│ No description available                │
│ [Request Description Update]            │
└─────────────────────────────────────────┘
```

**Missing Geo ID:**
```
┌─────────────────────────────────────────┐
│ 🔍 IDENTIFIERS                          │
├─────────────────────────────────────────┤
│ Property ID    R123456                  │
│ Geo ID         Not available            │
└─────────────────────────────────────────┘
```

**Pattern:** Use neutral gray text, optional action to report/update.

---

### Interactive Element States

**ExpandButton States:**
```css
/* Default */
.expandButton {
  background: transparent;
  border: 1px solid var(--section-border);
}

/* Hover */
.expandButton:hover {
  background: var(--expand-hover);
  border-color: var(--neutral-300);
}

/* Active/Pressed */
.expandButton:active {
  background: var(--expand-active);
  transform: scale(0.95);
}

/* Expanded state */
.expandButton.expanded {
  /* Icon rotates 180deg */
  svg {
    transform: rotate(180deg);
  }
}
```

---

## 7. Responsive Design Considerations

### Mobile (< 640px)

```
┌───────────────────────┐
│ John Smith      [RES] │  ← Compact header
│                       │
│ 📍 123 Main St        │
│                       │
│ $450,000       [▼]    │  ← Simplified summary
└───────────────────────┘

Expanded (full width):
┌───────────────────────┐
│ John Smith      [RES] │
│ 📍 123 Main St        │
│                       │
│ 💰 FINANCIAL    [▲]   │
│ Appraised: $450k      │  ← Abbreviated values
│ Assessed:  $435k      │
│                       │
│ 🔍 IDs          [▼]   │
│ [collapsed]           │
│                       │
│ [View Full Details]   │  ← Link to modal on mobile
└───────────────────────┘
```

**Mobile-Specific Adjustments:**
- Stack values vertically
- Abbreviate large numbers (450k vs $450,000)
- Collapsible sections default to collapsed
- Full-screen modal for deep dive (Option C)
- Larger touch targets (44px minimum)

---

### Tablet (640px - 1024px)

```
┌──────────────────────────────┐
│ John Smith       [RESIDENTIAL]│
│                               │
│ 📍 123 Main Street, Austin   │
│                               │
│ Appraised: $450,000    [▼]   │
└──────────────────────────────┘

Expanded (2-column sections):
┌──────────────────────────────┐
│ 💰 FINANCIAL    │ 🔍 IDs      │  ← Side by side
│ Appraised: $450k│ Prop: R123  │
│ Assessed:  $435k│ Geo: GEO789 │
└──────────────────────────────┘
```

---

### Desktop (> 1024px)

```
Full expandable card with all sections visible
Hover states more prominent
Optional: Side-by-side comparison mode
```

---

## 8. Animation & Transitions

### Expand Animation Sequence

```
Phase 1: Button Click (0ms)
├── Button scale down to 0.95
└── Icon rotation starts (0° → 180°)

Phase 2: Content Reveal (50ms)
├── Max-height expands from 0 to auto
├── Opacity fades in from 0 to 1
└── Padding expands from 0 to target

Phase 3: Completion (300ms)
├── Button scale returns to 1.0
└── Icon rotation completes at 180°
```

**CSS Implementation:**
```css
.propertyDetails {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  transition:
    max-height 0.3s ease-in-out,
    opacity 0.3s ease,
    padding 0.3s ease;
}

.propertyDetails.expanded {
  max-height: 1000px; /* Large enough for content */
  opacity: 1;
  padding: 1rem;
}
```

---

### Section Collapse Animation

```css
.section {
  transition: max-height 0.3s ease-in-out;
}

.sectionContent {
  overflow: hidden;
}

.sectionContent.collapsed {
  max-height: 0;
  opacity: 0;
}

.sectionContent.expanded {
  max-height: 500px;
  opacity: 1;
}
```

---

### Hover Micro-interactions

```css
/* Section hover */
.section:hover {
  background: var(--section-hover);
  box-shadow: var(--shadow-section-hover);
  transition: all 0.2s ease;
}

/* Value item highlight on hover */
.detailItem:hover .detailValue {
  color: var(--primary-600);
  transform: translateX(2px);
  transition: all 0.2s ease;
}
```

---

## 9. Accessibility Features

### Keyboard Navigation

```typescript
// ExpandButton component
<button
  onClick={handleToggle}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }}
  aria-expanded={isExpanded}
  aria-controls="property-details-123"
  aria-label={isExpanded ? 'Collapse property details' : 'Expand property details'}
>
  <Icon name="chevron-down" aria-hidden="true" />
  {!iconOnly && <span>{isExpanded ? 'Hide' : 'Show'} Details</span>}
</button>
```

### Screen Reader Support

```typescript
// Section headers
<div
  role="region"
  aria-labelledby="financial-section-header"
  aria-expanded={isExpanded}
>
  <h4 id="financial-section-header">
    <Icon name="dollar" aria-hidden="true" />
    Financial Breakdown
  </h4>
  {isExpanded && (
    <div role="list" aria-label="Financial details">
      <div role="listitem">
        <span aria-label="Appraised value">$450,000</span>
      </div>
    </div>
  )}
</div>
```

### Color Contrast

```
All text must meet WCAG AA standards:
- Normal text (< 18px): 4.5:1 contrast ratio
- Large text (≥ 18px): 3:1 contrast ratio
- Interactive elements: 3:1 contrast ratio

Financial color indicators:
✓ Green on white: #10b981 on #ffffff = 4.52:1 (Pass)
✓ Red on white: #ef4444 on #ffffff = 4.51:1 (Pass)
✗ Yellow on white: #f59e0b on #ffffff = 2.35:1 (Fail)
  → Use amber-600 #d97706 = 3.56:1 (Pass)
```

---

## 10. Implementation Phases

### Phase 1: Core Expansion (Week 1)
**Goal:** Basic expandable card with financial section

**Components to Build:**
1. `PropertyDetails.tsx` - Main container
2. `ExpandButton.tsx` - Toggle control
3. `FinancialSection.tsx` - First detail section
4. `ValueComparison.tsx` - Financial display
5. Update `PropertyCard.tsx` - Integrate expansion

**Features:**
- Expand/collapse animation
- Financial value comparison
- Value difference calculation
- Responsive mobile layout

---

### Phase 2: Additional Sections (Week 2)
**Goal:** Complete all data display sections

**Components to Build:**
1. `SectionHeader.tsx` - Reusable section component
2. `IdentifiersSection.tsx` - Property IDs
3. `DescriptionSection.tsx` - Description with truncation
4. `TruncatedText.tsx` - Show more/less
5. `MetadataSection.tsx` - Timestamps
6. `TimestampList.tsx` - Formatted dates
7. `FreshnessIndicator.tsx` - Data quality signal

---

### Phase 3: Enhanced Visualizations (Week 3)
**Goal:** Add visual data representations

**Components to Build:**
1. `ValueChart.tsx` - Mini bar chart for values
2. `FreshnessGauge.tsx` - Visual data age indicator
3. `PropertyMap.tsx` - Mini map preview (if geo_id available)

**Integrations:**
- Chart library (Chart.js or Recharts)
- Map library (Leaflet.js)

---

### Phase 4: Polish & Optimization (Week 4)
**Goal:** Loading states, error handling, optimization

**Enhancements:**
1. Loading skeletons
2. Error boundaries
3. Empty state handling
4. Performance optimization (React.memo, lazy loading)
5. Analytics tracking (section expansion events)
6. A/B testing setup (which sections users expand most)

---

## 11. Code Structure

### File Organization

```
src/components/features/PropertySearch/
├── PropertyCard.tsx              (main component - UPDATE)
├── PropertyCard.module.css       (existing styles - UPDATE)
├── PropertyDetails/              (new folder)
│   ├── index.ts                  (exports)
│   ├── PropertyDetails.tsx       (container)
│   ├── PropertyDetails.module.css
│   ├── sections/                 (new folder)
│   │   ├── FinancialSection.tsx
│   │   ├── FinancialSection.module.css
│   │   ├── IdentifiersSection.tsx
│   │   ├── IdentifiersSection.module.css
│   │   ├── DescriptionSection.tsx
│   │   ├── DescriptionSection.module.css
│   │   ├── MetadataSection.tsx
│   │   └── MetadataSection.module.css
│   └── components/               (new folder)
│       ├── SectionHeader.tsx
│       ├── SectionHeader.module.css
│       ├── ValueComparison.tsx
│       ├── ValueComparison.module.css
│       ├── TruncatedText.tsx
│       ├── TruncatedText.module.css
│       ├── TimestampList.tsx
│       ├── TimestampList.module.css
│       ├── FreshnessIndicator.tsx
│       └── FreshnessIndicator.module.css
└── components/                   (existing UI components)
    └── ExpandButton/             (new component)
        ├── index.ts
        ├── ExpandButton.tsx
        └── ExpandButton.module.css
```

---

### Component Props Interfaces

```typescript
// PropertyDetails.tsx
interface PropertyDetailsProps {
  property: Property;
  isExpanded: boolean;
  sections?: DetailSection[];
  onSectionToggle?: (section: DetailSection, isExpanded: boolean) => void;
}

type DetailSection = 'financial' | 'identifiers' | 'description' | 'metadata';

// FinancialSection.tsx
interface FinancialSectionProps {
  appraisedValue: number;
  assessedValue: number | null;
  isCollapsible?: boolean;
  defaultExpanded?: boolean;
  showChart?: boolean;
  currency?: string; // Default: 'USD'
}

// SectionHeader.tsx
interface SectionHeaderProps {
  icon: IconName;
  title: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  badge?: ReactNode;
  className?: string;
}

// ValueComparison.tsx
interface ValueComparisonProps {
  appraisedValue: number;
  assessedValue: number | null;
  showDifference?: boolean;
  showPercentage?: boolean;
  showChart?: boolean;
  format?: 'full' | 'compact'; // $450,000 vs $450k
}

// TruncatedText.tsx
interface TruncatedTextProps {
  text: string | null;
  maxLength?: number;
  maxLines?: number;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
}

// TimestampList.tsx
interface TimestampListProps {
  scrapedAt: string;
  updatedAt: string;
  createdAt?: string;
  showRelative?: boolean;
  showFreshness?: boolean;
  format?: 'relative' | 'absolute' | 'both';
}

// FreshnessIndicator.tsx
interface FreshnessIndicatorProps {
  timestamp: string;
  thresholds?: {
    fresh: number;  // Days
    aging: number;  // Days
  };
  variant?: 'dot' | 'badge' | 'gauge';
  showLabel?: boolean;
}

// ExpandButton.tsx
interface ExpandButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
  label?: string;
  iconOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'minimal';
  className?: string;
}
```

---

## 12. Visual Design Tokens (Complete Reference)

### Create Design Tokens File

```typescript
// src/styles/tokens/propertyCard.tokens.ts

export const propertyCardTokens = {
  // Colors
  colors: {
    financial: {
      positive: '#10b981',
      negative: '#ef4444',
      neutral: '#6b7280',
      bgPositive: '#d1fae5',
      bgNegative: '#fee2e2',
    },
    section: {
      border: '#e5e7eb',
      bg: '#f9fafb',
      hover: '#f3f4f6',
    },
    status: {
      fresh: '#10b981',
      aging: '#d97706', // Accessible amber
      stale: '#ef4444',
    },
    interactive: {
      hover: '#f3f4f6',
      active: '#e5e7eb',
    },
  },

  // Typography
  typography: {
    fontSize: {
      owner: '1.125rem',
      value: '0.875rem',
      label: '0.875rem',
      sectionTitle: '0.8125rem',
      metadata: '0.75rem',
      caption: '0.6875rem',
    },
    fontWeight: {
      owner: 600,
      value: 600,
      section: 500,
      label: 400,
      metadata: 400,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    sectionPadding: '0.75rem',
    sectionGap: '1rem',
    detailItemGap: '0.5rem',
  },

  // Borders
  borders: {
    radius: {
      card: '0.5rem',
      section: '0.375rem',
      button: '0.25rem',
    },
    width: {
      default: '1px',
      focus: '2px',
    },
  },

  // Shadows
  shadows: {
    section: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sectionHover: '0 1px 3px rgba(0, 0, 0, 0.1)',
    card: '0 1px 3px rgba(0, 0, 0, 0.1)',
    cardHover: '0 4px 6px rgba(0, 0, 0, 0.1)',
  },

  // Transitions
  transitions: {
    expand: 'max-height 0.3s ease-in-out, opacity 0.3s ease',
    rotate: 'transform 0.3s ease',
    color: 'background-color 0.2s ease, color 0.2s ease',
    hover: 'all 0.2s ease',
  },

  // Breakpoints
  breakpoints: {
    mobile: '640px',
    tablet: '1024px',
    desktop: '1280px',
  },
} as const;

// Export individual token groups
export const { colors, typography, spacing, borders, shadows, transitions, breakpoints } = propertyCardTokens;
```

---

## 13. Testing Strategy

### Visual Regression Tests

```typescript
// PropertyCard.visual.test.tsx
describe('PropertyCard Visual States', () => {
  test('renders collapsed state correctly', () => {
    // Screenshot test
  });

  test('renders expanded state correctly', () => {
    // Screenshot test
  });

  test('renders with missing data gracefully', () => {
    // Test null/undefined fields
  });

  test('renders financial indicators with correct colors', () => {
    // Test positive/negative/neutral states
  });
});
```

### Interaction Tests

```typescript
// PropertyCard.interaction.test.tsx
describe('PropertyCard Interactions', () => {
  test('expands on button click', () => {
    // Test expand/collapse toggle
  });

  test('keyboard navigation works correctly', () => {
    // Test Enter/Space key
  });

  test('section collapse independently', () => {
    // Test section-level expansion
  });
});
```

### Accessibility Tests

```typescript
// PropertyCard.a11y.test.tsx
describe('PropertyCard Accessibility', () => {
  test('meets WCAG AA contrast requirements', () => {
    // Color contrast checks
  });

  test('has proper ARIA labels', () => {
    // aria-expanded, aria-controls, etc.
  });

  test('keyboard navigation works', () => {
    // Focus management
  });

  test('screen reader announces correctly', () => {
    // Role and label checks
  });
});
```

---

## 14. Performance Optimization

### Code Splitting

```typescript
// Lazy load detail sections
const FinancialSection = lazy(() => import('./sections/FinancialSection'));
const DescriptionSection = lazy(() => import('./sections/DescriptionSection'));
const MetadataSection = lazy(() => import('./sections/MetadataSection'));

// In PropertyDetails:
<Suspense fallback={<DetailSkeleton />}>
  {isExpanded && (
    <>
      <FinancialSection {...props} />
      <DescriptionSection {...props} />
      <MetadataSection {...props} />
    </>
  )}
</Suspense>
```

### Memoization

```typescript
// Memoize expensive calculations
const valueDifference = useMemo(() => {
  if (!assessedValue) return null;
  return appraisedValue - assessedValue;
}, [appraisedValue, assessedValue]);

// Memoize components
export const FinancialSection = memo(FinancialSectionComponent);
export const ValueComparison = memo(ValueComparisonComponent);
```

### Virtual Scrolling (for large lists)

```typescript
// If displaying 100+ properties
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={800}
  itemCount={properties.length}
  itemSize={120} // Collapsed card height
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <PropertyCard property={properties[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 15. Analytics & Metrics

### Track User Engagement

```typescript
// Log expansion events
const handleExpand = () => {
  setIsExpanded(true);
  logAnalytics('property_card_expanded', {
    propertyId: property.property_id,
    sections: ['financial', 'identifiers'],
  });
};

// Track section interactions
const handleSectionToggle = (section: string, isExpanded: boolean) => {
  logAnalytics('property_section_toggle', {
    section,
    isExpanded,
    propertyType: property.prop_type,
  });
};

// Track time spent on expanded card
useEffect(() => {
  if (!isExpanded) return;

  const startTime = Date.now();
  return () => {
    const duration = Date.now() - startTime;
    logAnalytics('property_card_view_duration', {
      propertyId: property.property_id,
      duration,
    });
  };
}, [isExpanded]);
```

### Key Metrics to Track

1. **Expansion Rate:** % of cards expanded
2. **Most Viewed Sections:** Which sections users expand most
3. **Time on Expanded Card:** Average duration
4. **Mobile vs Desktop Usage:** Behavior differences
5. **Missing Data Impact:** Do null fields reduce engagement?

---

## 16. Final Recommendation Summary

### Phase 1 Implementation (Immediate)

**Recommended Approach: Expandable Card (Option A)**

**Why:**
1. **Low friction:** Users don't leave the grid context
2. **Progressive disclosure:** Information revealed on demand
3. **Mobile friendly:** Works well on all screen sizes
4. **Familiar pattern:** Users understand expand/collapse
5. **Modular code:** Easy to add/remove sections
6. **Performant:** Lazy load expanded content

**Start with these components:**
```
✓ PropertyDetails (container)
✓ ExpandButton (toggle)
✓ FinancialSection (most valuable data)
✓ ValueComparison (financial display)
✓ SectionHeader (reusable component)
```

**Launch criteria:**
- Expand/collapse works smoothly (< 300ms animation)
- Mobile responsive (works on 320px width)
- Accessible (keyboard + screen reader)
- Visual consistency maintained
- Performance budget met (< 100ms render time)

---

### Future Enhancements (Phase 2-4)

1. **Side drawer** (desktop) for property comparison
2. **Modal view** (mobile) for deep dive
3. **Interactive maps** when geo_id available
4. **Value trend charts** if historical data added
5. **Export to PDF** button in CardFooter
6. **Share property** functionality
7. **Favorite/bookmark** system
8. **Notes/comments** per property

---

## Visual Hierarchy Quick Reference

```
ALWAYS VISIBLE (Tier 1)
↓
Owner Name (bold, large)
Property Type (badge, color-coded)
Address (icon + text)
Appraised Value (key financial metric)
[Expand Button]

EXPAND TO REVEAL (Tier 2)
↓
┌─────────────────────────┐
│ Financial Breakdown     │ ← Most important section
├─────────────────────────┤
│ Identifiers (IDs)       │ ← Technical details
├─────────────────────────┤
│ Description             │ ← Context
└─────────────────────────┘

SECONDARY EXPANSION (Tier 3)
↓
Metadata (timestamps, freshness)
```

---

## Component Import Map

```typescript
// PropertyCard.tsx (updated)
import { PropertyDetails } from './PropertyDetails';
import { ExpandButton } from './components/ExpandButton';

// PropertyDetails/index.ts
export { PropertyDetails } from './PropertyDetails';
export { FinancialSection } from './sections/FinancialSection';
export { IdentifiersSection } from './sections/IdentifiersSection';
export { DescriptionSection } from './sections/DescriptionSection';
export { MetadataSection } from './sections/MetadataSection';

// Reusable components
export { SectionHeader } from './components/SectionHeader';
export { ValueComparison } from './components/ValueComparison';
export { TruncatedText } from './components/TruncatedText';
export { TimestampList } from './components/TimestampList';
export { FreshnessIndicator } from './components/FreshnessIndicator';
```

---

## Conclusion

This design plan provides a **modular, scalable, and maintainable** approach to extending your property search UI. The expandable card pattern offers the best balance of:

- **User Experience:** Low friction, familiar interaction
- **Information Architecture:** Clear hierarchy, progressive disclosure
- **Code Quality:** Modular components, reusable patterns
- **Performance:** Lazy loading, optimized animations
- **Accessibility:** WCAG compliant, keyboard navigable
- **Responsiveness:** Works beautifully across devices

Start with Phase 1 (Financial Section) to validate the approach, then incrementally add sections based on user feedback and analytics.

**Next Steps:**
1. Review this plan with team
2. Create detailed tickets for Phase 1 components
3. Set up component storybook for isolated development
4. Build and test ExpandButton + FinancialSection
5. Integrate into PropertyCard
6. Deploy behind feature flag for A/B testing
7. Iterate based on user metrics

---

**Document Version:** 1.0
**Last Updated:** 2025-11-08
**Author:** Visual Design System Team
**Status:** Ready for Implementation
