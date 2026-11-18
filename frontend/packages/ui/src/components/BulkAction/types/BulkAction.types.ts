import type React from 'react';

import type { ButtonProps } from '../../Button/types/Button.types';

export interface SelectAllButtonProps {
  label?: string;
  ariaLabel?: string;
  onClick?: (e: React.MouseEvent) => void;
  [key: string]: unknown;
}

/** A button in the bar (at most three are shown). */
export type PrimaryAction = Omit<ButtonProps, 'variant' | 'color'>;

export interface BulkActionProps {
  className?: string;
  selectedDataCount?: number;
  totalDataCount?: number;
  selectAllButtonProps?: SelectAllButtonProps;
  primaryActions?: PrimaryAction[];
}

export interface SelectAllProps {
  selectAllButtonProps: SelectAllButtonProps;
}
