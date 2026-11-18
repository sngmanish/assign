import React from 'react';

import classNames from 'classnames';

import type { AvatarProps } from './types/Avatar.types';

import moduleStyles from '../../styles/avatar/index.module.css';

function Avatar({ size = 'md', label = '' }: AvatarProps): React.ReactElement {
  return (
    <div
      className={classNames(
        moduleStyles['hl-avatar'],
        moduleStyles[`hl-avatar__size-${size}`],
        moduleStyles['hl-avatar__type-initial'],
      )}
      aria-hidden
    >
      <span>{label}</span>
    </div>
  );
}

export default Avatar;
