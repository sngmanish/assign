import * as React from 'react';

import { VARIANTS, SIZES } from '../Button';
import { SelectMenu } from '../SelectMenu';
import type { SelectMenuPlacement } from '../SelectMenu/SelectMenu.types';

export interface SelectItem<V extends string | number = string> {
  label: string;
  value: V;
}

export interface OptionSelectProps<V extends string | number = string> {
  options: SelectItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name of the button, e.g. "Sort contacts". */
  ariaLabel: string;
  /** Shown before the selected label on the button, e.g. "Sort:". */
  prefix?: string;
  disabled?: boolean;
  placement?: SelectMenuPlacement;
  /** Stretch the button to its container, like a form field; the menu then matches its width. */
  fullWidth?: boolean;
}

/** A button that opens a menu of options and shows the one that is selected. */
function OptionSelect<V extends string | number = string>({
  options,
  value,
  onChange,
  ariaLabel,
  prefix,
  disabled = false,
  placement = 'bottom-start',
  fullWidth = false,
}: OptionSelectProps<V>) {
  const id = React.useId().replace(/:/g, '');
  const selected = options.find((o) => o.value === value);
  const menuOptions = React.useMemo(
    () => options.map((o) => ({ key: o.value, label: o.label })),
    [options],
  );

  return (
    <SelectMenu
      identifier={`option-select-${id}`}
      options={menuOptions}
      selectedKey={value}
      onSelect={(option) => onChange(option.key as V)}
      searchable={false}
      placement={placement}
      fullWidth={fullWidth}
      disabled={disabled}
      controlButtonMetaData={{
        ariaLabel,
        label: `${prefix ? `${prefix} ` : ''}${selected?.label ?? ''}`,
        variant: VARIANTS.SECONDARY,
        size: SIZES.SMALL,
        style: fullWidth ? { justifyContent: 'space-between' } : undefined,
      }}
    />
  );
}

export default OptionSelect;
