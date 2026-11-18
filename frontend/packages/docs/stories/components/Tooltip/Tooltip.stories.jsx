import { Tooltip } from '@crm/ui';

export default { title: 'Components/Atomic/Tooltip', component: Tooltip, tags: ['autodocs'] };

export const Default = {
  render: () => (
    <div style={{ padding: 40 }}>
      <Tooltip text="hiroshi.perez.5349@vandelayindustries.com">
        <span
          style={{
            display: 'inline-block',
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          hiroshi.perez.5349@vandelayindustries.com
        </span>
      </Tooltip>
    </div>
  ),
};
