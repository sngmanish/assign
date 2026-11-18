import * as React from 'react';

export interface ModalProps {
  children: React.ReactNode;
  isVisible?: boolean;
  closeModal?: (e?: KeyboardEvent | React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
}

export interface ModalHeaderProps {
  title?: string;
  closeModal?: (e?: React.MouseEvent) => void;
  uniqueId?: string;
}

export interface ModalBodyProps {
  children?: React.ReactNode;
  uniqueId?: string;
}
