import { useMemo } from 'react';
import { ConflictDialog, ContactForm } from '@crm/ui';
import type { ConflictRow } from '@crm/ui';
import { useGetActivityQuery } from '../../api/contactsApi';
import type { Contact } from '../../api/types';
import { CONTACT_FIELDS, FIELD_LABEL, toFormValues } from './contactFields';
import { conflictFields, threeWayCompare } from './conflict';
import type { ContactEditorState } from './useContactEditor';

/**
 * Edit mode of the detail page: the form, and the ConflictDialog a stale save opens.
 * Loaded lazily (see ContactDetails), so the phone input and its number library are only
 * downloaded once someone clicks Edit.
 */
export default function ContactEditor({
  contact,
  editor,
}: {
  contact: Contact;
  editor: ContactEditorState;
}) {
  const { conflict } = editor;
  // "Last changed by …": the newest field change (the 409 also refreshes the activity)
  // no name while the activity is being refetched: the cached list is from before the other save
  const { data: activity, isFetching: activityFetching } = useGetActivityQuery(contact.id);
  const lastFieldChange = activityFetching
    ? undefined
    : activity?.items.find((a) => a.type === 'CONTACT_UPDATED');

  const compare = useMemo(() => {
    if (!conflict) return null;
    const theirs = toFormValues(conflict.latest);
    const result = threeWayCompare(conflict.base, conflict.mine, theirs);
    const rows: ConflictRow[] = conflictFields(result).map((field) => ({
      field,
      label: FIELD_LABEL[field],
      theirs: theirs[field],
      mine: conflict.mine[field],
      changedByMe: result.mine.includes(field),
      changedByThem: result.theirs.includes(field),
    }));
    return { result, rows };
  }, [conflict]);

  return (
    <>
      {editor.values && (
        <ContactForm
          fields={CONTACT_FIELDS}
          values={editor.values}
          errors={editor.errors}
          onChange={editor.change}
          onSubmit={editor.save}
          onCancel={editor.cancel}
          canSave={editor.hasChanges}
          saving={editor.saving}
          resetKey={editor.resetKey}
        />
      )}

      <ConflictDialog
        visible={Boolean(conflict)}
        rows={compare?.rows ?? []}
        lastChangedBy={
          lastFieldChange
            ? { actor: lastFieldChange.actor || 'Anonymous', at: lastFieldChange.createdAt }
            : null
        }
        onReloadLatest={editor.reloadLatest}
        onReapply={editor.reapplyMine}
        onMergeBoth={compare?.result.canMerge ? editor.mergeBoth : undefined}
        onClose={editor.closeConflict}
        busy={editor.saving}
      />
    </>
  );
}
