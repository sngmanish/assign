export const SIZES = {
  MEDIUM: 'medium',
  SMALL: 'small',
} as const;

export type InputSize = (typeof SIZES)[keyof typeof SIZES];

export const TYPES = {
  TEXT: 'text',
  SEARCH: 'search',
  DATE: 'date',
  EMAIL: 'email',
} as const;

export type InputType = (typeof TYPES)[keyof typeof TYPES];
