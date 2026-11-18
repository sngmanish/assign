import * as React from 'react';

import classNames from 'classnames';

import type { CloseProps } from './types/Close.types';

import styles from '../../styles/close/index.module.css';
import Cross2Icon from '../../icons/react/Cross2Icon';
export type { CloseProps };

const Close = React.forwardRef<HTMLButtonElement, CloseProps>(
  ({ size = '', className = '', ariaLabel = 'Close', ...props }, ref) => {
    const closeBtnClasses = classNames({
      [styles['hl-close']]: true,
      [styles['hl-btn']]: true,
      [styles[`hl-btn_size--${size}`]]: !!size,
      [styles['hl-btn_icon-stand-alone']]: true,
      [className]: !!className,
    });

    return (
      <button ref={ref} type="button" className={closeBtnClasses} aria-label={ariaLabel} {...props}>
        <Cross2Icon aria-hidden="true" />
      </button>
    );
  },
);

Close.displayName = 'Close';

export default Close;
