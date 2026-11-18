import * as React from 'react';

import type { SearchInputProps } from './types/SearchInput.types';
import { Close } from '../../../../Close';
import { TextInput } from '../TextInput';

import MagnifyingGlassIcon from '../../../../../icons/react/MagnifyingGlassIcon';
export type { SearchInputProps };

const SearchInput = React.memo(
  React.forwardRef<HTMLInputElement, SearchInputProps>((props, ref) => {
    const { actions: actionsFromProps, disabled = false, readOnly = false, ...restProps } = props;
    const clear = actionsFromProps?.[0];
    const searchActions = [
      () => (
        <Close
          ariaLabel={clear?.ariaLabel ?? 'Clear search'}
          onClick={clear?.onClick}
          size="small"
        />
      ),
    ];

    return (
      <TextInput
        {...restProps}
        prefix={() => <MagnifyingGlassIcon aria-hidden="true" />}
        actions={searchActions}
        ref={ref}
        readOnly={readOnly}
        disabled={disabled}
      />
    );
  }),
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
