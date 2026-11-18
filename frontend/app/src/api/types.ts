// Shapes of the backend's JSON (see the README's API section, or /docs on the running API).

export interface Tag {
  id: string;
  name: string;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  /** Changes on every edit; send it back with an update (optimistic locking). */
  version: number;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export type ContactSort = 'name' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

/** Query parameters of GET /contacts. Everything is optional. */
export interface ContactListParams {
  q?: string;
  tag?: string;
  company?: string;
  createdFrom?: string;
  createdTo?: string;
  sort?: ContactSort;
  order?: SortOrder;
  limit?: number;
  cursor?: string;
  page?: number;
}

export interface ContactList {
  items: Contact[];
  nextCursor: string | null;
  prevCursor: string | null;
  /** Exact up to 10,000 matches, otherwise the string "10000+". */
  total: number | '10000+';
  totalPages: number | null;
  /** True when there are more than 10,000 matches (paging by page number is not available). */
  capped: boolean;
  page: number | null;
}

export type ActivityType = 'CONTACT_UPDATED' | 'TAG_ADDED' | 'TAG_REMOVED';

export interface Activity {
  id: string;
  contactId: string;
  type: ActivityType;
  createdAt: string;
  /** Demo "acting as" name; null for events recorded before it existed. */
  actor: string | null;
  /** CONTACT_UPDATED: { changes: { field: { old, new } } }. TAG_*: { tagId, tagName }. */
  details: Record<string, unknown>;
}

export interface TagList {
  items: Tag[];
  hasMore: boolean;
}

export interface ActivityList {
  items: Activity[];
}

/** The editable fields of a contact (what PATCH /contacts/:id accepts besides `version`). */
export type ContactFields = Pick<Contact, 'firstName' | 'lastName' | 'email' | 'phone' | 'company'>;
export type ContactFieldName = keyof ContactFields;

/** A tag to add: an existing one by id, or a new (or existing, matched ignoring case) one by name. */
export type TagRef = { tagId: string; name?: never } | { name: string; tagId?: never };

export interface BulkAssignResult {
  added: number;
  alreadyTagged: number;
  notFound: number;
}
