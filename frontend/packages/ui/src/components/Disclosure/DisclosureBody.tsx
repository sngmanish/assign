import React from 'react';

import classNames from 'classnames';
import { createPortal } from 'react-dom';

import {
  useAutoFocus,
  useDelayedUnmount,
  useDismissal,
  useFocusRestoration,
  usePosition,
} from './hooks/bodyHooks';
import type { DisclosureBodyConfig, DisclosureTrigger } from './types';

import styles from './styles/index.module.css';

export interface DisclosureBodyProps {
  body: DisclosureBodyConfig;
  trigger: Pick<DisclosureTrigger, 'ref'>;
  setVisible: (visible: boolean) => void;
  /** The caller handles outside clicks and Escape itself. */
  controlled?: boolean;
  children?: React.ReactNode;
}

/** The floating body of a disclosure (a menu or panel), positioned next to its trigger in a portal. */
function DisclosureBody({
  body,
  trigger,
  setVisible,
  controlled = false,
  children,
}: DisclosureBodyProps) {
  const { ref, visible, id, placement, flip, animate, autoFocus, style, className } = body;
  const triggerRef = trigger.ref;

  const { shouldRender, onAnimationEnd } = useDelayedUnmount(visible, animate);
  const position = usePosition(shouldRender, placement, triggerRef, ref, flip);

  useAutoFocus(ref, shouldRender, autoFocus);
  useDismissal(visible, !controlled, ref, triggerRef, setVisible);
  useFocusRestoration(visible, triggerRef);

  if (!shouldRender) return null;

  return createPortal(
    <div
      ref={ref}
      id={id}
      data-hl-component="disclosure"
      className={styles['hl-discl']}
      style={{ top: 0, left: 0, transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <div
        style={style}
        data-placement={placement}
        onAnimationEnd={onAnimationEnd}
        className={classNames(
          styles['hl-discl__body'],
          styles['hl-discl__body--elevation'],
          styles['hl-discl__body--border'],
          animate &&
            (visible
              ? styles['hl-discl__body--fade-in-animation']
              : styles['hl-discl__body--fade-out-animation']),
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default DisclosureBody;
