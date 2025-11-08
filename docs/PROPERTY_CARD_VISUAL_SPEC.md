# PropertyCard Visual Design Specification

**For Designers & Developers**
**Date:** November 8, 2025

---

## Current State vs. Target State

### BEFORE (Current Implementation)

```
┌─────────────────────────────────────────┐
│ John Smith                   [REAL EST] │ ← Header
│                                          │
│ 📍 123 Oak St, Austin                   │ ← Address
│                                          │
│ Appraised Value      $450,000           │ ← Values
│ Assessed Value       $425,000           │
│ Property ID          R123456            │ ← Identifier
│                                          │
└─────────────────────────────────────────┘
280px height
6 fields visible
No expansion capability
```

**Current Fields Shown:**
1. name (Owner)
2. prop_type (Badge)
3. property_address + city
4. appraised_value
5. assessed_value (conditional)
6. property_id

**Missing from UI:**
- geo_id
- description (legal)
- scraped_at, updated_at, created_at
- search_term
- Data freshness indicator
- Value analysis

---

### AFTER - Collapsed State (Phase 1)

```
┌─────────────────────────────────────────┐
│ John Smith                   [REAL EST] │ ← Header with badge
│                                          │
│ 📍 123 Oak St, Austin                   │ ← Address with icon
│                                          │
│ Appraised Value      $450,000           │ ← Primary value (bold)
│ Property ID          R123456  [📋]      │ ← ID with copy button
│                                          │
│ • Updated 2 days ago                    │ ← NEW: Data freshness
│                                          │
│ [▼ Show Details]                        │ ← Expansion trigger
└─────────────────────────────────────────┘
280px height
6 fields visible
Entire card clickable to expand
```

**Visual Enhancements:**
- Data age indicator with color dot (green/yellow/red)
- Copy button next to property ID
- Clear expansion affordance (chevron + label)
- Assessed value moved to expanded state
- Hover state: subtle elevation + border highlight

---

### AFTER - Expanded State (Phase 1)

```
┌─────────────────────────────────────────┐
│ John Smith                   [REAL EST] │ ← Header (unchanged)
│                                          │
│ 📍 123 Oak St, Austin                   │ ← Address (unchanged)
│                                          │
│ Appraised Value      $450,000           │ ← Primary value
│ Property ID          R123456  [📋]      │ ← With copy button
│                                          │
│ • Updated 2 days ago                    │ ← Data age (green dot)
│                                          │
├─────────────────────────────────────────┤ ← Divider line
│                                          │
│ NEW: EXPANDED CONTENT                    │
│                                          │
│ Assessed Value    $425,000  💡-5.6%     │ ← NEW: With differential
│ Geographic ID     GEO789     [📋]       │ ← NEW: With copy button
│                                          │
│ Legal Description                        │ ← NEW: Section header
│ LOT 5 BLK A, OAKWOOD ESTATES            │ ← Truncated at 100 chars
│                                          │
│ Data Timeline                            │ ← NEW: Metadata section
│ • ⏰ Scraped: 2d ago                    │ ← Relative time
│ • 🔄 Updated: 2d ago                    │
│ • 📅 Created: Sep 15, 2025              │ ← Absolute date
│                                          │
│ 🔍 Found via: "Oak St"                  │ ← NEW: Discovery context
│                                          │
│ [▲ Hide Details]                        │ ← Collapse trigger
└─────────────────────────────────────────┘
480px height
12 fields visible
Smooth 300ms expansion animation
```

**New Fields in Expansion:**
7. assessed_value with differential badge
8. geo_id with copy button
9. description (legal, truncated)
10. scraped_at (relative time)
11. updated_at (relative time)
12. created_at (absolute date)
13. search_term (discovery context)

---

## Layout Measurements

### Desktop (>1024px)

```
Grid Layout:
┌───────┬───────┬───────┐
│ Card  │ Card  │ Card  │  ← 3 columns
│ 320px │ 320px │ 320px │
├───────┼───────┼───────┤
│ Card  │ Card  │ Card  │
└───────┴───────┴───────┘

Gap: 24px between cards
Max width: 1200px container
Padding: 32px sides
```

**Card Dimensions:**
- Width: 320px
- Height (collapsed): 280px
- Height (expanded): 480px
- Border radius: 8px
- Padding: 16px

**Spacing:**
- Header to address: 12px
- Address to details: 16px
- Between detail items: 12px
- Footer margin-top: 16px

