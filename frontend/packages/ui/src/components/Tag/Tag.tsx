import React from 'react';

import classNames from 'classnames';

import type { TagProps } from './types/Tag.types';

import { Close } from '../Close';

import moduleStyles from '../../styles/tag/index.module.css';

export type { TagProps };

// eslint-disable-next-line react/display-name
const Tag = React.forwardRef<HTMLSpanElement, TagProps>((props, ref) => {
  const {
    label = '',
    closable = false,
    onClose = () => {},
    className = '',
    labelStyles = {},
  } = props;

  const handleClose = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClose(event);
  };

  return (
    <span
      ref={ref}
      className={classNames(moduleStyles['hl-tag'], moduleStyles['hl-tag--default'], {
        [className]: !!className,
      })}
    >
      <span className={moduleStyles['label']} style={labelStyles}>
        {label}
      </span>
      {closable && (
        <Close
          className={moduleStyles['hl-tag-cross']}
          size="small"
          ariaLabel={`Remove ${label}`}
          onClick={handleClose}
        />
      )}
    </span>
  );
});

export default Tag;
