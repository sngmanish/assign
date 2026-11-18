import React, { forwardRef } from 'react';

import moduleStyles from '../../styles/checkbox/index.module.css';

export interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'id' | 'aria-label'
> {
  /** The tick drawn when checked: a check mark, or a dash ("some selected"). */
  variant?: 'positive' | 'undetermined' | '';
  identifier: string;
  /** What the checkbox selects, read by screen readers (it has no visible text). */
  ariaLabel: string;
  dataTestId?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ variant = 'positive', identifier, ariaLabel, dataTestId, ...rest }, ref) => (
    <div className={moduleStyles['hl-checkbox-wrapper']}>
      <input
        type="checkbox"
        id={identifier}
        className={moduleStyles['hl-checkbox-input']}
        aria-label={ariaLabel}
        ref={ref}
        data-testid={dataTestId}
        {...rest}
      />
      <label htmlFor={identifier} className={moduleStyles['hl-checkbox-label']}>
        <span
          className={`${moduleStyles['hl-checkbox']} ${moduleStyles[`hl-checkbox_tick_${variant}`]}`}
        ></span>
        <span className={moduleStyles['hl-checkbox-sr-only']}>{ariaLabel}</span>
      </label>
    </div>
  ),
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
