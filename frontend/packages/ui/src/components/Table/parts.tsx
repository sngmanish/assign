import React from 'react';
import type { Column, Row, Table as TanStackTable } from '@tanstack/react-table';

import type { TableRowData, EmptyStateConfig } from './types';
import { BulkAction } from '../BulkAction';
import type { PrimaryAction } from '../BulkAction/types/BulkAction.types';
import { Button, SIZES, VARIANTS } from '../Button';
import { Checkbox } from '../Checkbox';
import { Text } from '../Text';
import ArrowDownIcon from '../../icons/react/ArrowDownIcon';
import ArrowUpIcon from '../../icons/react/ArrowUpIcon';
import CaretSortIcon from '../../icons/react/CaretSortIcon';

import styles from './Table.module.css';

type Instance = TanStackTable<TableRowData>;

/** The header's sort button: shown on hover/focus, and always on the sorted column. */
export function SortButton({ column }: { column: Column<TableRowData, unknown> }) {
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUpIcon : sorted === 'desc' ? ArrowDownIcon : CaretSortIcon;
  return (
    <Button
      variant={VARIANTS.TERTIARY}
      size={SIZES.SMALL}
      iconAlone
      ariaLabel={`Sort column ${column.id}`}
      icon={() => <Icon />}
      onClick={column.getToggleSortingHandler()}
      data-sort-active={Boolean(sorted)}
    />
  );
}

/** Selects or clears every row on the page; shows a dash when only some are selected. */
export function HeaderCheckbox({ table }: { table: Instance }) {
  const all = table.getIsAllPageRowsSelected();
  const some = table.getIsSomePageRowsSelected();
  return (
    <Checkbox
      identifier="header-checkbox"
      ariaLabel="Select all rows on this page"
      checked={all || some}
      variant={all ? 'positive' : some ? 'undetermined' : ''}
      onChange={(e) => table.toggleAllPageRowsSelected(e.target.checked)}
    />
  );
}

export function RowCheckbox({ row, label }: { row: Row<TableRowData>; label: string }) {
  return (
    <Checkbox
      identifier={`checkbox--${row.id}`}
      ariaLabel={label}
      checked={row.getIsSelected()}
      onChange={(e) => row.toggleSelected(e.target.checked)}
    />
  );
}

/** No rows: the caller's message and an optional button. */
export function EmptyState({ config }: { config?: EmptyStateConfig }) {
  return (
    // announced when it appears (e.g. after a search comes back empty)
    <div role="status" aria-live="polite" className={styles.empty}>
      {config?.content ?? <Text size="lg">No results.</Text>}
      {config?.action && (
        <Button
          variant={VARIANTS.SECONDARY}
          label={config.action.label}
          onClick={config.action.onClick}
        />
      )}
    </div>
  );
}

/** The floating bar while rows are selected: the count, select/clear all, and the actions. */
export function BulkBar({
  table,
  actions,
  selectedCount,
  totalCount,
}: {
  table: Instance;
  actions: PrimaryAction[];
  selectedCount: number;
  totalCount: number;
}) {
  const allSelected = table.getIsAllPageRowsSelected();
  const label = allSelected ? 'Clear all' : 'Select All';
  return (
    <BulkAction
      className={styles.bulkBar}
      primaryActions={actions}
      selectedDataCount={selectedCount}
      totalDataCount={totalCount}
      selectAllButtonProps={{
        label,
        ariaLabel: label,
        onClick: () => table.toggleAllPageRowsSelected(!allSelected),
      }}
    />
  );
}