---

### Tablet (768px - 1024px)

```
Grid Layout:
┌────────┬────────┐
│ Card   │ Card   │  ← 2 columns
│ 360px  │ 360px  │
├────────┼────────┤
│ Card   │ Card   │
└────────┴────────┘

Gap: 20px between cards
Padding: 24px sides
```

---

### Mobile (<768px)

```
Grid Layout:
┌──────────────┐
│    Card      │  ← 1 column
│   100% - 32px│
├──────────────┤
│    Card      │
└──────────────┘

Padding: 16px sides
Vertical gap: 16px

Expanded State:
┌──────────────┐
│              │
│  Full Screen │  ← Modal overlay
│   Card View  │  ← 100vw x 100vh
│              │
└──────────────┘

Features:
- Position: fixed
- Z-index: 1000
- Overflow-y: auto
- Swipe down to dismiss
```

---

## Color Palette

### Background & Borders

```css
/* Card */
--card-bg: #ffffff
--card-border: #e5e7eb (neutral-200)
--card-border-hover: #93c5fd (primary-300)
--card-border-expanded: #60a5fa (primary-400)

/* Sections */
--section-bg: #f9fafb (neutral-50)
--divider: #e5e7eb (neutral-200)
```

### Typography Colors

```css
/* Text */
--heading-color: #111827 (neutral-900)
--body-color: #4b5563 (neutral-600)
--value-color: #111827 (neutral-900)
--label-color: #6b7280 (neutral-500)
--mono-color: #374151 (neutral-700)
```

### Semantic Colors

```css
/* Value Differential */
--undervalued-bg: #fef2f2 (red-50)
--undervalued-text: #dc2626 (red-600)
--overvalued-bg: #f0fdf4 (green-50)
--overvalued-text: #16a34a (green-600)
--market-rate-bg: #f9fafb (gray-50)
--market-rate-text: #6b7280 (gray-600)

/* Data Freshness */
--fresh-dot: #22c55e (green-500)
--recent-dot: #eab308 (yellow-500)
--stale-dot: #ef4444 (red-500)

/* Actions */
--primary-action: #3b82f6 (blue-500)
--primary-hover: #2563eb (blue-600)
--secondary-bg: #eff6ff (blue-50)
```

---

## Typography Scale

### Font Families

```css
/* Default */
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

/* Monospace (IDs) */
--font-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace;
```

### Font Sizes & Weights

```css
/* Owner Name */
.owner {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

/* Address */
.address {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
}

/* Value Labels */
.detailLabel {
  font-size: 14px;
  font-weight: 400;
}

/* Value Amounts */
.detailValue {
  font-size: 14px;
  font-weight: 600;
}

/* Property IDs */
.mono {
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-mono);
}

/* Timestamps */
.timestamp {
  font-size: 12px;
  font-weight: 400;
}

/* Section Headers */
.sectionHeader {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## Component States

### 1. Default (Collapsed)

```
Visual Properties:
- Background: white
- Border: 1px solid neutral-200
- Shadow: 0 1px 3px rgba(0,0,0,0.1)
- Cursor: pointer
- Height: 280px
```

### 2. Hover (Collapsed)

```
Visual Properties:
- Border: 1px solid primary-300
- Shadow: 0 4px 6px rgba(0,0,0,0.1)
- Transform: translateY(-2px)
- Transition: 200ms ease
```

### 3. Focus (Keyboard)

```
Visual Properties:
- Outline: 2px solid primary-500
- Outline-offset: 2px
```

### 4. Expanded

```
Visual Properties:
- Border: 1px solid primary-400
- Shadow: 0 10px 15px rgba(0,0,0,0.1)
- Z-index: 10
- Height: 480px
- Animation: 300ms ease-out
```

### 5. Selected (Phase 3: Comparison)

```
Visual Properties:
- Background: primary-50
- Border: 2px solid primary-500
- Checkmark: top-right corner
```

---

## Interactive Elements

### Copy Button

```
Default State:
┌─────┐
│ 📋  │  ← Icon only, 14px
└─────┘
Color: neutral-500
Size: 24x24px hit area
Padding: 4px

Hover State:
┌─────┐
│ 📋  │  ← Background appears
└─────┘
Color: primary-600
Background: neutral-100
Border-radius: 4px

