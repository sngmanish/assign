import type React from 'react';

export interface TagProps {
  label?: string;
  closable?: boolean;
  onClose?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  labelStyles?: React.CSSProperties;
}
