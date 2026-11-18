import * as React from 'react';

export interface PrefixProps {
  prefix?: string | (() => React.ReactElement) | null;
  id?: string;
}