Active State:
Color: primary-700
Toast: "Copied!" (future)
```

### Expansion Button

```
Default State:
┌────────────────────┐
│ ▼ Show Details     │  ← Full width
└────────────────────┘
Color: primary-600
Background: transparent
Padding: 8px

Hover State:
┌────────────────────┐
│ ▼ Show Details     │
└────────────────────┘
Background: primary-50
Border-radius: 6px

Expanded State:
┌────────────────────┐
│ ▲ Hide Details     │  ← Icon flips
└────────────────────┘
```

---

## Badges & Indicators

### Property Type Badge

```
┌─────────────┐
│ REAL ESTATE │  ← All caps
└─────────────┘

Variant: info (blue)
Background: primary-100
Text: primary-700
Padding: 4px 8px
Border-radius: 4px
Font-size: 12px
Font-weight: 600
```

### Value Differential Badge

```
Undervalued (<-10%):
┌──────────────┐
│ 🔻 -5.6%     │  ← Red theme
└──────────────┘
Background: red-50
Text: red-600
Border: 1px solid red-200

Overvalued (>+10%):
┌──────────────┐
│ 🔺 +12.3%    │  ← Green theme
└──────────────┘
Background: green-50
Text: green-600
Border: 1px solid green-200

Market Rate (-10% to +10%):
┌──────────────┐
│ ➖ +2.1%     │  ← Gray theme
└──────────────┘
Background: gray-50
Text: gray-600
Border: 1px solid gray-200
```

### Data Age Indicator

```
Fresh (<7 days):
┌──────────────────┐
│ • Updated 2d ago │  ← Green dot
└──────────────────┘
Dot color: #22c55e

Recent (7-30 days):
┌──────────────────┐
│ • Updated 15d ago│  ← Yellow dot
└──────────────────┘
Dot color: #eab308

Stale (>30 days):
┌──────────────────────┐
│ • Updated 45d ago ⚠️ │  ← Red dot + warning
└──────────────────────┘
Dot color: #ef4444
Warning: #f59e0b
```

---

## Animations

### Expansion Animation

```css
@keyframes expandCard {
  from {
    max-height: 280px;
  }
  to {
    max-height: 480px;
  }
}

/* Apply to card */
.card {
  transition: all 300ms ease-out;
}

/* Content fade-in */
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

.expandedContent {
  animation: fadeIn 300ms ease-out;
}
```

### Hover Elevation

```css
.card:hover {
  transform: translateY(-2px);
  transition: transform 200ms ease, box-shadow 200ms ease;
}
```

### Copy Button Feedback

```css
.copyButton:active {
  transform: scale(0.95);
  transition: transform 100ms ease;
}
```

---

## Accessibility Requirements

### ARIA Attributes

```html
<!-- Card wrapper -->
<div
  role="button"
  tabindex="0"
  aria-expanded="false"
  aria-controls="property-details-{id}"
  aria-label="Property card for 123 Oak St. Click to expand details."
>

<!-- Expanded content -->
<div
  id="property-details-{id}"
  aria-hidden="true"
  aria-labelledby="property-header-{id}"
>

<!-- Copy buttons -->
<button
  aria-label="Copy property ID R123456 to clipboard"
  title="Copy to clipboard"
>
```

### Keyboard Navigation

```
Tab: Move focus to next card
Shift+Tab: Move focus to previous card
Enter: Expand/collapse focused card
Space: Expand/collapse focused card
Escape: Collapse expanded card (future)
```

### Focus Indicators

```css
.card:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.copyButton:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
  border-radius: 4px;
}
```

### Screen Reader Announcements

```
On expansion:
"Property details expanded. Showing 12 fields including assessed value, geographic ID, and legal description."

On collapse:
"Property details collapsed. Showing summary view."

On copy:
"Property ID R123456 copied to clipboard."
```

---

## Responsive Breakpoints

### Breakpoint Strategy

```css
/* Mobile First Approach */

/* Base styles: Mobile (<768px) */
.card {
  width: 100%;
  margin: 0 16px;
}

/* Tablet (768px - 1024px) */
@media (min-width: 768px) {
  .card {
    width: calc(50% - 20px);
  }
}

/* Desktop (>1024px) */
@media (min-width: 1024px) {
  .card {
    width: 320px;
  }
}

