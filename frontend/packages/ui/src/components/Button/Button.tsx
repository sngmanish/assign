import React from 'react';

import classNames from 'classnames';

import type { ButtonProps, IconProp } from './types/Button.types';
import { VARIANTS, SIZES, ARROWICON } from './constant';
import { Loader } from '../Loader';
import { Text } from '../Text';
import { validateString } from '../Utils/helper';

import styles from '../../styles/button/index.module.css';
import ChevronDown from '../../icons/react/ChevronDownIcon';
import ChevronUp from '../../icons/react/ChevronUpIcon';
import ReloadIcon from '../../icons/react/ReloadIcon';
export type { ButtonProps, IconProp };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const {
    variant = VARIANTS.PRIMARY,
    iconAlone = false,
    loading = false,
    fullWidth = false,
    size = SIZES.MEDIUM,
    label = '',
    className = '',
    disabled = false,
    dataTestId,
    ariaLabel = 'button',
    icon = null,
    arrowIcon = ARROWICON.DEFAULT,
    ...restprops
  } = props;

  const isDropdownOpen = arrowIcon === ARROWICON.UP;
  const buttonClass = classNames(
    styles['hl-btn'],
    styles[`hl-btn--${variant}`],
    styles[`hl-btn--${size}`],
    {
      [styles['hl-btn--loading']]: loading,
      [styles['hl-btn--full-width']]: fullWidth,
      [styles['hl-btn--icon-alone']]: iconAlone,
      [styles['hl-btn--dropdown-open']]: isDropdownOpen,
    },
    className,
  );

  const iconNode = typeof icon === 'function' ? icon() : null;

  const ariaText = iconAlone || validateString(label) ? ariaLabel : undefined;

  const textColor =
    variant === VARIANTS.PRIMARY ? 'var(--hl-primary-foreground)' : 'var(--hl-foreground)';

  const hidden = loading ? { opacity: 0 } : undefined;
  const DropdownIcon = isDropdownOpen ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      {...restprops}
      ref={ref}
      className={buttonClass}
      data-testid={dataTestId}
      aria-label={ariaText}
      disabled={disabled || loading}
      aria-disabled={disabled || loading ? true : undefined}
    >
      {iconNode ? (
        <span className={styles['hl-btn--icon-flex']} style={hidden}>
          {iconNode}
        </span>
      ) : null}
      {loading ? <Loader indicator={<ReloadIcon width="24" height="24" />} /> : null}
      {!iconAlone && label ? (
        <Text
          color={textColor}
          fontFamily="interactive"
          className={styles['hl-btn__label']}
          style={hidden}
        >
          {label}
        </Text>
      ) : null}
      {!iconAlone && arrowIcon ? (
        <span className={styles['hl-btn--icon-flex']} style={hidden} aria-hidden="true">
          <DropdownIcon />
        </span>
      ) : null}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
