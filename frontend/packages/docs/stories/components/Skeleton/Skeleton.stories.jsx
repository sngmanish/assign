import { Skeleton } from '@crm/ui';

export default { title: 'Components/Atomic/Skeleton', component: Skeleton, tags: ['autodocs'] };

export const Bars = {
  render: () => (
    <div style={{ width: 320 }}>
      <Skeleton count={4} height={40} style={{ display: 'block', marginBottom: 12 }} />
    </div>
  ),
};
export const Circle = { args: { circle: true, width: 48, height: 48 } };
