import React from 'react';

import classNames from 'classnames';

import { TYPES } from '../constants';

import type { NavButtonProps, NavigationButtonsProps } from '../types/Pagination.types';

import styles from '../../../styles/pagination/index.module.css';
import ChevronLeftIcon from '../../../icons/react/ChevronLeftIcon';
import ChevronRightIcon from '../../../icons/react/ChevronRightIcon';
import { Button, VARIANTS } from '../../Button';
import { Tooltip } from '../../Tooltip';

const NavButton = ({
  icon,
  ariaLabel,
  index,
  disabled,
  action,
}: NavButtonProps): React.ReactElement => {
  const NavigationButtonsClass = classNames({
    [styles['hl-pagination-previous']]: index === 0,
    [styles['hl-pagination-next']]: index !== 0,
  });

  const button = (
    <Button
      icon={() => icon}
      ariaLabel={ariaLabel}
      iconAlone
      variant={VARIANTS.TERTIARY}
      className={NavigationButtonsClass}
      disabled={disabled}
      onClick={action}
    />
  );

  // always wrapped, so the button is not re-created when it becomes disabled (no flicker); a
  // disabled button gets no hover events, so it shows no tooltip
  return <Tooltip text={ariaLabel}>{button}</Tooltip>;
};

function NavigationButtons({
  currentPageInt,
  totalPages,
  handlePageChange,
  children,
}: NavigationButtonsProps): React.ReactElement {
  const prevButton = {
    key: 'previous',
    ariaLabel: 'Previous page',
    icon: <ChevronLeftIcon />,
    action: () => handlePageChange(TYPES.DECREMENT),
    disabled: currentPageInt <= 1 || totalPages === 1,
  };

  const nextButton = {
    key: 'next',
    ariaLabel: 'Next page',
    icon: <ChevronRightIcon />,
    action: () => handlePageChange(TYPES.INCREMENT),
    disabled: currentPageInt === totalPages || totalPages === 1,
  };

  return (
    <ul className={styles['hl-pagination-links']}>
      <li key={prevButton.key}>
        <NavButton
          icon={prevButton.icon}
          ariaLabel={prevButton.ariaLabel ?? ''}
          index={0}
          disabled={prevButton.disabled}
          action={prevButton.action}
        />
      </li>
      {children}
      <li key={nextButton.key}>
        <NavButton
          icon={nextButton.icon}
          ariaLabel={nextButton.ariaLabel ?? ''}
          index={1}
          disabled={nextButton.disabled}
          action={nextButton.action}
        />
      </li>
    </ul>
  );
}

export default NavigationButtons;
