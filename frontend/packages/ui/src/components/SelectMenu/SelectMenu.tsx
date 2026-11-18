import * as React from 'react';

import { FloatingPortal, autoUpdate, flip, offset, useFloating } from '@floating-ui/react';
import classNames from 'classnames';

import type { SelectMenuProps, SelectOption } from './SelectMenu.types';
import { ARROWICON, Button } from '../Button';
import { Input, TYPES } from '../Input';
import { Text } from '../Text';

import styles from '../../styles/select-menu/index.module.css';

/**
 * A button that opens a panel with a search box and a list of options; when the search has no
 * exact match it can offer "Create '<search>'". Arrow keys move through the options, Enter picks
 * (or creates), Escape and a click outside close it.
 */
function SelectMenu({
  options,
  onSelect,
  selectedKey,
  controlButtonMetaData = {},
  disabled = false,
  placement = 'bottom-start',
  fullWidth = false,
  searchable = true,
  searchValue = '',
  handleSearch = () => {},
  searchPlaceholder = 'Search',
  noOptionContent = null,
  isCreatable = false,
  isExactMatch = true,
  creatableButtonMetaData = {},
  identifier = 'selectmenu',
}: SelectMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [focused, setFocused] = React.useState(-1);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const { refs, floatingStyles, update } = useFloating({
    open,
    placement,
    // Follows scrolling and window resizes, but doesn't watch the panel's own size: re-rendering
    // from inside that ResizeObserver (as the list filters) is a "ResizeObserver loop". The
    // effect below repositions when the content changes instead.
    whileElementsMounted: (reference, floating, onUpdate) =>
      autoUpdate(reference, floating, onUpdate, { elementResize: false }),
    // the option list caps its own height; `flip` moves the panel above when there's no room
    middleware: [offset(8), flip({ padding: 10 })],
  });
  // at least as wide as the button, measured when the menu opens
  const [triggerWidth, setTriggerWidth] = React.useState(0);
  const openMenu = () => {
    setTriggerWidth(triggerRef.current?.offsetWidth ?? 0);
    setOpen(true);
  };

  const showCreate = isCreatable && !isExactMatch && searchValue.trim() !== '';
  React.useEffect(() => {
    if (open) update();
  }, [open, options.length, showCreate, update]);
  const {
    createLabelText = 'Create',
    disabled: createDisabled,
    handleCreateOption,
  } = creatableButtonMetaData;

  const close = React.useCallback(
    (returnFocus = false) => {
      setOpen(false);
      setFocused(-1);
      if (searchValue) handleSearch('');
      if (returnFocus) triggerRef.current?.focus();
    },
    [searchValue, handleSearch],
  );

  // a click outside the button and the panel closes the menu
  React.useEffect(() => {
    if (!open) return undefined;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close();
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open, close]);

  // focus the search box when the menu opens (the portal renders a tick later); without one,
  // focus stays on the button, which handles the arrow keys
  React.useEffect(() => {
    if (!open || !searchable) return undefined;
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open, searchable]);

  // the focused option starts over whenever the list changes
  React.useEffect(() => setFocused(-1), [options]);

  const pick = (option: SelectOption, e: React.SyntheticEvent) => {
    if (option.disabled) return;
    onSelect(option, e);
    close(true);
  };

  const create = (e: React.SyntheticEvent) => {
    if (createDisabled) return;
    handleCreateOption?.(searchValue.trim(), e);
    close(true);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openMenu();
      if (!enabled.length) return;
      const pos = enabled.indexOf(focused);
      const next =
        e.key === 'ArrowDown'
          ? enabled[(pos + 1) % enabled.length]
          : enabled[(pos - 1 + enabled.length) % enabled.length];
      setFocused(next!);
      document.getElementById(`${identifier}-option-${next}`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      if (focused >= 0 && options[focused]) pick(options[focused]!, e);
      else if (showCreate) create(e);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close(true);
    }
  };

  const panelId = `${identifier}-panel`;

  return (
    <div
      className={classNames(styles['hl-selectmenu'], styles['selectmenu-button'])}
      style={fullWidth ? { display: 'block', width: '100%' } : undefined}
    >
      <Button
        {...controlButtonMetaData}
        fullWidth={fullWidth || controlButtonMetaData.fullWidth}
        ref={(el: HTMLButtonElement | null) => {
          (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
          refs.setReference(el);
        }}
        id={`${identifier}-trigger`}
        arrowIcon={open ? ARROWICON.UP : ARROWICON.DOWN}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-activedescendant={
          !searchable && open && focused >= 0 ? `${identifier}-option-${focused}` : undefined
        }
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      />
      {open && (
        <FloatingPortal>
          <div
            ref={(el) => {
              panelRef.current = el;
              refs.setFloating(el);
            }}
            style={{
              ...floatingStyles,
              minWidth: triggerWidth,
              zIndex: 'calc(var(--hl-z-index_modal, 1000) + 1)',
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- arrow keys from the search box and options bubble here; the options are the interactive elements */}
            <div
              id={panelId}
              // lets a surrounding panel (e.g. Filters) tell that a click in here is not "outside"
              data-select-menu=""
              className={styles['hl-selectmenu--panel']}
              style={{ minWidth: 'max-content' }}
              onKeyDown={onKeyDown}
            >
              {searchable && (
                <div className={styles['hl-selectmenu--searchbar']}>
                  <Input
                    ref={searchRef}
                    id={`${identifier}-search`}
                    type={TYPES.SEARCH}
                    size="small"
                    className={styles['hl-selectmenu-searchbar']}
                    placeholder={searchPlaceholder}
                    value={searchValue}
                    onChange={(e) => handleSearch(e.target.value)}
                    aria-controls={`${identifier}-options`}
                    aria-activedescendant={
                      focused >= 0 ? `${identifier}-option-${focused}` : undefined
                    }
                    actions={[{ ariaLabel: 'Clear search', onClick: () => handleSearch('') }]}
                  />
                </div>
              )}
              <div className={styles['hl-selectmenu-options-panel']}>
                <ul
                  id={`${identifier}-options`}
                  role="listbox"
                  className={classNames(styles['hl-selectmenu-options'], {
                    [styles['hl-selectmenu-options__no-padding']]:
                      options.length === 0 && showCreate,
                  })}
                >
                  {options.map((option, i) => (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
                    <li
                      key={option.key}
                      id={`${identifier}-option-${i}`}
                      role="option"
                      aria-selected={option.key === selectedKey}
                      aria-disabled={option.disabled || undefined}
                      className={classNames(styles['hl-selectmenu-option'], {
                        [styles['hl-selectmenu-option--focused']]: i === focused,
                        [styles['focused']]: i === focused,
                        [styles['selected']]: option.key === selectedKey,
                        [styles['locked']]: option.disabled,
                      })}
                      onMouseEnter={() => setFocused(i)}
                      onClick={(e) => pick(option, e)}
                    >
                      <div className={styles['hl-selectmenu-option__content']}>
                        <div className={styles['hl-selectmenu-option__content-left']}>
                          {option.icon ? option.icon() : null}
                          <span className={styles['hl-selectmenu-option__label']}>
                            <span
                              style={option.key === selectedKey ? { fontWeight: 600 } : undefined}
                            >
                              {option.label}
                            </span>
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                  {options.length === 0 && noOptionContent ? <li>{noOptionContent}</li> : null}
                </ul>
              </div>
              {showCreate && (
                <div className={styles['hl-selectmenu__creatableselect-wrapper']}>
                  <button
                    type="button"
                    className={styles['hl-selectmenu__creatableselect-btn']}
                    onClick={create}
                    disabled={createDisabled}
                  >
                    <Text size="lg" fontFamily="interactive">
                      {createLabelText}
                    </Text>
                    <Text>&nbsp;&quot;{searchValue.trim()}&quot;</Text>
                  </button>
                </div>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

export default SelectMenu;
