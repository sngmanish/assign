import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseListState, toSearchParams, type ContactListState } from './listState';

/** Keys that move within the same results; changing any other key goes back to the first page. */
const PAGING_KEYS: (keyof ContactListState)[] = ['page', 'cursor'];

/**
 * The contact list's state, kept in the URL query string so Back and refresh keep it.
 * `update` merges a change in; anything other than the page itself returns to page 1.
 */
export function useContactListState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseListState(searchParams), [searchParams]);

  // react-router's functional update is not queued like setState: two changes in one tick (the
  // table's page-size menu fires two) would both start from the same old URL and the second would
  // undo the first. So changes build on this ref, which always holds the newest URL.
  const latest = useRef(searchParams);
  latest.current = searchParams;

  const update = useCallback(
    (patch: Partial<ContactListState>, options?: { replace?: boolean }) => {
      const current = parseListState(latest.current);
      const changesResults = (Object.keys(patch) as (keyof ContactListState)[]).some(
        (key) => !PAGING_KEYS.includes(key),
      );
      const next = toSearchParams({
        ...current,
        ...patch,
        ...(changesResults ? { page: 1, cursor: '' } : {}),
        // a page number on its own means "go to that page": drop any cursor (which would win)
        ...(!changesResults && 'page' in patch && !('cursor' in patch) ? { cursor: '' } : {}),
        // with a cursor, `page` only labels the position ("Page 3"); the API gets the cursor alone
      });
      latest.current = next;
      setSearchParams(next, { replace: options?.replace });
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(
    () => update({ tag: '', company: '', createdFrom: '', createdTo: '' }),
    [update],
  );
  const clearAll = useCallback(
    () => update({ q: '', tag: '', company: '', createdFrom: '', createdTo: '' }),
    [update],
  );

  return { state, update, clearFilters, clearAll };
}
