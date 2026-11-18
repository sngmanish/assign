import * as React from 'react';

export interface ActionBarProps {
  size?: string;
  actions?: Array<() => React.ReactElement> | null;
  disableActions?: boolean;
}
