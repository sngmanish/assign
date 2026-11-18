import { Badge } from '@crm/ui';

export default {
  title: 'Components/Atomic/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { count: 372, overflowCount: 10000, showZero: true },
};

export const Count = {};
export const OverTheCap = { args: { count: 10001 } };
export const Zero = { args: { count: 0 } };
