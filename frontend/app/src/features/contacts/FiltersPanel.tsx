import { useEffect, useId, type ReactNode } from 'react';
import {
  BUTTON_SIZE,
  BUTTON_VARIANT,
  Button,
  Close,
  DisclosureBody,
  Heading,
  MixerHorizontalIcon,
  useDisclosure,
} from '@crm/ui';

/** Menus opened from inside the panel (e.g. the tag select) render elsewhere in the page: clicks in them are not "outside". */
const isInsideMenu = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-select-menu]'));

/**
 * A "Filters" button that toggles a panel with the filter controls. The panel closes on a second
 * click of the button, on Escape, on Done, and on a click anywhere outside it.
 */
export function FiltersPanel({
  activeCount,
  onClear,
  children,
}: {
  /** How many filters are applied; shown on the button. */
  activeCount: number;
  /** Drop every filter. The button is disabled while `activeCount` is 0. */
  onClear: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const { trigger, body, close, setVisible } = useDisclosure({
    triggerId: `filters-${id}__trigger`,
    bodyId: `filters-${id}__panel`,
    placement: 'bottom-start',
    animate: true,
    style: { width: 340, padding: 'var(--hl-space-4)' },
  });

  // Our own outside-click and Escape handling (the body's built-in one would also close the panel
  // when an option is picked in a menu opened from inside it)
  useEffect(() => {
    if (!body.visible) return undefined;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        body.ref.current?.contains(t) ||
        trigger.ref.current?.contains(t) ||
        isInsideMenu(e.target)
      )
        return;
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
  }, [body.visible, body.ref, trigger.ref, setVisible]);

  const { ref: triggerRef, ...triggerAria } = trigger;

  return (
    <>
      <Button
        {...triggerAria}
        // it opens a dialog, not a menu
        aria-haspopup="dialog"
        ref={triggerRef}
        // the visible label is the accessible name, so the count is read out too
        label={activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
        variant={BUTTON_VARIANT.SECONDARY}
        size={BUTTON_SIZE.SMALL}
        icon={<MixerHorizontalIcon />}
        onClick={() => setVisible(!body.visible)}
      />
      <DisclosureBody body={body} trigger={trigger} setVisible={setVisible} controlled>
        <div
          role="dialog"
          aria-label="Filters"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--hl-space-4)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Heading level={2} size="sm">
              Filters
            </Heading>
            <Close size="small" ariaLabel="Close filters" onClick={close} />
          </div>
          {children}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              label="Clear filters"
              variant={BUTTON_VARIANT.TERTIARY}
              size={BUTTON_SIZE.SMALL}
              disabled={activeCount === 0}
              onClick={onClear}
            />
            <Button
              label="Done"
              variant={BUTTON_VARIANT.SECONDARY}
              size={BUTTON_SIZE.SMALL}
              onClick={close}
            />
          </div>
        </div>
      </DisclosureBody>
    </>
  );
}