/* Large Desktop (>1440px) */
@media (min-width: 1440px) {
  .container {
    max-width: 1400px;
  }
}
```

### Mobile-Specific Adaptations

```css
/* Mobile: Expanded state becomes full-screen modal */
@media (max-width: 768px) {
  .card.expanded {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    margin: 0;
    border-radius: 0;
    z-index: 1000;
    overflow-y: auto;
  }

  /* Stack detail items vertically */
  .detailItem {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}
```

---

## Example Visual Flows

### User Flow 1: Quick Scan

```
1. User lands on results page
   ┌──────┬──────┬──────┐
   │Card  │Card  │Card  │  ← 3x3 grid visible
   │Card  │Card  │Card  │
   │Card  │Card  │Card  │
   └──────┴──────┴──────┘

2. User scans collapsed cards
   • Reads owner names
   • Checks appraised values
   • Notes data freshness
   • Makes mental shortlist

3. User hovers over interesting card
   ┌──────────────┐
   │Card (elevated)│  ← Subtle lift effect
   └──────────────┘

4. User clicks to expand
   ┌──────────────┐
   │Card (full)   │  ← Smooth expansion
   │              │
   │All details   │
   └──────────────┘

5. User reads additional details
   • Checks assessed value differential
   • Copies geo_id for research
   • Notes legal description

6. User collapses or moves to next card
```

### User Flow 2: Deep Research

```
1. User searches for specific property
   [Search: "123 Oak St"] → Results

2. User finds target property card

3. User expands card immediately
   ┌────────────────────┐
   │ Full property view │
   └────────────────────┘

4. User copies property_id
   [Click copy] → "R123456" → Clipboard

5. User copies geo_id
   [Click copy] → "GEO789" → Clipboard

6. User reviews all timestamps
   • Scraped: 2d ago ✓
   • Updated: 2d ago ✓
   • Created: Sep 15, 2025 ✓

7. User notes legal description

8. User checks discovery method
   "Found via: Oak St" ✓

9. User leaves to cross-reference external data
```

---

## Performance Budget

### Render Performance

```
Targets:
- Initial card render: <100ms
- Expansion animation: 300ms smooth
- Hover response: <50ms
- Copy action: <100ms

Optimization:
- React.memo on PropertyCard
- useMemo for calculations
- CSS transform (GPU-accelerated)
- Virtual scrolling if >100 cards
```

### File Size Budget

```
Components:
- PropertyCard.tsx: <10KB
- PropertyCard.module.css: <5KB
- propertyCalculations.ts: <3KB
- Total: <18KB

Images/Icons:
- Use SVG icons (inline)
- No raster images needed
```

---

## Design Tokens (CSS Variables)

```css
:root {
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 100ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease-out;

  /* Z-index */
  --z-base: 1;
  --z-elevated: 10;
  --z-modal: 1000;

  /* Card Dimensions */
  --card-collapsed-height: 280px;
  --card-expanded-height: 480px;
  --card-padding: 16px;
  --card-gap: 12px;
}
```

---

## QA Visual Checklist

### Desktop Chrome
- [ ] Cards render in 3-column grid
- [ ] Hover shows elevation + border change
- [ ] Expansion smooth 300ms animation
- [ ] All 12 fields visible when expanded
- [ ] Copy buttons functional
- [ ] Badges display correctly
- [ ] Data age dot shows correct color
- [ ] Focus outline visible on keyboard tab

### Mobile Safari (iOS)
- [ ] Cards stack in 1 column
- [ ] Tap expands to full-screen modal
- [ ] Swipe down dismisses modal
- [ ] Touch targets minimum 44px
- [ ] No horizontal scroll
- [ ] Animations smooth 60fps
- [ ] Copy buttons work

### Firefox
- [ ] Same as Chrome desktop
- [ ] CSS grid layout correct
- [ ] Animations perform well

### Accessibility
- [ ] Screen reader announces states
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast ratios pass
- [ ] ARIA attributes present
- [ ] Reduced motion respected

---

**Design Sign-off:** _____________
**Dev Sign-off:** _____________
**Date:** November 8, 2025

---

## Related Documents

- Full UX Research: [UX_RESEARCH_PROPERTY_DETAILS.md](/home/aledlie/tcad-scraper/docs/UX_RESEARCH_PROPERTY_DETAILS.md)
- Implementation Spec: [PROPERTY_CARD_EXTENSION_SPEC.md](/home/aledlie/tcad-scraper/docs/PROPERTY_CARD_EXTENSION_SPEC.md)
- Current Component: `/home/aledlie/tcad-scraper/src/components/features/PropertySearch/PropertyCard.tsx`
