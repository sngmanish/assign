import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

import { createPortal } from 'react-dom';

import Snackbar from './Snackbar';

import type { SnackbarContainerProps, SnackbarOptions } from './types/Snackbar.types';

import styles from '../../styles/snackbar/index.module.css';

type Show = (options: SnackbarOptions) => void;

const SnackbarContext = createContext<Show | undefined>(undefined);

/** Holds the toasts (bottom-right of the page) and gives `useSnackbar` to everything inside it. */
export function SnackbarContainer({ children }: SnackbarContainerProps): React.ReactElement {
  const [list, setList] = useState<(SnackbarOptions & { id: number })[]>([]);
  const nextId = useRef(1);

  const show = useCallback<Show>((options) => {
    const id = nextId.current++;
    setList((prev) => [...prev, { ...options, id }]);
  }, []);

  const remove = useCallback(
    (id: number) => setList((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  return (
    <SnackbarContext.Provider value={show}>
      {createPortal(
        <ol className={styles['hl-snackbar-container']} aria-label="Notifications">
          {list.map(({ id, ...toast }) => (
            <Snackbar key={id} {...toast} onRemoved={() => remove(id)} />
          ))}
        </ol>,
        document.body,
      )}
      {children}
    </SnackbarContext.Provider>
  );
}

/** Show a toast. The function is stable (the same on every render). */
export function useSnackbar(): Show {
  const show = useContext(SnackbarContext);
  if (!show) throw new Error('useSnackbar must be used within a SnackbarContainer');
  return show;
}

export default SnackbarContainer;
