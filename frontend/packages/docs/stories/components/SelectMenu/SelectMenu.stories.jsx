import React, { useState } from 'react';
import { SelectMenu } from '@crm/ui/components/SelectMenu/index';
import PlusIcon from '@crm/ui/icons/react/PlusIcon';

const TAGS = ['Customer', 'Lead', 'Newsletter', 'Partner', 'Prospect', 'VIP'];

const TagPickerExample = () => {
  const [tags, setTags] = useState(TAGS);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState('');

  const query = search.trim().toLowerCase();
  const options = tags
    .filter((t) => !picked.includes(t))
    .filter((t) => !query || t.toLowerCase().includes(query))
    .map((t) => ({ key: t, label: t }));
  const exactMatch = !query || tags.some((t) => t.toLowerCase() === query);

  const pick = (name) => {
    setPicked((p) => [...p, name]);
    setSearch('');
  };

  return (
    <div style={{ minHeight: 360 }}>
      <p>Picked: {picked.length ? picked.join(', ') : 'none'}</p>
      <SelectMenu
        options={options}
        controlButtonMetaData={{
          label: 'Add tag',
          icon: () => <PlusIcon />,
          variant: 'tertiary',
          size: 'small',
        }}
        searchValue={search}
        handleSearch={setSearch}
        isCreatable
        isExactMatch={exactMatch}
        creatableButtonMetaData={{
          createLabelText: 'Create',
          disabled: !query,
          handleCreateOption: (name) => {
            setTags((t) => [...t, name.trim()]);
            pick(name.trim());
          },
        }}
        onSelect={(option) => pick(option.label)}
        identifier="story-tag-picker"
      />
    </div>
  );
};

export default {
  title: 'Components/Molecule/SelectMenu',
  component: SelectMenu,
};

export const TagPicker = {
  render: () => <TagPickerExample />,
  name: 'Button + search + create (TagPicker)',
};
