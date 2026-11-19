import { useRef } from 'react';
import type { ContactListState } from './listState';

type Trail = { key: string; cursors: Map<number, string> };

/**
 * Remembers the cursor that loaded each page of the current results, so Prev can reuse it.
 * The server's `prevCursor` points at the same rows but is a different string, so RTK Query
 * would treat it as a new request; reusing the original cursor (none for page 1) hits the cache.
 * The trail starts over whenever the search, filters, sort or page size change.
 */
export function useCursorTrail(state: ContactListState) {
  const { q, tag, company, createdFrom, createdTo, sort, order, limit } = state;
  const key = JSON.stringify([q, tag, company, createdFrom, createdTo, sort, order, limit]);

  const trail = useRef<Trail>({ key, cursors: new Map() });
  if (trail.current.key !== key) trail.current = { key, cursors: new Map() };
  if (state.page > 1 && state.cursor) trail.current.cursors.set(state.page, state.cursor);

  /** Where Prev goes: the page before, by the cursor that first loaded it when known. */
  return (serverPrevCursor: string) => {
    const page = Math.max(1, state.page - 1);
    if (page === 1) return { page, cursor: '' };
    return { page, cursor: trail.current.cursors.get(page) ?? serverPrevCursor };
  };
}
