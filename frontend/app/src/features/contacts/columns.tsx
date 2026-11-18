import { Link, useLocation } from 'react-router-dom';
import styles from './columns.module.css';
import { Avatar, HStack, Tag, Text, Tooltip } from '@crm/ui';
import type { TableColumnDef, TableRowData } from '@crm/ui';
import type { Contact } from '../../api/types';

/** A table row: the table needs an `id`; the contact rides along. */
export interface ContactRow extends TableRowData {
  contact: Contact;
}

export const toRow = (contact: Contact): ContactRow => ({ id: contact.id, contact });

const contactOf = (row: { original: TableRowData }): Contact =>
  (row.original as ContactRow).contact;

/** What to show where a contact has no value. */
const Missing = () => <Text color="var(--hl-muted-foreground)">—</Text>;

/** A value that may be cut off: one line with an ellipsis, the full text in a tooltip. */
const textOrDash = (value: string | null) =>
  value ? (
    <Tooltip text={value}>
      <span
        style={{
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <Text>{value}</Text>
      </span>
    </Tooltip>
  ) : (
    <Missing />
  );

export const initials = (c: Contact) =>
  `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase();

const VISIBLE_TAGS = 2;

/** State a detail page gets from the list: the list's query string, for its back arrow. */
export interface FromListState {
  listSearch: string;
}

/** The name, as a link to the contact. It carries the list's URL state so Back returns to it. */
function NameLink({ contact }: { contact: Contact }) {
  const { search } = useLocation();
  return (
    <Link
      to={`/contacts/${contact.id}`}
      state={{ listSearch: search } satisfies FromListState}
      className={styles.nameLink}
    >
      {contact.firstName} {contact.lastName}
    </Link>
  );
}

/**
 * Columns with a `size` keep it; the others share the free width. Name and Created have an
 * accessor, which gives them a sort button (the server does the sorting).
 */
export const contactColumns: TableColumnDef[] = [
  {
    id: 'name',
    header: 'Name',
    accessorFn: (row) =>
      `${contactOf({ original: row }).lastName} ${contactOf({ original: row }).firstName}`,
    minSize: 200,
    cell: ({ row }) => {
      const c = contactOf(row);
      return (
        <HStack spacing={2} align="center">
          <Avatar size="sm" label={initials(c)} />
          <NameLink contact={c} />
        </HStack>
      );
    },
  },
  {
    id: 'email',
    header: 'Email',
    minSize: 220,
    cell: ({ row }) => textOrDash(contactOf(row).email),
  },
  {
    id: 'phone',
    header: 'Phone',
    size: 170,
    cell: ({ row }) => textOrDash(contactOf(row).phone),
  },
  {
    id: 'company',
    header: 'Company',
    minSize: 160,
    cell: ({ row }) => textOrDash(contactOf(row).company),
  },
  {
    id: 'tags',
    header: 'Tags',
    minSize: 200,
    cell: ({ row }) => {
      const { tags } = contactOf(row);
      if (tags.length === 0) return <Missing />;
      const rest = tags.slice(VISIBLE_TAGS);
      return (
        <HStack spacing={1} align="center">
          {tags.slice(0, VISIBLE_TAGS).map((t) => (
            <Tag key={t.id} label={t.name} />
          ))}
          {rest.length > 0 && (
            <Tooltip text={rest.map((t) => t.name).join(', ')}>
              {/* focusable, so keyboard users get the tooltip too */}
              <span
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focus only shows the tooltip; the label carries the names
                tabIndex={0}
                aria-label={`${rest.length} more tags: ${rest.map((t) => t.name).join(', ')}`}
              >
                <Tag label={`+${rest.length}`} />
              </span>
            </Tooltip>
          )}
        </HStack>
      );
    },
  },
  {
    id: 'created',
    header: 'Created',
    accessorFn: (row) => contactOf({ original: row }).createdAt,
    size: 130,
    cell: ({ row }) => {
      const created = new Date(contactOf(row).createdAt);
      return (
        <Tooltip text={created.toLocaleString()}>
          <span>
            {created.toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </Tooltip>
      );
    },
  },
];
