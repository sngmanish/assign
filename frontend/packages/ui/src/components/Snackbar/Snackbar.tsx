import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { SnackbarProps } from './types/Snackbar.types';

import styles from '../../styles/snackbar/index.module.css';
import CrossCircledIcon from '../../icons/react/CrossCircledIcon';
import CheckCircledIcon from '../../icons/react/CheckCircledIcon';

/** How long the exit animation runs before the toast is removed (matches the CSS). */
const EXIT_MS = 200;

/**
 * One toast, styled like shadcn's (Sonner): a card that slides up into the bottom-right stack,
 * stays for `duration` ms (paused while hovered), then fades out.
 */
function Snackbar({
  type,
  message,
  duration = 4000,
  onRemoved,
}: SnackbarProps): React.ReactElement {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(onRemoved, EXIT_MS);
  }, [onRemoved]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    timer.current = setTimeout(dismiss, remaining.current);
  }, [dismiss]);

  const pause = () => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current -= Date.now() - startedAt.current;
  };

  useEffect(() => {
    remaining.current = duration;
    start();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [duration, start]);

  const isError = type === 'error';

  return (
    <li
      className={`${styles['hl-toast']} ${styles[`hl-toast--${type}`]} ${leaving ? styles['hl-toast--leaving'] : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onMouseEnter={pause}
      onMouseLeave={start}
    >
      <span className={styles['hl-toast__icon']}>
        {isError ? (
          <CrossCircledIcon aria-hidden="true" />
        ) : (
          <CheckCircledIcon aria-hidden="true" />
        )}
      </span>
      <div className={styles['hl-toast__message']}>{message}</div>
    </li>
  );
}

export default React.memo(Snackbar);
