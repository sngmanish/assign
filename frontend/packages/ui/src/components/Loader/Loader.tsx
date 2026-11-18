import React from 'react';

import type { LoaderProps } from './types/Loader.types';

import styles from '../../styles/loader/index.module.css';
import ReloadIcon from '../../icons/react/ReloadIcon';
export type { LoaderProps };

/** A spinning indicator laid over its (relatively positioned) parent, e.g. a loading button. */
function Loader({ indicator = <ReloadIcon width="24" height="24" /> }: LoaderProps) {
  return (
    <span className={`${styles['hl-loader']} ${styles['hl-loader--absolute']}`}>{indicator}</span>
  );
}

export default Loader;
