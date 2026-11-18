import React from 'react';

import classNames from 'classnames';

import type { BadgeProps } from './types/Badge.types';

import { Tag } from '../Tag';

import styles from '../../styles/badge/index.module.css';

export type { BadgeProps };

/** A grey count pill ("372", "10,000+"). Hidden at 0 unless `showZero`. */
function Badge({ count = 0, overflowCount = 99, showZero = false }: BadgeProps) {
  if (count === 0 && !showZero) return null;

  return (
    <div className={styles['hl-badge-wrapper']}>
      <span className={styles['hl-badge']}>
        <Tag
          label={
            count > overflowCount ? `${overflowCount.toLocaleString()}+` : count.toLocaleString()
          }
          className={classNames(
            styles['hl-badge__content'],
            styles['hl-badge__content--grey'],
            styles['hl-badge__content--filled'],
          )}
          labelStyles={{ minWidth: '8px', textAlign: 'center' }}
        />
      </span>
    </div>
  );
}

export default Badge;
