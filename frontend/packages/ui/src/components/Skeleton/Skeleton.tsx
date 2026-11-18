import React from 'react';

import classNames from 'classnames';

import styles from '../../styles/skeleton/index.module.css';

export interface SkeletonProps {
  count?: number;
  width?: string | number | null;
  height?: string | number | null;
  circle?: boolean;
  style?: React.CSSProperties;
}

export default function Skeleton({
  count = 1,
  width = null,
  height = null,
  circle = false,
  style = {},
}: SkeletonProps) {
  const size: React.CSSProperties = {
    ...(width !== null ? { width } : {}),
    ...(height !== null ? { height } : {}),
    ...(width !== null && height !== null && circle ? { borderRadius: '50%' } : {}),
  };
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={classNames(styles['hl-skeleton'], styles['hl-skeleton-animation'])}
          style={{ ...style, ...size }}
        >
          &zwnj;
        </span>
      ))}
    </>
  );
}
