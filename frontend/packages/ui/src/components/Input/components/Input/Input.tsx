import * as React from 'react';

import type { InputProps } from '../../types/Input.types';
import { TYPES } from '../../constants';
import { DateInput } from '../common/DateInput';
import { SearchInput } from '../common/Search';
import { TextInput } from '../common/TextInput';
import InputWrapper from '../InputWrapper';

export type { InputProps };

const Input = React.memo(
  React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
    const {
      type = TYPES.TEXT,
      label = '',
      id = '',
      required = false,
      isError = false,
      name = '',
      validationText = '',
      style = {},
      dataTestId = '',
      className = '',
      accessibleErrorText = 'error',
      actions,
      selectedDate,
      ...restProps
    } = props;

    const common = {
      ...restProps,
      required,
      ref,
      type,
      isError,
      id,
      name,
      label,
      validationText,
      dataTestId,
    };

    return (
      <InputWrapper
        id={id}
        label={label}
        required={required}
        isError={isError}
        validationText={validationText}
        style={style}
        className={className}
        accessibleErrorText={accessibleErrorText}
      >
        {type === TYPES.SEARCH ? (
          <SearchInput {...common} actions={actions} />
        ) : type === TYPES.DATE ? (
          <DateInput {...common} selectedDate={selectedDate} />
        ) : (
          <TextInput {...common} />
        )}
      </InputWrapper>
    );
  }),
);

Input.displayName = 'Input';

export default Input;
