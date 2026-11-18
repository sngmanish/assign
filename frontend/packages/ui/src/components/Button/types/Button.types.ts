import * as React from 'react';

import type { ButtonVariant, ButtonSize, ButtonArrowIcon } from '../constant';

// The unions keep editor autocomplete; `string & {}` also lets callers that hold a plain string
// (a prop forwarded from another component) pass it through.
type Loose<T extends string> = T | (string & {});

export type IconProp = React.ReactNode | (() => React.ReactNode) | null;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Loose<ButtonVariant>;
  iconAlone?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: Loose<ButtonSize>;
  label?: string;
  className?: string;
  disabled?: boolean;
  dataTestId?: string;
  ariaLabel?: string;
  icon?: IconProp;
  arrowIcon?: Loose<ButtonArrowIcon>;
}
