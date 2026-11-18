import { BulkAction } from '@crm/ui/components/BulkAction/index';
import PlusIcon from '@crm/ui/icons/react/PlusIcon';

export default {
  title: 'Components/Molecule/BulkAction',
  component: BulkAction,
  tags: ['autodocs'],
  args: {
    selectedDataCount: 3,
    totalDataCount: 20,
    selectAllButtonProps: { label: 'Select All', onClick: () => {} },
    primaryActions: [
      { label: 'Add tag', icon: () => <PlusIcon />, onClick: () => {} },
      { label: 'Clear', onClick: () => {} },
    ],
  },
};

export const ContactsBulkBar = {};
