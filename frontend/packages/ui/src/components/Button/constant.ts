export const VARIANTS = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  TERTIARY: 'tertiary',
} as const;

export const SIZES = {
  SMALL: 'small',
  MEDIUM: 'medium',
} as const;

export const ARROWICON = {
  UP: 'up',
  DOWN: 'down',
  DEFAULT: '',
} as const;

export type ButtonVariant = (typeof VARIANTS)[keyof typeof VARIANTS];
export type ButtonSize = (typeof SIZES)[keyof typeof SIZES];
export type ButtonArrowIcon = (typeof ARROWICON)[keyof typeof ARROWICON];
