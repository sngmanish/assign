import type { ContactListParams, ContactSort, SortOrder } from '../../api/types';

// Everything about the contact list that the URL remembers: search, filters, sort, page size and
// page. Pure functions, so they can be reasoned about (and later tested) without React.

export const PAGE_SIZES = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_SEARCH_WORDS = 5; // the API rejects a longer search

export interface ContactListState {
  q: string;
  tag: string;
  company: string;
  createdFrom: string;
  createdTo: string;
  sort: ContactSort;
  order: SortOrder;
  limit: number;
  /** Page number (1-based). Only used while the API can count exactly. */
  page: number;
  /** Opaque cursor, used to page through results too long to number. Wins over `page`. */
  cursor: string;
}

/** The order each sort starts in (what the API does when none is given). */
export const defaultOrder = (sort: ContactSort): SortOrder => (sort === 'name' ? 'asc' : 'desc');

const isSort = (v: string | null): v is ContactSort => v === 'name' || v === 'createdAt';
const isOrder = (v: string | null): v is SortOrder => v === 'asc' || v === 'desc';

/** A yyyy-mm-dd date from the URL, or '' (a hand-edited or broken value is ignored, not sent to the API). */
const isoDate = (v: string | null): string => {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(v) : null;
  if (!v || !m) return '';
  // strict: Date.parse accepts impossible days such as 2026-02-31
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === v ? v : '';
};

export function parseListState(sp: URLSearchParams): ContactListState {
  const sort = isSort(sp.get('sort')) ? (sp.get('sort') as ContactSort) : 'createdAt';
  const orderParam = sp.get('order');
  const limit = Number(sp.get('limit'));
  const page = Number(sp.get('page'));
  return {
    q: (sp.get('q') ?? '').trim(),
    tag: sp.get('tag') ?? '',
    company: sp.get('company') ?? '',
    createdFrom: isoDate(sp.get('createdFrom')),
    createdTo: isoDate(sp.get('createdTo')),
    sort,
    order: isOrder(orderParam) ? orderParam : defaultOrder(sort),
    limit: (PAGE_SIZES as readonly number[]).includes(limit) ? limit : DEFAULT_PAGE_SIZE,
    page: Number.isInteger(page) && page > 1 ? page : 1,
    cursor: sp.get('cursor') ?? '',
  };
}

/** The URL for a state. Defaults are left out so the address stays short. */
export function toSearchParams(state: ContactListState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set('q', state.q);
  if (state.tag) sp.set('tag', state.tag);
  if (state.company) sp.set('company', state.company);
  if (state.createdFrom) sp.set('createdFrom', state.createdFrom);
  if (state.createdTo) sp.set('createdTo', state.createdTo);
  if (state.sort !== 'createdAt') sp.set('sort', state.sort);
  if (state.order !== defaultOrder(state.sort)) sp.set('order', state.order);
  if (state.limit !== DEFAULT_PAGE_SIZE) sp.set('limit', String(state.limit));
  if (state.cursor) sp.set('cursor', state.cursor);
  // without a cursor `page` is the page asked for; with one it only labels the position
  if (state.page > 1) sp.set('page', String(state.page));
  return sp;
}

/** The query the API wants. `page` is left out for page 1: the API refuses it above its count cap. */
export function toApiParams(state: ContactListState): ContactListParams {
  return {
    q: state.q,
    tag: state.tag,
    company: state.company,
    createdFrom: state.createdFrom,
    createdTo: state.createdTo,
    sort: state.sort,
    order: state.order,
    limit: state.limit,
    ...(state.cursor ? { cursor: state.cursor } : state.page > 1 ? { page: state.page } : {}),
  };
}

/** Filters in the Filters panel (search is separate). */
export const activeFilterCount = (s: ContactListState): number =>
  [s.tag, s.company, s.createdFrom, s.createdTo].filter(Boolean).length;

export const searchWordCount = (q: string): number => q.split(/\s+/).filter(Boolean).length;

export interface ListProblems {
  search?: string;
  dates?: string;
}

/** Things the API would refuse, caught here so the user gets a hint instead of an error. */
export function validateListState(s: ContactListState): ListProblems {
  const problems: ListProblems = {};
  if (searchWordCount(s.q) > MAX_SEARCH_WORDS) {
    problems.search = `Use at most ${MAX_SEARCH_WORDS} search words`;
  }
  if (s.createdFrom && s.createdTo && s.createdFrom > s.createdTo) {
    problems.dates = 'The start date must be on or before the end date';
  }
  return problems;
}

export type SortKey = `${ContactSort}:${SortOrder}`;

export const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Newest first', value: 'createdAt:desc' },
  { label: 'Oldest first', value: 'createdAt:asc' },
  { label: 'Name A to Z', value: 'name:asc' },
  { label: 'Name Z to A', value: 'name:desc' },
];

export const sortKeyOf = (s: ContactListState): SortKey => `${s.sort}:${s.order}`;

export function parseSortKey(key: SortKey): { sort: ContactSort; order: SortOrder } {
  const [sort, order] = key.split(':') as [ContactSort, SortOrder];
  return { sort, order };
}
