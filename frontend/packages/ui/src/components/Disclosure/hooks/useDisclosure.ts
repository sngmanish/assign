import { useCallback, useMemo, useRef, useState } from 'react';

import { PLACEMENTS } from '../types';
import type {
  Disclosure,
  DisclosureBodyConfig,
  DisclosureOptions,
  DisclosureTrigger,
} from '../types';

/** Open/close state for a trigger and the floating body it controls (render the body with `DisclosureBody`). */
const useDisclosure = ({
  triggerId,
  bodyId,
  visible: initiallyVisible = false,
  placement = PLACEMENTS.BOTTOM_START,
  flip = true,
  animate = false,
  autoFocus = true,
  style,
  className,
}: DisclosureOptions = {}): Disclosure => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(initiallyVisible);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => setVisible((v) => !v), []);

  const trigger = useMemo<DisclosureTrigger>(
    () => ({
      id: triggerId,
      ref: triggerRef,
      'aria-expanded': visible,
      'aria-haspopup': 'menu',
      'aria-controls': bodyId,
    }),
    [triggerId, bodyId, visible],
  );

  // style is compared by value: callers usually pass a new object literal on every render
  const styleKey = JSON.stringify(style ?? {});
  const body = useMemo<DisclosureBodyConfig>(
    () => ({
      id: bodyId,
      ref: bodyRef,
      visible,
      placement,
      flip,
      animate,
      autoFocus,
      style,
      className,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bodyId, visible, placement, flip, animate, autoFocus, styleKey, className],
  );

  return { trigger, body, open, close, toggle, setVisible };
};

export default useDisclosure;
