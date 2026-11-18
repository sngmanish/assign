import type * as React from 'react';

export interface FormProps extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  'className' | 'style'
> {
  children: React.ReactNode;
}

export interface FormItemProps {
  children: React.ReactNode;
}
