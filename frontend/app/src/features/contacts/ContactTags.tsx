import { TagList, TagPicker } from '@crm/ui';
import { useAddTagMutation, useGetTagsQuery, useRemoveTagMutation } from '../../api/contactsApi';
import { isApiError } from '../../api/errors';
import type { Contact } from '../../api/types';
import { useToast } from '../../app/useToast';

const EMPTY: never[] = [];
const errorText = (err: unknown) => (isApiError(err) ? err.message : 'Something went wrong.');

/** The contact's tags: × removes one, "+ Add tag" adds an existing or new one. Both are optimistic. */
export function ContactTags({ contact }: { contact: Contact }) {
  const toast = useToast();
  const catalog = useGetTagsQuery().data?.items ?? EMPTY;
  const [addTag] = useAddTagMutation();
  const [removeTag] = useRemoveTagMutation();

  const add = async ({ id, name }: { id?: string; name: string }) => {
    if (!name) return;
    try {
      await addTag({ id: contact.id, tagId: id, name }).unwrap();
    } catch (err) {
      toast.error(`Couldn't add tag ${name}: ${errorText(err)}`);
    }
  };

  const remove = async (tag: { id: string; name: string }) => {
    try {
      await removeTag({ id: contact.id, tagId: tag.id }).unwrap();
    } catch (err) {
      toast.error(`Couldn't remove tag ${tag.name}: ${errorText(err)}`);
    }
  };

  return (
    <TagList
      // a chip still being added has no real id yet, so it has no ×
      tags={contact.tags.map((t) => ({ ...t, pending: t.id.startsWith('pending:') }))}
      onRemove={remove}
      addControl={
        <TagPicker tags={catalog} excludeIds={contact.tags.map((t) => t.id)} onPick={add} />
      }
    />
  );
}
