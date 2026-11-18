import type * as React from 'react';

import type { ButtonProps } from '../Button/types/Button.types';

export interface SelectOption {
  key: string | number;
  label: string;
  disabled?: boolean;
  /** Shown before the label (e.g. a country flag). */
  icon?: () => React.ReactNode;
}

export interface CreatableButtonMetaData {
  /** Text before the typed name, e.g. "Create" -> Create "VIP". */
  createLabelText?: string;
  disabled?: boolean;
  handleCreateOption?: (name: string, event: React.SyntheticEvent) => void;
}

export type SelectMenuPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export interface SelectMenuProps {
  /** The options shown (already filtered by the caller's search). */
  options: SelectOption[];
  onSelect: (option: SelectOption, event: React.SyntheticEvent) => void;
  /** The option shown as selected (bold, aria-selected). */
  selectedKey?: string | number;
  /** Props of the Button that opens the menu (label, icon, variant, size ...). */
  controlButtonMetaData?: Partial<ButtonProps>;
  disabled?: boolean;
  /** Where the menu opens. Default below, left-aligned. */
  placement?: SelectMenuPlacement;
  /** Stretch the button to its container (the menu is at least as wide). */
  fullWidth?: boolean;
  /** Show the search box at the top of the panel. Default true. */
  searchable?: boolean;
  searchValue?: string;
  handleSearch?: (value: string) => void;
  searchPlaceholder?: string;
  /** Offer "Create '<search>'" when the search has no exact match. */
  isCreatable?: boolean;
  isExactMatch?: boolean;
  creatableButtonMetaData?: CreatableButtonMetaData;
  noOptionContent?: React.ReactNode;
  identifier?: string;
}
