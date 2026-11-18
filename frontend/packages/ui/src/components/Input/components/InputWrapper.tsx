import * as React from 'react';

import classNames from 'classnames';

import type { InputWrapperProps } from '../types/InputWrapper.types';
import ValidationMessage from './common/ValidationMessage/ValidationMessage';
import { Text } from '../../Text';

import styles from '../../../styles/input/index.module.css';

export type { InputWrapperProps };

const InputWrapper = React.memo<InputWrapperProps>((props) => {
  const {
    label,
    id,
    required,
    isError,
    children,
    style,
    validationText,
    className,
    accessibleErrorText,
  } = props;

  const inputWrapperClasses = classNames({
    [styles['hl-input-wrapper']]: true,
    [className ?? '']: !!className,
  });

  return (
    <div className={inputWrapperClasses} style={{ ...style }}>
      {!!label && (
        <label htmlFor={id} className={styles['hl-input-label']} id={`${id}-label`}>
          <Text fontFamily="interactive" size="md" className={styles['hl-input-label-text']}>
            {label}
          </Text>
          {required ? (
            <Text
              fontFamily="interactive"
              size="md"
              color="var(--hl-destructive)"
              className={styles['hl-input-required']}
              aria-hidden="true"
              style={{ marginLeft: '4px' }}
            >
              *
            </Text>
          ) : null}
        </label>
      )}
      {children}
      <ValidationMessage
        id={id}
        isError={isError}
        validationText={validationText}
        accessibleErrorText={accessibleErrorText}
      />
    </div>
  );
});

InputWrapper.displayName = 'InputWrapper';

export default InputWrapper;
