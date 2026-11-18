import React, { useState } from 'react';

import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';

import { usePresence } from '../../utilities/hooks/usePresence';

import type { TooltipProps } from './types/Tooltip.types';

import styles from '../../styles/tooltip/index.module.css';

export type { TooltipProps };

/**
 * A text label shown next to its child on hover and on keyboard focus (not on a mouse click's
 * focus). Pressing the trigger or Escape closes it. `visible` keeps it open (the caller then
 * decides when to hide it, e.g. from `onMouseLeave`).
 */
const Tooltip = ({
  text,
  visible = false,
  placement = 'bottom',
  children,
  onMouseLeave,
}: TooltipProps) => {
  const [hoverOpen, setHoverOpen] = useState(false);
  const open = visible || hoverOpen;

  const {
    refs,
    floatingStyles,
    placement: finalPlacement,
    context,
  } = useFloating({
    open,
    onOpenChange: setHoverOpen,
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { move: false }),
    useFocus(context, { keyboardOnly: true }),
    useDismiss(context, { referencePress: true }),
    useRole(context, { role: 'tooltip' }),
  ]);

  // the child keeps its own ref (if it has one) as well as being the anchor
  const childRef = (children as React.ReactElement & { ref?: React.Ref<unknown> }).ref;
  const ref = useMergeRefs([refs.setReference, childRef]);
  const isMounted = usePresence(open);

  const childProps = children.props as Record<string, unknown>;

  return (
    <>
      {React.cloneElement(
        children,
        getReferenceProps({
          ...childProps,
          ref,
          onMouseLeave: (e: React.MouseEvent) => {
            (childProps.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e);
            onMouseLeave?.(e);
          },
        }),
      )}
      {isMounted && text ? (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className={styles['hl-tooltip']}
            data-placement={finalPlacement}
            data-state={open ? 'open' : 'closed'}
            {...getFloatingProps()}
          >
            {text}
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
};

export default Tooltip;
