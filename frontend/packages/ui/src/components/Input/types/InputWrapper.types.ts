import * as React from 'react';

export interface InputWrapperProps {
  label?: string;
  id?: string;
  required?: boolean;
  isError?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
  validationText?: string;
  className?: string;
  accessibleErrorText?: string;
}
