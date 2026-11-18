import { Tag } from '@crm/ui';

export default {
  title: 'Components/Atomic/Tag',
  component: Tag,
  tags: ['autodocs'],
  args: { label: 'Customer' },
};

export const Default = {};
export const Removable = { args: { closable: true, onClose: () => {} } };
