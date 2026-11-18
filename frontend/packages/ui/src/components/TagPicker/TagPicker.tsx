import * as React from 'react';

import { SelectMenu } from '../SelectMenu';
import { VARIANTS, SIZES } from '../Button';

import PlusIcon from '../../icons/react/PlusIcon';

export interface TagPickerTag {
  id: string;
  name: string;
}

export interface TagPickerProps {
  /** All tags that can be picked (the tag catalog). */
  tags: TagPickerTag[];
  /** Tags to leave out, e.g. the ones the contact already has. */
  excludeIds?: string[];
  /** An existing tag (`id` set) or a new one by name. */
  onPick: (pick: { id?: string; name: string }) => void;
  label?: string;
  /** `tertiary` (default) is a bare "+ Add tag" next to chips; `secondary` is an outlined button. */
  variant?: typeof VARIANTS.TERTIARY | typeof VARIANTS.SECONDARY;
  disabled?: boolean;
}

/** Tag names are at most this long (the API's limit). */
const MAX_LENGTH = 50;

const PlusAsIcon = () => <PlusIcon />;

/**
 * "+ Add tag": a button that opens a searchable list of tags. Typing a name that does not exist
 * offers "Create 'xyz'".
 */
function TagPicker({
  tags,
  excludeIds = [],
  onPick,
  label = 'Add tag',
  variant = VARIANTS.TERTIARY,
  disabled = false,
}: TagPickerProps) {
  const id = React.useId().replace(/:/g, '');
  const [search, setSearch] = React.useState('');

  const excluded = React.useMemo(() => new Set(excludeIds), [excludeIds]);
  const query = search.trim().toLowerCase();
  const options = React.useMemo(
    () =>
      tags
        .filter((t) => !excluded.has(t.id))
        .filter((t) => !query || t.name.toLowerCase().includes(query))
        .map((t) => ({ key: t.id, label: t.name })),
    [tags, excluded, query],
  );
  // "Create" is offered only when no tag has exactly this name (names are unique ignoring case)
  const exactMatch = !query || tags.some((t) => t.name.toLowerCase() === query);

  return (
    <SelectMenu
      options={options}
      controlButtonMetaData={{
        label,
        icon: PlusAsIcon,
        variant,
        size: SIZES.SMALL,
      }}
      disabled={disabled}
      searchValue={search}
      handleSearch={(value) => setSearch(value.slice(0, MAX_LENGTH))}
      isCreatable
      isExactMatch={exactMatch}
      creatableButtonMetaData={{
        createLabelText: 'Create',
        disabled: !query,
        handleCreateOption: (name) => onPick({ name }),
      }}
      onSelect={(option) => onPick({ id: String(option.key), name: option.label })}
      identifier={`tag-picker-${id}`}
    />
  );
}

export default TagPicker;
