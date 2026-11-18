import React from 'react';

import { Heading } from '../Heading';
import type { PageHeaderProps } from './types/PageHeader.types';

import styles from '../../styles/page-header/index.module.css';

function PageHeader(props: PageHeaderProps) {
  const { heading = '', children, actions = (): React.ReactNode => null } = props;

  const headerHTML = (
    <div className={styles['hl-page-heading']}>
      <Heading className={styles['hl-page-heading__title']} level={1}>
        {heading}
      </Heading>
      <div className={styles['hl-page-heading__actions']}>{actions()}</div>
    </div>
  );

  return (
    <React.Fragment>
      <div className={styles['hl-page-header']}>{headerHTML}</div>
      <div className={styles['hl-page-content']}>{children}</div>
    </React.Fragment>
  );
}

export default PageHeader;
