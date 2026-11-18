import { useEffect, useLayoutEffect, useState } from 'react';
import type React from 'react';

import { flushSync } from 'react-dom';
import { autoUpdate, computePosition, flip, offset } from '@floating-ui/dom';

import { PLACEMENTS } from '../types';
import type { Placement } from '../types';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focus the first focusable element in the body once it is rendered. */
export function useAutoFocus(
  ref: React.RefObject<HTMLElement>,
  rendered: boolean,
  enabled: boolean,
) {
  useEffect(() => {
    if (rendered && enabled) {
      ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    }
  }, [rendered, ref, enabled]);
}

/**
 * Whether the body is in the DOM. With `animate`, it stays mounted after closing until its
 * fade-out animation ends (call `onAnimationEnd` from the animated element).
 */
export function useDelayedUnmount(visible: boolean, animate: boolean) {
  const [mounted, setMounted] = useState(visible);

  useLayoutEffect(() => {
    if (animate && visible) setMounted(true);
  }, [visible, animate]);

  const onAnimationEnd = () => {
    if (!visible) flushSync(() => setMounted(false));
  };

  return {
    shouldRender: animate ? mounted : visible,
    onAnimationEnd: animate ? onAnimationEnd : undefined,
  };
}

/** Close on a click outside the body and trigger, and on Escape. */
export function useDismissal(
  visible: boolean,
  enabled: boolean,
  ref: React.RefObject<HTMLElement>,
  triggerRef: React.RefObject<HTMLElement>,
  setVisible: (visible: boolean) => void,
) {
  useEffect(() => {
    if (!visible || !enabled) return undefined;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !triggerRef.current?.contains(target))
        setVisible(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [visible, enabled, ref, triggerRef, setVisible]);
}

/** Give focus back to the trigger when the body closes. */
export function useFocusRestoration(visible: boolean, triggerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    if (!visible) return undefined;
    const trigger = triggerRef.current;
    return () => {
      requestAnimationFrame(() => trigger?.focus());
    };
  }, [visible, triggerRef]);
}

/** The body's position next to the trigger, kept up to date while it is shown. */
export function usePosition(
  rendered: boolean,
  placement: Placement,
  triggerRef: React.RefObject<HTMLElement>,
  bodyRef: React.RefObject<HTMLElement>,
  canFlip: boolean,
) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useLayoutEffect(() => {
    const reference = triggerRef.current;
    const floating = bodyRef.current;
    if (!rendered || !reference || !floating) return undefined;

    const update = async () => {
      const pos = await computePosition(reference, floating, {
        placement,
        middleware: [
          canFlip && flip({ fallbackPlacements: Object.values(PLACEMENTS) }),
          offset(10),
        ],
      });
      setPosition((prev) =>
        Math.floor(prev.x) !== Math.floor(pos.x) || Math.floor(prev.y) !== Math.floor(pos.y)
          ? { x: pos.x, y: pos.y }
          : prev,
      );
    };

    return autoUpdate(reference, floating, update);
  }, [rendered, placement, triggerRef, bodyRef, canFlip]);

  return position;
}
