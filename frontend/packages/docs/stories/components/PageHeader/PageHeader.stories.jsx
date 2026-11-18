import React from 'react';
import { Badge, HStack, PageHeader, Text } from '@crm/ui';

export default {
  title: 'Components/Molecule/PageHeader',
  component: PageHeader,
};

export const WithCountBadge = {
  name: 'Title + count badge',
  render: () => (
    <PageHeader
      heading="Contacts"
      actions={() => (
        <HStack spacing={2} align="center">
          <Badge count={10_001} overflowCount={10_000} showZero />
          <Text>contacts</Text>
        </HStack>
      )}
    >
      <Text>The toolbar and the table go here.</Text>
    </PageHeader>
  ),
};
