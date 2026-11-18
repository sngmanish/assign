import { useEffect, useMemo, useRef, useState } from 'react';
import { HStack, Input, OptionSelect, Text, VStack } from '@crm/ui';
import { FiltersPanel } from './FiltersPanel';
import type { SelectItem } from '@crm/ui';
import type { Tag } from '../../api/types';
import {
  SORT_OPTIONS,
  activeFilterCount,
  parseSortKey,
  sortKeyOf,
  type ContactListState,
  type ListProblems,
  type SortKey,
} from './listState';
import { useSyncedText } from './useSyncedText';
import { useToast } from '../../app/useToast';

interface Props {
  state: ContactListState;
  update: (patch: Partial<ContactListState>, options?: { replace?: boolean }) => void;
  onClearFilters: () => void;
  tags: Tag[];
  problems: ListProblems;
}

const ANY_TAG = '';

/** Search box, the Filters panel and the sort menu. Everything here writes to the URL. */
export function ContactsToolbar({ state, update, onClearFilters, tags, problems }: Props) {
  const toast = useToast();
  // a From date after the To date: say so once, when it happens (the field shows it too)
  const shownDateProblem = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (problems.dates && problems.dates !== shownDateProblem.current) toast.error(problems.dates);
    shownDateProblem.current = problems.dates;
  }, [problems.dates, toast]);

  const [searchText, setSearchText] = useSyncedText(state.q, (q) =>
    update({ q }, { replace: true }),
  );
  const [companyText, setCompanyText] = useSyncedText(state.company, (company) =>
    update({ company }, { replace: true }),
  );

  const tagOptions: SelectItem<string>[] = [
    { label: 'Any tag', value: ANY_TAG },
    ...tags.map((t) => ({ label: t.name, value: t.id })),
  ];

  return (
    // top-aligned: a hint under the search box must not push the buttons down
    <HStack
      spacing={3}
      align="flex-start"
      wrap="wrap"
      style={{ marginBottom: 'var(--hl-space-4)' }}
    >
      <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
        <Input
          type="search"
          size="small"
          placeholder="Search name, email or phone"
          aria-label="Search contacts"
          value={searchText}
          maxLength={100}
          style={{ width: '100%' }}
          onChange={(e) => setSearchText(e.target.value)}
          // the ×: empty the box and the search at once (which also goes back to page 1)
          actions={[
            {
              ariaLabel: 'Clear search',
              onClick: () => {
                setSearchText('');
                update({ q: '' }, { replace: true });
              },
            },
          ]}
          isError={Boolean(problems.search)}
          validationText={problems.search}
        />
      </div>

      <FiltersPanel activeCount={activeFilterCount(state)} onClear={onClearFilters}>
        <VStack spacing={1}>
          <Text size="md" fontFamily="interactive">
            Tag
          </Text>
          <OptionSelect
            ariaLabel="Filter by tag"
            options={tagOptions}
            value={state.tag}
            onChange={(tag) => update({ tag })}
            fullWidth
          />
        </VStack>
        <Input
          id="filter-company"
          size="small"
          label="Company (exact name)"
          value={companyText}
          maxLength={200}
          onChange={(e) => setCompanyText(e.target.value)}
        />
        <HStack spacing={2}>
          <DateFilter
            id="filter-created-from"
            label="Created from"
            value={state.createdFrom}
            onChange={(createdFrom) => update({ createdFrom })}
            error={problems.dates ? '' : undefined}
          />
          <DateFilter
            id="filter-created-to"
            label="Created to"
            value={state.createdTo}
            onChange={(createdTo) => update({ createdTo })}
            error={problems.dates}
          />
        </HStack>
      </FiltersPanel>

      <OptionSelect
        prefix="Sort:"
        ariaLabel="Sort contacts"
        options={SORT_OPTIONS}
        value={sortKeyOf(state)}
        onChange={(key: SortKey) => update(parseSortKey(key))}
      />
    </HStack>
  );
}

/** "dd/mm/yyyy" typed in the masked input -> "yyyy-mm-dd"; '' when cleared; undefined while incomplete or invalid. */
function fromMasked(text: string): string | undefined {
  if (!/\d/.test(text)) return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const valid =
    d.getFullYear() === Number(yyyy) &&
    d.getMonth() === Number(mm) - 1 &&
    d.getDate() === Number(dd);
  return valid ? `${yyyy}-${mm}-${dd}` : undefined;
}

/**
 * A created-date filter. The design-system date input is masked and uncontrolled: it gets the date
 * to show as `selectedDate`, and the URL is only updated once the typed date is complete and valid.
 */
function DateFilter(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** '' marks the field red without a message; a string shows the message. */
  error?: string;
}) {
  const { id, label, value, onChange, error } = props;
  const toast = useToast();
  // a fully typed date that doesn't exist (31/02/2026): red field and a toast
  const [invalid, setInvalid] = useState(false);
  // a stable Date: the input re-writes its text whenever this changes
  const selectedDate = useMemo(() => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y!, m! - 1, d!);
  }, [value]);
  return (
    <Input
      id={id}
      size="small"
      type="date"
      label={label}
      selectedDate={selectedDate}
      onChange={(e) => {
        const text = e.target.value;
        const next = fromMasked(text);
        const typedInFull = /^\d{2}\/\d{2}\/\d{4}$/.test(text);
        if (typedInFull && next === undefined) {
          if (!invalid) toast.error(`${text} is not a valid date`);
          setInvalid(true);
          return;
        }
        setInvalid(false);
        if (next !== undefined && next !== value) onChange(next);
      }}
      isError={invalid || error !== undefined}
      validationText={error || undefined}
    />
  );
}
