import * as React from 'react';

import type { ActionBarProps } from './types/ActionBar.types';
import { SIZES } from '../../../constants';

import styles from '../../../../../styles/input/index.module.css';

export type { ActionBarProps };

/** Buttons inside the right end of an input (e.g. the search box's ×). */
const ActionBar = React.memo<ActionBarProps>(({ size = SIZES.MEDIUM, actions, disableActions }) =>
  // callers may pass null (the date input does)
  actions?.length ? (
    <div className={styles['hl-input__actionbar']}>
      <div className={styles['hl-input__actions']}>
        {actions.map((action, index) =>
          React.cloneElement(action(), {
            key: index,
            className: styles[`hl-input__action-btn--${size}`],
            ...(disableActions ? { tabIndex: -1 } : {}),
          }),
        )}
      </div>
    </div>
  ) : null,
);

ActionBar.displayName = 'ActionBar';

export default ActionBar;
