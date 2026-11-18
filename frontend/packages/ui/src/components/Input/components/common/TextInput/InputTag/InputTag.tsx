import * as React from 'react';

import type { InputTagProps } from './types/InputTag.types';
import { TYPES } from '../../../../constants';

export type { InputTagProps };

const InputTag = React.memo(
  React.forwardRef<HTMLInputElement, InputTagProps>((props, ref) => {
    const {
      readOnly,
      inputControlClasses,
      id,
      type,
      disabled,
      maxLength,
      required,
      isError,
      placeholder = '',
      name,
      prefix,
      label,
      validationText,
      dataTestId,
      ...restProps
    } = props;

    // a text prefix (e.g. "https://") is part of the name; an icon prefix is decoration. Without a
    // visible label this stays unset so the input's own aria-label names it
    const ariaLabelledbyIds = () => {
      const ids = [
        label && `${id}-label`,
        label && typeof prefix === 'string' && `${id}-prefix`,
      ].filter(Boolean);
      return ids.join(' ') || undefined;
    };

    const ariaDescribedByIds = () => {
      const ids = [validationText && isError && `${id}-validationText`].filter(Boolean);
      return ids.join(' ') || undefined;
    };

    return (
      <input
        {...restProps}
        data-testid={dataTestId ? dataTestId : undefined}
        name={name}
        placeholder={placeholder ? placeholder : undefined}
        required={required}
        aria-required={required ? required : undefined}
        aria-describedby={ariaDescribedByIds()}
        aria-invalid={isError ? isError : undefined}
        ref={ref}
        readOnly={readOnly}
        aria-readonly={readOnly ? readOnly : undefined}
        className={inputControlClasses}
        id={id}
        type={type === TYPES.DATE ? TYPES.TEXT : type}
        disabled={disabled}
        aria-disabled={disabled ? disabled : undefined}
        maxLength={maxLength ?? undefined}
        aria-labelledby={ariaLabelledbyIds()}
      />
    );
  }),
);

InputTag.displayName = 'InputTag';

export default InputTag;
