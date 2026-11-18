import { useState } from 'react';
import type { RowSelectionState } from '@tanstack/react-table';

import type { UseTableProps, UseTableReturn } from './types';

/**
 * The table's options plus its row selection (which the caller can read and clear).
 * Pass the result to `<Table table={...} />`.
 */
export function useTable({ maxHeight = '500px', ...options }: UseTableProps): UseTableReturn {
  const [rowSelectionState, setRowSelection] = useState<RowSelectionState>({});
  return { ...options, maxHeight, rowSelectionState, setRowSelection };
}
