import * as React from 'react';
import type { InputType } from '../../../../../constants';

export interface InputTagProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'prefix' | 'readOnly' | 'maxLength'
> {
  readOnly?: boolean;
  disabled?: boolean;
  inputControlClasses?: string;
  id: string;
  type?: InputType;
  maxLength?: number | null;
  required?: boolean;
  isError?: boolean;
  placeholder?: string;
  name?: string;
  prefix?: string | (() => React.ReactElement) | null;
  label?: string;
  validationText?: string;
  dataTestId?: string;
}
