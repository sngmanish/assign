import type React from 'react';

export type TooltipPlacement =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-end'
  | 'top-start'
  | 'bottom-end'
  | 'bottom-start'
  | 'left-end'
  | 'left-start'
  | 'right-end'
  | 'right-start';

export interface TooltipProps {
  text?: string;
  /** Keep the tooltip open regardless of hover or focus. */
  visible?: boolean;
  placement?: TooltipPlacement;
  children: React.ReactElement;
  onMouseLeave?: (e: React.MouseEvent) => void;
}
