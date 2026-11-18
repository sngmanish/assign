import React, { useRef } from 'react';

import classNames from 'classnames';

import { SelectAll } from './SelectAll';
import { Text } from '../Text';

import type { BulkActionProps } from './types/BulkAction.types';

import styles from '../../styles/bulk-action/index.module.css';
import { Button, VARIANTS } from '../Button';

function BulkAction(props: BulkActionProps): React.ReactElement {
  const {
    className = '',
    selectedDataCount = 0,
    totalDataCount = 0,
    selectAllButtonProps = {
      label: 'Select All',
      ariaLabel: 'Select All',
      onClick: () => {},
    },
    primaryActions = [],
  } = props;

  const bulkActionRef = useRef<HTMLDivElement>(null);

  const bulkActionClass = classNames({
    [styles['hl-bulk-action']]: true,
    [className]: !!className,
  });

  return (
    <div className={bulkActionClass} ref={bulkActionRef}>
      <div className={styles['hl-bulk-action__select']}>
        <div>
          <Text size="lg" tag="span" fontFamily="bold">
            {selectedDataCount}
          </Text>
          /<span>{totalDataCount}</span>
        </div>
        <SelectAll selectAllButtonProps={selectAllButtonProps} />
      </div>
      {primaryActions.slice(0, 3).map((buttonProps, index) => (
        <Button {...buttonProps} variant={VARIANTS.TERTIARY} key={index} />
      ))}
    </div>
  );
}

export default BulkAction;
