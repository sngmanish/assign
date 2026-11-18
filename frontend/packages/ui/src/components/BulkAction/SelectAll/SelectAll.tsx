import React from 'react';

import { Button, VARIANTS } from '../../Button';

import type { SelectAllProps } from '../types/BulkAction.types';

function SelectAll(props: SelectAllProps): React.ReactElement {
  const { selectAllButtonProps } = props;

  const handleSelectAll = (event: React.MouseEvent): void => {
    event.preventDefault();
    if (selectAllButtonProps.onClick) {
      selectAllButtonProps.onClick(event);
    }
  };

  return <Button {...selectAllButtonProps} variant={VARIANTS.TERTIARY} onClick={handleSelectAll} />;
}

export default SelectAll;
