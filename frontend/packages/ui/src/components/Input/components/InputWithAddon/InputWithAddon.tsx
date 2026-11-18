import * as React from 'react';

import type { InputWithAddonProps } from '../../types/InputWithAddon.types';
import { TYPES, SIZES } from '../../constants';
import { TextInput } from '../common/TextInput';
import InputWrapper from '../InputWrapper';

export type { InputWithAddonProps };

const InputComponentMaps = {
  [TYPES.TEXT]: TextInput,
};

const InputWithAddon = React.memo(
  React.forwardRef<HTMLInputElement, InputWithAddonProps>((props, ref) => {
    const {
      type = TYPES.TEXT,
      leftAddon = null,
      label = '',
      id,
      required = false,
      isError = false,
      disabled = false,
      validationText = '',
      style = {},
      className = '',
      accessibleErrorText = 'error',
      ...restProps
    } = props;

    const InputComponent = InputComponentMaps[type as keyof typeof InputComponentMaps] ?? null;

    return (
      <InputWrapper
        label={label}
        id={id}
        required={required}
        isError={isError}
        validationText={validationText}
        style={style}
        className={className}
        accessibleErrorText={accessibleErrorText}
      >
        <div style={{ display: 'flex' }}>
          {leftAddon}
          {InputComponent ? (
            <InputComponent
              {...restProps}
              ref={ref}
              type={type}
              size={SIZES.MEDIUM}
              required={required}
              isError={isError}
              hasLeftAddon={Boolean(leftAddon)}
              id={id}
              disabled={disabled}
              label={label}
              validationText={validationText}
            />
          ) : null}
        </div>
      </InputWrapper>
    );
  }),
);

InputWithAddon.displayName = 'InputWithAddon';

export default InputWithAddon;
