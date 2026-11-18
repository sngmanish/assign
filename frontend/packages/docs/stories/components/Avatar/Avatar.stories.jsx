import { Avatar } from '@crm/ui';

export default {
  title: 'Components/Atomic/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: { label: 'AL', size: 'md' },
};

export const Default = {};
export const Sizes = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <Avatar size="sm" label="AL" />
      <Avatar size="md" label="AL" />
      <Avatar size="lg" label="AL" />
    </div>
  ),
};
