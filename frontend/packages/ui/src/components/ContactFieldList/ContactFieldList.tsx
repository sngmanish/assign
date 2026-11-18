import * as React from 'react';

import { Text } from '../Text';

export interface ContactFieldListProps {
  fields: { name: string; label: string }[];
  /** Empty string = no value (shown as "—"). */
  values: Record<string, string>;
}

/** The contact's fields as a read-only list. `ContactForm` is the edit form for the same fields. */
function ContactFieldList({ fields, values }: ContactFieldListProps) {
  return (
    <dl style={{ margin: 0, display: 'grid', gap: 'var(--hl-space-3)' }}>
      {fields.map((f) => (
        <div key={f.name}>
          <dt>
            <Text size="sm" color="var(--hl-muted-foreground)">
              {f.label}
            </Text>
          </dt>
          <dd style={{ margin: 0, overflowWrap: 'anywhere' }}>
            <Text>{values[f.name] || '—'}</Text>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default ContactFieldList;
