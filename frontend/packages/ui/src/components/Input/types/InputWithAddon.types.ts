import * as React from 'react';
import type { InputType } from '../constants';

export interface InputWithAddonProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'name' | 'readOnly'
> {
  type?: InputType;
  /** Rendered at the left end of the field (e.g. the phone input's country picker). */
  leftAddon?: React.ReactNode;
  label?: string;
  id: string;
  required?: boolean;
  isError?: boolean;
  disabled?: boolean;
  validationText?: string;
  style?: React.CSSProperties;
  className?: string;
  accessibleErrorText?: string;
}
