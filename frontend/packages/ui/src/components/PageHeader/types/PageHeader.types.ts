import * as React from 'react';

export interface PageHeaderProps {
  heading?: string;
  children?: React.ReactNode;
  actions?: () => React.ReactNode;
}
