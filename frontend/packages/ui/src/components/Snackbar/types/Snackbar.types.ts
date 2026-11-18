import type React from 'react';

export type SnackbarType = 'success' | 'error';

/** What `useSnackbar()` takes to show a toast. */
export interface SnackbarOptions {
  type: SnackbarType;
  message: React.ReactNode;
  /** How long it stays, in ms (paused while hovered). Default 4000. */
  duration?: number;
}

export interface SnackbarProps extends SnackbarOptions {
  /** Called once the toast has finished leaving. */
  onRemoved: () => void;
}

export interface SnackbarContainerProps {
  children: React.ReactNode;
}
