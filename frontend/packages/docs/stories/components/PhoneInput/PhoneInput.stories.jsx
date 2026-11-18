import { PhoneInput } from '@crm/ui/components/PhoneInput/index';

export default {
  title: 'Components/Molecule/PhoneInput',
  component: PhoneInput,
  tags: ['autodocs'],
};

export const Default = {
  args: {
    label: 'Phone',
    identifier: 'story-phone',
    defaultCountryCode: 'US',
    defaultCallingCode: '+1',
    defaultPhoneNumber: '5145550385',
    inputStyles: { width: '100%' },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <PhoneInput {...args} />
    </div>
  ),
};
