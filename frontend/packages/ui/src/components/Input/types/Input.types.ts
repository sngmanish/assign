import * as React from 'react';
import type { InputType } from '../constants';

/** A button inside the field, e.g. the search box's clear (×). */
export interface InputAction {
  ariaLabel: string;
  onClick: () => void;
}

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  type?: InputType;
  /** type="search" only: the clear (×) button's label and handler. */
  actions?: InputAction[];
  label?: string;
  id?: string;
  required?: boolean;
  isError?: boolean;
  name?: string;
  validationText?: string;
  style?: React.CSSProperties;
  dataTestId?: string;
  className?: string;
  accessibleErrorText?: string;
  size?: 'small' | 'medium';
  /** type="date" only: the date shown (the date input is uncontrolled; don't pass `value`). */
  selectedDate?: Date | string;
}
