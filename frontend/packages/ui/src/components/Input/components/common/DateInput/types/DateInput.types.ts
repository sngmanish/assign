import type * as React from 'react';

export interface DateInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type'
> {
  id: string;
  /** The date shown, as dd/mm/yyyy (the input is uncontrolled). '' shows nothing. */
  selectedDate?: Date | string;
}
