import { useMemo, useState } from 'react';
import { Table, Tag, Text, useTable } from '@crm/ui';
import PlusIcon from '@crm/ui/icons/react/PlusIcon';

export default { title: 'Components/Organism/Table', tags: ['autodocs'] };

const PEOPLE = [
  ['Ada', 'Lovelace', 'ada@analytical.io', 'Analytical', ['VIP'], '2025-11-02'],
  ['Grace', 'Hopper', 'grace@navy.mil', 'US Navy', ['Lead', 'Customer'], '2025-10-14'],
  ['Alan', 'Turing', 'alan@bletchley.uk', 'Bletchley', [], '2025-09-30'],
  ['Katherine', 'Johnson', 'kj@nasa.gov', 'NASA', ['Customer'], '2025-12-01'],
  ['Edsger', 'Dijkstra', 'ewd@utexas.edu', 'UT Austin', ['Partner', 'Lead', 'VIP'], '2025-08-21'],
].map(([first, last, email, company, tags, created], i) => ({
  id: String(i + 1),
  first,
  last,
  email,
  company,
  tags,
  created,
}));

const COLUMNS = [
  {
    id: 'name',
    header: 'Name',
    accessorFn: (r) => `${r.last} ${r.first}`,
    minSize: 200,
    cell: ({ row }) => `${row.original.first} ${row.original.last}`,
  },
  {
    id: 'email',
    header: 'Email',
    minSize: 200,
    cell: ({ row }) => row.original.email,
  },
  {
    id: 'company',
    header: 'Company',
    minSize: 140,
    cell: ({ row }) => row.original.company,
  },
  {
    id: 'tags',
    header: 'Tags',
    minSize: 180,
    cell: ({ row }) =>
      row.original.tags.length ? (
        <div style={{ display: 'flex', gap: 4 }}>
          {row.original.tags.map((t) => (
            <Tag key={t} label={t} />
          ))}
        </div>
      ) : (
        '—'
      ),
  },
  {
    id: 'created',
    header: 'Created',
    accessorFn: (r) => r.created,
    size: 130,
    cell: ({ row }) => row.original.created,
  },
];

const ContactsTable = ({ rows = PEOPLE, isLoading = false, search = '' }) => {
  const [sorting, setSorting] = useState([{ id: 'created', desc: true }]);
  const sorted = useMemo(() => {
    const [s] = sorting;
    if (!s) return rows;
    const key = s.id === 'name' ? (r) => `${r.last} ${r.first}` : (r) => r.created;
    return [...rows].sort((a, b) => key(a).localeCompare(key(b)) * (s.desc ? -1 : 1));
  }, [rows, sorting]);

  const table = useTable({
    columns: COLUMNS,
    rows: sorted,
    isLoading,
    loadingLayout: { count: 5 },
    maxHeight: '420px',
    sorting,
    onSortingChange: (next) =>
      setSorting(next.length ? next : [{ ...sorting[0], desc: !sorting[0].desc }]),
    rowSelection: { enabled: true, getRowLabel: (r) => `Select ${r.first} ${r.last}` },
    bulkActionsMetadata: {
      totalDataCount: sorted.length,
      primaryActions: [{ label: 'Add tag', icon: () => <PlusIcon />, onClick: () => {} }],
    },
    paginationMetadata: {
      currentPage: 1,
      totalResults: sorted.length,
      initialRow: { label: '20', value: 20 },
      rowList: [20, 50, 100].map((n) => ({ label: String(n), value: n })),
      showRowsPerPage: true,
      title: 'Contacts per page',
      pageLabel: 'Page',
      totalPagesLabel: 'of ${totalPagesCount}',
    },
    searchInputMetadata: { value: search },
    noDataConfig: {
      content: <Text>No contacts match these filters</Text>,
      action: { label: 'Clear filters', onClick: () => {} },
    },
    noSearchResultsConfig: {
      content: <Text>No contacts match your search or filters</Text>,
      action: { label: 'Clear filters', onClick: () => {} },
    },
  });
  return <Table table={table} />;
};

export const Contacts = { render: () => <ContactsTable /> };
export const Loading = { render: () => <ContactsTable isLoading /> };
export const NoResultsForFilters = { render: () => <ContactsTable rows={[]} /> };
export const NoResultsForSearch = { render: () => <ContactsTable rows={[]} search="zzz" /> };
