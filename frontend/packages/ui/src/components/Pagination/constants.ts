import type { PageOption } from './types/Pagination.types';

export const TYPES = {
  INCREMENT: 'increment',
  DECREMENT: 'decrement',
} as const;

export const DEFAULT_TITLE = 'Rows per page';
export const DEFAULT_INITIAL_ROW: PageOption = { label: '10', value: 10 };
export const DEFAULT_PAGE: PageOption = { label: '1', value: 1 };
export const DEFAULT_ROW_LIST: PageOption[] = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '30', value: 30 },
];
export const DEFAULT_RANGE_LABEL = '${rowRange} of ${totalRowCount}';
export const DEFAULT_TOTAL_PAGES_LABEL = 'of ${totalPagesCount} pages';

export const DYNAMIC_KEY_REGEX = /\$\{(\w+)\}/g;
