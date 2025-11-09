/**
 * SVG icon paths as string data
 * Centralizes all icon definitions
 */

export const iconPaths: Record<string, string> = {
  search: 'M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M21 21l-4.35-4.35',
  location: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  chevronRight: 'M9 18l6-6l-6-6',
  'chevron-up': 'M6 15l6-6l6 6',
  'chevron-down': 'M6 9l6 6l6-6',
  calendar: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6zM16 2v4M8 2v4M3 10h18',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  alertCircle: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 8v4M12 16h0.01',
  info: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 16v-4M12 8h0.01',
  arrowUp: 'M12 19V5',
  arrowDown: 'M12 5v14',
  loader: 'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  filter: 'M22 3H2l8 9.46V19l4 2V12.46L22 3z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5l5-5M12 15V3',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  'dollar-sign': 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  'file-text': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  clock: 'M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0M12 6v6l4 2',
};

export type IconName = keyof typeof iconPaths;
