import * as React from 'react';

import { Heading } from '../Heading';

export interface TopBarProps {
  title: string;
  children?: React.ReactNode;
}

function TopBar({ title, children }: TopBarProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--hl-space-3)',
        minHeight: 56,
        flexWrap: 'wrap',
        padding: 'var(--hl-space-2) var(--hl-space-6)',
        borderBottom: '1px solid var(--hl-border)',
        background: 'var(--hl-background)',
      }}
    >
      <Heading level={2} size="md">
        {title}
      </Heading>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--hl-space-3)',
        }}
      >
        {children}
      </div>
    </header>
  );
}

export default TopBar;
