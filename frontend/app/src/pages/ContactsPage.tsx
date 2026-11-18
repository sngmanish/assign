import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  CursorPager,
  Table,
  ErrorState,
  HStack,
  Button,
  PageHeader,
  PlusIcon,
  Text,
  useTable,
  BUTTON_VARIANT,
} from '@crm/ui';
import { useGetContactsQuery, useGetTagsQuery } from '../api/contactsApi';
import { isApiError } from '../api/errors';
import {
  toApiParams,
  activeFilterCount,
  validateListState,
  PAGE_SIZES,
} from '../features/contacts/listState';
import { useContactListState } from '../features/contacts/useContactListState';
import { contactColumns, toRow, type ContactRow } from '../features/contacts/columns';
import { ContactsToolbar } from '../features/contacts/ContactsToolbar';
import { BulkTagDialog } from '../features/contacts/BulkTagDialog';
import { defaultOrder } from '../features/contacts/listState';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { cleared, setAll } from '../store/selectionSlice';

const EMPTY_TAGS: never[] = [];
const AddTagIcon = () => <PlusIcon />;
const COLUMN_FOR_SORT = { name: 'name', createdAt: 'created' } as const;
const SORT_FOR_COLUMN = { name: 'name', created: 'createdAt' } as const;

export function ContactsPage() {
  const dispatch = useAppDispatch();
  const { state, update, clearFilters, clearAll } = useContactListState();
  const [bulkOpen, setBulkOpen] = useState(false);

  // Hints for things the API would refuse (more than 5 search words, From after To). While the
  // user fixes them, the last request without problems keeps being sent, so the last good results
  // (and count) stay on screen instead of jumping to "all contacts".
  const problems = validateListState(state);
  const hasProblems = Boolean(problems.search || problems.dates);
  const candidate = toApiParams(state);
  // on a first load with a problem (a hand-edited link) there is nothing good yet: start from the
  // request with the bad parts left out, so the API never sees them
  const lastGood = useRef(
    hasProblems
      ? toApiParams({
          ...state,
          q: problems.search ? '' : state.q,
          createdFrom: problems.dates ? '' : state.createdFrom,
          createdTo: problems.dates ? '' : state.createdTo,
        })
      : candidate,
  );
  if (!hasProblems) lastGood.current = candidate;
  // RTK Query compares serialized arguments, so a new object each render does not refetch
  const apiParams = hasProblems ? lastGood.current : candidate;

  const { data, error, isLoading, isFetching, refetch } = useGetContactsQuery(apiParams);
  const tags = useGetTagsQuery().data?.items ?? EMPTY_TAGS;

  const exactTotal = typeof data?.total === 'number' ? data.total : null;
  const rows = useMemo(() => (data?.items ?? []).map(toRow), [data]);
  const filtersApplied = activeFilterCount(state) > 0;

  // A page that no longer exists (a shorter list, or an edited URL): go to the last one.
  useEffect(() => {
    if (data?.totalPages && state.page > data.totalPages && !state.cursor) {
      update({ page: data.totalPages }, { replace: true });
    }
  }, [data?.totalPages, state.page, state.cursor, update]);

  const selectedIds = useAppSelector((s) => s.selection.ids);
  const selectedCount = selectedIds.length;
  const clearSelection = () => {
    table.setRowSelection({});
    dispatch(cleared());
  };

  const table = useTable({
    columns: contactColumns,
    rows,
    isLoading,
    loadingLayout: { count: Math.min(state.limit, 10) },
    maxHeight: 'calc(100vh - 360px)',

    // the search box is in the toolbar; the table only needs the applied text (for its empty state)
    searchInputMetadata: { value: state.q },

    // sorting is done by the server; the table only shows which column and direction
    sorting: [{ id: COLUMN_FOR_SORT[state.sort], desc: state.order === 'desc' }],
    onSortingChange: (next: { id: string; desc: boolean }[]) => {
      const first = next[0];
      if (!first) {
        // the third click would remove the sort: flip the direction instead
        update({ order: state.order === 'asc' ? 'desc' : 'asc' });
      } else {
        const sort = SORT_FOR_COLUMN[first.id as keyof typeof SORT_FOR_COLUMN];
        if (sort === state.sort) update({ order: first.desc ? 'desc' : 'asc' });
        else update({ sort, order: defaultOrder(sort) });
      }
    },

    rowSelection: {
      // each row's checkbox is read out as "Select Ada Lovelace"
      getRowLabel: (row) => {
        const { contact } = row as ContactRow;
        return `Select ${contact.firstName} ${contact.lastName}`;
      },
    },

    // the bulk bar: selection covers the current page only
    bulkActionsMetadata: {
      selectedDataCount: selectedCount,
      totalDataCount: rows.length,
      primaryActions: [
        {
          label: 'Add tag',
          icon: AddTagIcon,
          onClick: () => setBulkOpen(true),
        },
        { label: 'Clear', onClick: () => clearSelection() },
      ],
    },

    // page numbers while the API can count exactly; otherwise the Prev/Next below
    paginationMetadata:
      exactTotal === null
        ? undefined
        : {
            currentPage: state.page,
            totalResults: exactTotal,
            initialRow: { label: String(state.limit), value: state.limit },
            rowList: PAGE_SIZES.map((n) => ({ label: String(n), value: n })),
            showRowsPerPage: true,
            title: 'Contacts per page',
            pageLabel: 'Page',
            totalPagesLabel: 'of ${totalPagesCount}',
            onChange: (option: { value: number }) => update({ limit: option.value }),
            onPageChange: (page: number) => update({ page }),
          },

    noDataConfig: filtersApplied
      ? {
          content: <Text>No contacts match these filters</Text>,
          action: { label: 'Clear filters', onClick: clearFilters },
        }
      : { content: <Text>There are no contacts yet</Text> },
    noSearchResultsConfig: {
      content: <Text>No contacts match your search or filters</Text>,
      action: { label: 'Clear filters', onClick: clearAll },
    },
  });

  // Selection covers the current page only: it starts over whenever the results change.
  const resultsKey = JSON.stringify(apiParams);
  useEffect(() => {
    table.setRowSelection({});
    dispatch(cleared());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsKey]);
  // ...and rows that leave the page (a refetch with the same request can still change them) are
  // dropped from it, so a bulk action never reaches contacts that are no longer shown
  useEffect(() => {
    const onPage = new Set(rows.map((r) => r.id));
    const selection = (table.rowSelectionState ?? {}) as Record<string, boolean>;
    if (Object.keys(selection).some((id) => !onPage.has(id))) {
      table.setRowSelection(
        Object.fromEntries(Object.entries(selection).filter(([id]) => onPage.has(id))),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  const selectedKey = Object.keys(table.rowSelectionState ?? {}).join(',');
  useEffect(() => {
    dispatch(setAll(selectedKey ? selectedKey.split(',') : []));
  }, [selectedKey, dispatch]);

  const apiError = isApiError(error) ? error : undefined;
  // a 400 (e.g. a stale or hand-edited link) fails the same way on Retry, so it gets a way out instead
  const badQuery = apiError?.kind === 'bad-request';
  const pageNotAllowed = badQuery && apiError.code === 'PAGE_NOT_ALLOWED';

  return (
    <PageHeader
      heading="Contacts"
      actions={() =>
        data ? (
          <HStack spacing={2} align="center">
            <Badge
              count={data.capped ? 10_001 : (exactTotal ?? 0)}
              overflowCount={10_000}
              showZero
            />
            <Text>contacts</Text>
          </HStack>
        ) : null
      }
    >
      <ContactsToolbar
        state={state}
        update={update}
        onClearFilters={clearFilters}
        tags={tags}
        problems={problems}
      />

      {error && !data && !badQuery ? (
        <ErrorState
          title="Couldn't load contacts"
          description={apiError?.message}
          onRetry={refetch}
          retrying={isFetching}
        />
      ) : null}

      {error && (data || badQuery) ? (
        <div role="alert" style={{ marginBottom: 'var(--hl-space-4)' }}>
          <HStack spacing={3} align="center">
            <Text color="var(--hl-destructive, #b91c1c)">
              {pageNotAllowed
                ? 'Page numbers are not available for results this long.'
                : badQuery
                  ? "This link has a search, filter or page the server can't use."
                  : (apiError?.message ?? 'Something went wrong.')}
            </Text>
            {pageNotAllowed ? (
              <Button
                label="Back to the first page"
                variant={BUTTON_VARIANT.SECONDARY}
                size="small"
                onClick={() => update({ page: 1, cursor: '' })}
              />
            ) : badQuery ? (
              <Button
                label="Start over"
                variant={BUTTON_VARIANT.SECONDARY}
                size="small"
                onClick={clearAll}
              />
            ) : (
              <Button
                label="Retry"
                variant={BUTTON_VARIANT.SECONDARY}
                size="small"
                onClick={refetch}
              />
            )}
          </HStack>
        </div>
      ) : null}

      {/* without data, an error means there are no rows to show (not "no contacts yet") */}
      {(data || !error) && (
        <div
          aria-busy={isFetching}
          style={{
            opacity: isFetching && !isLoading ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Table table={table} />
        </div>
      )}

      <BulkTagDialog
        visible={bulkOpen}
        contactIds={selectedIds}
        tags={tags}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          setBulkOpen(false);
          clearSelection();
        }}
      />

      {data?.capped && (
        <CursorPager
          noun="Contacts"
          hasPrev={Boolean(data.prevCursor)}
          hasNext={Boolean(data.nextCursor)}
          onPrev={() =>
            data.prevCursor &&
            update({
              cursor: data.prevCursor,
              page: Math.max(1, state.page - 1),
            })
          }
          onNext={() =>
            data.nextCursor && update({ cursor: data.nextCursor, page: state.page + 1 })
          }
          page={state.page}
          rowCount={data.items.length}
          totalLabel="10,000+"
          pageSize={state.limit}
          pageSizes={[...PAGE_SIZES]}
          onPageSizeChange={(limit) => update({ limit })}
          disabled={isFetching}
        />
      )}
    </PageHeader>
  );
}
