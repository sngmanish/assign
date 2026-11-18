import * as React from 'react';

import classNames from 'classnames';

import type { TextInputProps } from './types/TextInput.types';
import { InputTag } from './InputTag';
import { Prefix } from './Prefix';
import { TYPES, SIZES } from '../../../constants';
import ActionBar from '../ActionBar/ActionBar';

import styles from '../../../../../styles/input/index.module.css';

export type { TextInputProps };

const TextInput = React.memo(
  React.forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {
    const {
      id,
      size = SIZES.MEDIUM,
      type,
      prefix = null,
      actions = [],
      readOnly = false,
      isError,
      className = '',
      disabled = false,
      hasLeftAddon = false,
      name,
      validationText,
      ...restProps
    } = props;

    const rightOptionsRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const inputClasses = classNames({
      [styles['hl-input']]: true,
      [styles[`hl-input__type-${type}`]]: type === TYPES.SEARCH,
      [styles[`hl-input--${size}`]]: size === SIZES.SMALL,
      [styles['hl-input--disabled']]: disabled,
      [styles['hl-input--error']]: isError,
      [styles['hl-input--readonly']]: readOnly,
      [styles['hl-input--has-left-addon']]: hasLeftAddon && type === TYPES.TEXT,
      [styles['hl-input__with-actions']]: actions && actions.length > 0,
      [className]: !!className,
    });

    const inputControlClasses = classNames({
      [styles['hl-input-common-control']]: true,
      [styles['hl-input__control']]: true,
      [styles[`hl-input__control--${size}`]]: size === SIZES.SMALL,
    });

    // Text must not run under the buttons at the right end (e.g. the search box's ×): pad the
    // input by their width, and again whenever that width changes
    const hasActions = actions.length > 0;
    React.useEffect(() => {
      const bar = rightOptionsRef.current;
      const input = inputRef.current;
      if (!hasActions || !bar || !input) return undefined;
      const update = () => input.style.setProperty('--right-padding', `${bar.offsetWidth + 12}px`);
      update();
      const observer = new ResizeObserver(update);
      observer.observe(bar);
      return () => observer.disconnect();
    }, [hasActions]);

    return (
      <div
        className={inputClasses}
        role="presentation"
        onClick={() => {
          inputRef?.current?.focus();
        }}
      >
        <Prefix prefix={prefix} id={id} />
        <InputTag
          {...restProps}
          ref={inputRef}
          id={id}
          type={type}
          name={name}
          isError={isError}
          readOnly={readOnly}
          disabled={disabled}
          inputControlClasses={inputControlClasses}
          prefix={prefix}
          validationText={validationText}
          style={{
            paddingRight: hasActions ? 'var(--right-padding)' : undefined,
          }}
        />
        <div className={styles['hl-input__right-options']} ref={rightOptionsRef}>
          <ActionBar actions={actions} size={size} disableActions={disabled || readOnly} />
        </div>
      </div>
    );
  }),
);

TextInput.displayName = 'TextInput';

export default TextInput;
