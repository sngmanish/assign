import * as React from 'react';

export interface CloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: '' | 'small';
  className?: string;
  ariaLabel?: string;
}
