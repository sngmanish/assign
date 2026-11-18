export interface PageOption {
  label: string;
  value: number;
}

export interface NavigationButtonsProps {
  currentPageInt: number;
  totalPages: number;
  handlePageChange: (type: string) => void;
  children?: React.ReactNode;
}

export interface NavButtonProps {
  icon: React.ReactElement;
  ariaLabel: string;
  index: number;
  disabled: boolean;
  action: () => void;
}

export interface PaginationProps {
  showRowsPerPage?: boolean;
  title?: string;
  rowList?: PageOption[];
  initialRow?: PageOption;
  currentPage?: string | number;
  totalResults?: number;
  onChange?: (option: PageOption) => void;
  onPageChange?: (page: number) => void;
  totalPagesLabel?: string;
  /** Text before the page input/select, e.g. "Page" (reads "Page [3] of 42"). Empty by default. */
  pageLabel?: string;
}
