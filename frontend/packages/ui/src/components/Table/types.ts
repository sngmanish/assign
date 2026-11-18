import type React from 'react';
import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/react-table';

import type { PrimaryAction } from '../BulkAction/types/BulkAction.types';
import type { PaginationProps } from '../Pagination/types/Pagination.types';

export interface TableRowData {
  id: string | number;
  [key: string]: unknown;
}

/**
 * A TanStack column. `size` fixes its width; columns without one share the free width, and their
 * `minSize`s add up to the table's minimum width (narrower containers scroll sideways).
 */
export type TableColumnDef = ColumnDef<TableRowData, unknown>;

/** What the table shows instead of rows: a message and an optional button. */
export interface EmptyStateConfig {
  content?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

export interface UseTableProps {
  columns: TableColumnDef[];
  rows: TableRowData[];
  isLoading?: boolean;
  /** How many placeholder rows to show while loading. */
  loadingLayout?: { count: number };
  /** The scroll box's maximum height. */
  maxHeight?: string;
  /** The applied search text: with it, an empty table shows `noSearchResultsConfig`. */
  searchInputMetadata?: { value?: string };
  /** The server sorts: the table only shows this sort and reports clicks. */
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  /** Turns on the checkbox column. `getRowLabel` names each row's checkbox. */
  rowSelection?: { getRowLabel?: (row: TableRowData) => string };
  /** The bar shown while rows are selected. The counts default to the current page. */
  bulkActionsMetadata?: {
    primaryActions: PrimaryAction[];
    selectedDataCount?: number;
    totalDataCount?: number;
  };
  /** Page numbers under the table; leave out for none. */
  paginationMetadata?: PaginationProps;
  noDataConfig?: EmptyStateConfig;
  noSearchResultsConfig?: EmptyStateConfig;
}

export interface UseTableReturn extends UseTableProps {
  maxHeight: string;
  rowSelectionState: RowSelectionState;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
}
