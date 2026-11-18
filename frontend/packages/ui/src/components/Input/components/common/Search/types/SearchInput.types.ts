import type * as React from 'react';

import type { InputAction } from '../../../../types/Input.types';

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'size' | 'type'
> {
  id: string;
  actions?: InputAction[];
}
