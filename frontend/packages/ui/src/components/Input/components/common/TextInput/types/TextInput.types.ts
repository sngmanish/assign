import * as React from 'react';
import type { InputType, InputSize } from '../../../../constants';

export interface TextInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size' | 'prefix'
> {
  id: string;
  size?: InputSize;
  type?: InputType;
  prefix?: string | (() => React.ReactElement) | null;
  actions?: Array<() => React.ReactElement>;
  isError?: boolean;
  /** An addon sits at the left end (squares the input's left corners). */
  hasLeftAddon?: boolean;
  validationText?: string;
  label?: string;
  dataTestId?: string;
}
