/**
 * Application constants
 */

export const DEFAULT_PAGE_SIZE = 50;

export const PROPERTY_TYPES = [
  'Residential',
  'Commercial',
  'Industrial',
  'Agricultural',
  'Vacant Land',
  'Multi-Family',
] as const;

export const VALUE_RANGES = [
  { label: 'Under $100k', min: 0, max: 100000 },
  { label: '$100k - $300k', min: 100000, max: 300000 },
  { label: '$300k - $500k', min: 300000, max: 500000 },
  { label: '$500k - $1M', min: 500000, max: 1000000 },
  { label: 'Over $1M', min: 1000000, max: Infinity },
] as const;

export const EXAMPLE_QUERIES = [
  'properties in Austin worth over $500k',
  'commercial properties owned by Smith',
  'show me the most expensive residential properties',
  'properties on Congress Ave',
  'find properties appraised between $300k and $600k',
] as const;

export const STATUS_COLORS = {
  active: '#10b981',
  completed: '#3b82f6',
  failed: '#ef4444',
  pending: '#f59e0b',
} as const;

export const BREAKPOINTS = {
  mobile: '640px',
  tablet: '768px',
  desktop: '1024px',
  wide: '1280px',
} as const;
