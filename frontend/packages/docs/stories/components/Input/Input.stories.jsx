import { useState } from 'react';
import { Input } from '@crm/ui';

export default { title: 'Components/Molecule/Input', component: Input, tags: ['autodocs'] };

export const Text = {
  args: { id: 'first-name', label: 'First name', required: true, defaultValue: 'Ada' },
};
export const WithError = {
  args: {
    id: 'email',
    type: 'email',
    label: 'Email',
    defaultValue: 'ada@',
    isError: true,
    validationText: 'Enter a valid email address',
  },
};
export const Search = {
  render: function Render() {
    const [value, setValue] = useState('');
    return (
      <Input
        type="search"
        size="small"
        placeholder="Search name, email or phone"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        actions={[{ ariaLabel: 'Clear search', onClick: () => setValue('') }]}
      />
    );
  },
};
export const Date = {
  args: { id: 'created-from', type: 'date', size: 'small', label: 'Created from' },
};
