import React, { useMemo, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Table as TanStackTable,
  type Updater,
  type SortingState,
} from '@tanstack/react-table';
import classNames from 'classnames';

import { BulkBar, EmptyState, HeaderCheckbox, RowCheckbox, SortButton } from './parts';
import type { TableColumnDef, TableRowData, UseTableReturn } from './types';
import { Pagination } from '../Pagination';
import { Skeleton } from '../Skeleton';
import { Text } from '../Text';
import { useMediaQuery } from '../../utilities/hooks/useMediaQuery';

import styles from './Table.module.css';

const SELECT_COLUMN_ID = 'select';
const SELECT_COLUMN_WIDTH = 40;
const DEFAULT_MIN_WIDTH = 100;
const MOBILE_QUERY = '(max-width: 639px)';

type View = 'rows' | 'loading' | 'empty' | 'search-empty';
type Instance = TanStackTable<TableRowData>;

/**
 * A table driven by `useTable`. The server sorts and pages; the table shows the sort, lets
 * rows be selected, and covers loading, empty and "no search results" states. On narrow
 * screens each row is a card.
 */
function Table({ table: options }: { table: UseTableReturn }) {
  const {
    columns,
    rows,
    isLoading,
    loadingLayout,
    maxHeight,
    searchInputMetadata,
    sorting,
    onSortingChange,
    rowSelection,
    bulkActionsMetadata,
    paginationMetadata,
    noDataConfig,
    noSearchResultsConfig,
    rowSelectionState,
    setRowSelection,
  } = options;

  const selectable = Boolean(rowSelection);
  // read at render time, so a new label function each render doesn't rebuild the columns
  const rowLabel = useRef(rowSelection?.getRowLabel);
  rowLabel.current = rowSelection?.getRowLabel;

  const allColumns = useMemo<TableColumnDef[]>(
    () =>
      selectable
        ? [
            {
              id: SELECT_COLUMN_ID,
              size: SELECT_COLUMN_WIDTH,
              enableSorting: false,
              header: ({ table }) => <HeaderCheckbox table={table} />,
              cell: ({ row }) => (
                <RowCheckbox row={row} label={rowLabel.current?.(row.original) ?? 'Select row'} />
              ),
            },
            ...columns,
          ]
        : columns,
    [columns, selectable],
  );

  const currentSort = sorting ?? [];
  const table = useReactTable({
    data: rows,
    columns: allColumns,
    state: { sorting: currentSort, rowSelection: rowSelectionState },
    manualSorting: true,
    onSortingChange: (updater: Updater<SortingState>) =>
      onSortingChange?.(typeof updater === 'function' ? updater(currentSort) : updater),
    enableRowSelection: selectable,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  const isMobile = useMediaQuery(MOBILE_QUERY);
  const searching = Boolean(searchInputMetadata?.value);
  const view: View = isLoading
    ? 'loading'
    : rows.length > 0
      ? 'rows'
      : searching
        ? 'search-empty'
        : 'empty';

  const emptyState =
    view === 'empty' || view === 'search-empty' ? (
      <EmptyState config={view === 'empty' ? noDataConfig : noSearchResultsConfig} />
    ) : null;

  const selectedCount = Object.keys(rowSelectionState).length;

  return (
    <div>
      {isMobile ? (
        <MobileCards
          table={table}
          view={view}
          emptyState={emptyState}
          loadingCount={loadingLayout?.count ?? 4}
        />
      ) : (
        <DesktopTable
          table={table}
          view={view}
          emptyState={emptyState}
          loadingCount={loadingLayout?.count ?? 4}
          maxHeight={maxHeight}
        />
      )}

      {paginationMetadata && !emptyState && (
        <div className={styles.pagination}>
          <Pagination {...paginationMetadata} />
        </div>
      )}

      {bulkActionsMetadata && selectedCount > 0 && (
        <BulkBar
          table={table}
          actions={bulkActionsMetadata.primaryActions}
          selectedCount={bulkActionsMetadata.selectedDataCount ?? selectedCount}
          totalCount={bulkActionsMetadata.totalDataCount ?? rows.length}
        />
      )}
    </div>
  );
}

interface ViewProps {
  table: Instance;
  view: View;
  emptyState: React.ReactNode;
  loadingCount: number;
}

/** A fixed-layout table: columns with a `size` keep it, the others share the rest. */
function DesktopTable({
  table,
  view,
  emptyState,
  loadingCount,
  maxHeight,
}: ViewProps & { maxHeight: string }) {
  const headers = table.getFlatHeaders();
  // narrower than the columns' minimum widths, the box scrolls sideways
  const minWidth = headers.reduce(
    (sum, h) => sum + (h.column.columnDef.size ?? h.column.columnDef.minSize ?? DEFAULT_MIN_WIDTH),
    0,
  );
  const pinned = (id: string) => (id === SELECT_COLUMN_ID ? styles.pinned : undefined);

  return (
    <div className={styles.scroll} style={{ maxHeight }}>
      <table
        className={styles.table}
        style={{ minWidth }}
        aria-busy={view === 'loading' || undefined}
      >
        <thead>
          <tr>
            {headers.map((header) => {
              const sortable = header.column.getCanSort();
              return (
                <th
                  key={header.id}
                  className={classNames(styles.th, pinned(header.id))}
                  style={{ width: header.column.columnDef.size }}
                  aria-sort={
                    header.column.getIsSorted() === 'asc'
                      ? 'ascending'
                      : header.column.getIsSorted() === 'desc'
                        ? 'descending'
                        : undefined
                  }
                >
                  <div className={classNames(styles.thContent, sortable && styles.thSortable)}>
                    <span className={styles.truncate}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </span>
                    {sortable && <SortButton column={header.column} />}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {view === 'loading' &&
            Array.from({ length: loadingCount }, (_, i) => (
              <tr key={i} className={styles.row}>
                {headers.map((h) => (
                  <td key={h.id} className={classNames(styles.td, pinned(h.id))}>
                    <Skeleton
                      height={24}
                      width={h.id === SELECT_COLUMN_ID ? 24 : '100%'}
                      style={{ display: 'block' }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          {emptyState && (
            <tr>
              <td colSpan={headers.length}>{emptyState}</td>
            </tr>
          )}
          {view === 'rows' &&
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={classNames(styles.row, row.getIsSelected() && styles.rowSelected)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={classNames(styles.td, pinned(cell.column.id))}>
                    <div className={styles.truncate}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/** One card per row: each column's header above its value. */
function MobileCards({ table, view, emptyState, loadingCount }: ViewProps) {
  const headers = table.getFlatHeaders().filter((h) => h.id !== SELECT_COLUMN_ID);
  const selectable = table.getFlatHeaders().length !== headers.length;

  return (
    <div className={styles.cards} aria-busy={view === 'loading' || undefined}>
      {selectable && view === 'rows' && <HeaderCheckbox table={table} />}
      {view === 'loading' &&
        Array.from({ length: loadingCount }, (_, i) => (
          <div key={i} className={styles.card}>
            {headers.map((h) => (
              <Skeleton key={h.id} height={20} width="60%" style={{ display: 'block' }} />
            ))}
          </div>
        ))}
      {emptyState}
      {view === 'rows' &&
        table.getRowModel().rows.map((row) => {
          const cells = new Map(row.getVisibleCells().map((c) => [c.column.id, c]));
          const select = cells.get(SELECT_COLUMN_ID);
          return (
            <div
              key={row.id}
              className={classNames(styles.card, row.getIsSelected() && styles.cardSelected)}
            >
              {select && flexRender(select.column.columnDef.cell, select.getContext())}
              {headers.map((h) => {
                const cell = cells.get(h.column.id);
                return (
                  <div key={h.id} className={styles.cardField}>
                    <Text size="sm" color="var(--hl-muted-foreground)">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </Text>
                    {cell && (
                      <Text>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Text>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

export default Table;
