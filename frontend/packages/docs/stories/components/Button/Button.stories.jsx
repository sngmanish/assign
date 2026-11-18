import { Button } from '@crm/ui';
import PlusIcon from '@crm/ui/icons/react/PlusIcon';

export default {
  title: 'Components/Atomic/Button',
  component: Button,
  tags: ['autodocs'],
  args: { label: 'Save', variant: 'primary', size: 'medium' },
};

export const Primary = {};
export const Secondary = { args: { label: 'Cancel', variant: 'secondary' } };
export const TertiaryWithIcon = {
  args: { label: 'Add tag', variant: 'tertiary', size: 'small', icon: () => <PlusIcon /> },
};
export const WithMenuArrow = {
  args: { label: 'Sort: Newest first', variant: 'secondary', size: 'small', arrowIcon: 'down' },
};
export const Loading = { args: { loading: true } };
