import { useState } from 'react';
import { Pagination } from '@crm/ui/components/Pagination/index';

export default {
  title: 'Components/Molecule/Pagination',
  component: Pagination,
  tags: ['autodocs'],
};

export const ContactsFooter = {
  render: function Render() {
    const [page, setPage] = useState(3);
    const [size, setSize] = useState({ label: '20', value: 20 });
    return (
      <Pagination
        currentPage={page}
        totalResults={372}
        initialRow={size}
        rowList={[20, 50, 100].map((n) => ({ label: String(n), value: n }))}
        showRowsPerPage
        title="Contacts per page"
        pageLabel="Page"
        totalPagesLabel="of ${totalPagesCount}"
        onChange={setSize}
        onPageChange={setPage}
      />
    );
  },
};
