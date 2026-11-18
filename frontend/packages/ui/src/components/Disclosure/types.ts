import type React from 'react';

export const PLACEMENTS = {
  TOP_END: 'top-end',
  TOP: 'top',
  TOP_START: 'top-start',
  RIGHT_END: 'right-end',
  RIGHT: 'right',
  RIGHT_START: 'right-start',
  BOTTOM_END: 'bottom-end',
  BOTTOM: 'bottom',
  BOTTOM_START: 'bottom-start',
  LEFT_END: 'left-end',
  LEFT: 'left',
  LEFT_START: 'left-start',
} as const;

export type Placement = (typeof PLACEMENTS)[keyof typeof PLACEMENTS];

/** What `useDisclosure` takes: ids, where the body opens and how it looks. */
export interface DisclosureOptions {
  triggerId?: string;
  bodyId?: string;
  /** Open on first render. */
  visible?: boolean;
  placement?: Placement;
  /** Move to another side when there is no room. Default true. */
  flip?: boolean;
  /** Fade in and out. */
  animate?: boolean;
  /** Focus the first focusable element when it opens. Default true. */
  autoFocus?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/** Spread onto the trigger button. */
export interface DisclosureTrigger {
  id?: string;
  ref: React.RefObject<HTMLButtonElement>;
  'aria-expanded': boolean;
  'aria-haspopup': 'menu' | 'listbox' | 'dialog';
  'aria-controls'?: string;
  onClick?: (e: React.MouseEvent) => void;
}

/** The body's state, read by `DisclosureBody`. */
export interface DisclosureBodyConfig {
  id?: string;
  ref: React.RefObject<HTMLDivElement>;
  visible: boolean;
  placement: Placement;
  flip: boolean;
  animate: boolean;
  autoFocus: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export interface Disclosure {
  trigger: DisclosureTrigger;
  body: DisclosureBodyConfig;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
