import * as React from 'react';

import { Tag } from '../Tag';
import { Text } from '../Text';

export interface TagListItem {
  id: string;
  name: string;
  /** Still being saved: shown, but cannot be removed yet. */
  pending?: boolean;
}

export interface TagListProps {
  tags: TagListItem[];
  /** When given, each chip gets an × that calls it. */
  onRemove?: (tag: TagListItem) => void;
  /** A control placed after the chips, e.g. a TagPicker ("+ Add tag"). */
  addControl?: React.ReactNode;
}

/** A contact's tags as chips, with an optional × on each and an add control at the end. */
function TagList({ tags, onRemove, addControl }: TagListProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--hl-space-2)',
      }}
    >
      {tags.length === 0 && (
        <Text size="sm" color="var(--hl-muted-foreground)">
          No tags
        </Text>
      )}
      {tags.map((tag) => (
        <Tag
          key={tag.id}
          label={tag.name}
          closable={Boolean(onRemove) && !tag.pending}
          onClose={onRemove ? () => onRemove(tag) : undefined}
        />
      ))}
      {addControl}
    </div>
  );
}

export default TagList;
