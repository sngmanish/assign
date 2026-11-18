import { BUTTON_VARIANT, Modal, TagPicker, Text, VStack } from '@crm/ui';
import { useBulkAssignTagMutation } from '../../api/contactsApi';
import { isApiError } from '../../api/errors';
import type { Tag } from '../../api/types';
import { useToast } from '../../app/useToast';

interface Props {
  visible: boolean;
  contactIds: string[];
  tags: Tag[];
  onClose: () => void;
  /** After a successful assign (the selection is cleared). */
  onDone: () => void;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** "Added to 12, 3 already had it" (and how many no longer exist, if any). */
export function bulkResultText(
  tag: string,
  r: { added: number; alreadyTagged: number; notFound: number },
) {
  const parts = [`Tag ${tag}: added to ${plural(r.added, 'contact')}`];
  if (r.alreadyTagged) parts.push(`${r.alreadyTagged.toLocaleString()} already had it`);
  if (r.notFound) parts.push(`${r.notFound.toLocaleString()} no longer exist`);
  return parts.join(', ');
}

/** Pick (or create) a tag and apply it to every selected contact in one request. */
export function BulkTagDialog({ visible, contactIds, tags, onClose, onDone }: Props) {
  const toast = useToast();
  const [assign, { isLoading }] = useBulkAssignTagMutation();

  const pick = async ({ id, name }: { id?: string; name: string }) => {
    if (!name || isLoading) return;
    try {
      const result = await assign({ contactIds, tagId: id, name }).unwrap();
      toast.success(bulkResultText(name, result));
      onDone();
    } catch (err) {
      toast.error(
        `Couldn't add tag ${name}: ${isApiError(err) ? err.message : 'something went wrong.'}`,
      );
    }
  };

  return (
    <Modal isVisible={visible} closeModal={onClose} size="sm">
      <Modal.Header title={`Add a tag to ${plural(contactIds.length, 'contact')}`} />
      <Modal.Body>
        <VStack spacing={2} align="flex-start">
          <Text tag="p" size="sm" color="var(--hl-muted-foreground)">
            Choose a tag, or type a new name to create one. Contacts that already have it are left
            as they are.
          </Text>
          <TagPicker
            tags={tags}
            onPick={pick}
            label={isLoading ? 'Adding…' : 'Choose a tag'}
            variant={BUTTON_VARIANT.SECONDARY}
            disabled={isLoading}
          />
        </VStack>
      </Modal.Body>
    </Modal>
  );
}
